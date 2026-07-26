import { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { CalendarHeart, Stethoscope, MapPin, Video, Plus, CalendarClock, Check, X, CalendarPlus, Bell, Paperclip, FileText, Save, BadgeCheck } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAppointments, useAppointmentMutations, useExams, queryKeys } from '@hubpatients/supabase';
import {
  APPOINTMENT_KIND_LABELS,
  APPOINTMENT_STATUS_LABELS,
  REMINDER_OPTIONS,
  buildICalString,
  type AppointmentKind,
  type Appointment,
  type ICalAppointment,
} from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Input, Button, Badge, EmptyState, ErrorState, IconCircle } from '@/components/ui';
import { AppSheet, type AppSheetHandle } from '@/components/sheet';
import { ClinicalReportButton } from '@/components/clinical-report-button';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { loadRemindersPref, scheduleAppointmentReminders } from '@/lib/notifications';
import { useColors, fonts } from '@/theme';

/** Monta o .ics de uma consulta (só logística) e compartilha o ARQUIVO de verdade.
 * No Android o Share do RN não anexa arquivo; por isso escrevemos o .ics em cache
 * e compartilhamos via expo-sharing. Share.share fica só como último recurso. */
async function shareAppointmentIcs(a: Appointment) {
  const ical: ICalAppointment = {
    id: a.id,
    doctor_name: a.doctor_name,
    specialty: a.specialty,
    scheduled_at: a.scheduled_at,
    kind: a.kind,
    location: a.location,
    meeting_link: a.meeting_link,
  };
  const ics = buildICalString([ical]);
  try {
    const uri = `${FileSystem.cacheDirectory ?? ''}consulta.ics`;
    await FileSystem.writeAsStringAsync(uri, ics, { encoding: FileSystem.EncodingType.UTF8 });
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/calendar',
          dialogTitle: `Consulta com ${a.doctor_name}`,
          UTI: 'public.calendar-event',
        });
      } else {
        // Último recurso: folha nativa do RN com o conteúdo como texto.
        await Share.share({ title: `Consulta com ${a.doctor_name}`, message: ics });
      }
    } finally {
      // PHI (LGPD): não deixar o .ics da consulta no cache após compartilhar/cancelar.
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    toast.error('Não foi possível compartilhar a agenda.');
  }
}

export default function ConsultasScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const pid = user?.id ?? '';
  const { data: appointments, isError, refetch } = useAppointments(user?.id);
  const { data: exams } = useExams(user?.id);
  const m = useAppointmentMutations(pid);

  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Invalida só as chaves desta tela (consultas + exames anexáveis).
      if (pid) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.appointments(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.exams(pid) }),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const [tab, setTab] = useState<'next' | 'past'>('next');

  // Formulário de nova consulta (bottom sheet).
  const [open, setOpen] = useState(false);
  const formSheetRef = useRef<AppSheetHandle>(null);
  const [doctor, setDoctor] = useState('');
  const [crm, setCrm] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [kind, setKind] = useState<AppointmentKind>('in_person');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [reminders, setReminders] = useState<number[]>([1440, 60]);
  const [examId, setExamId] = useState<string>('');

  function resetForm() {
    setDoctor(''); setCrm(''); setSpecialty(''); setDate(''); setTime('');
    setKind('in_person'); setLocation(''); setMeetingLink(''); setReminders([1440, 60]); setExamId('');
  }

  function toggleReminder(minutes: number) {
    setReminders((cur) => (cur.includes(minutes) ? cur.filter((r) => r !== minutes) : [...cur, minutes]));
  }

  const examList = exams ?? [];

  const now = Date.now();
  const all = appointments ?? [];
  const next = all.filter((a) => a.status === 'scheduled' && new Date(a.scheduled_at).getTime() >= now);
  const past = all.filter((a) => !(a.status === 'scheduled' && new Date(a.scheduled_at).getTime() >= now));
  const list = tab === 'next' ? next : past;

  async function add() {
    if (doctor.trim().length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.info('Informe o médico e a data (AAAA-MM-DD).');
      return;
    }
    const iso = new Date(`${date}T${time || '09:00'}:00`).toISOString();
    try {
      const created = await m.create.mutateAsync({
        patient_id: pid,
        doctor_name: doctor.trim(),
        doctor_crm: crm.trim() || null,
        specialty: specialty || null,
        scheduled_at: iso,
        kind,
        status: 'scheduled',
        location: location || null,
        meeting_link: kind === 'telehealth' ? (meetingLink.trim() || null) : null,
        reminders,
        exam_id: examId || null,
      });
      // Lembretes locais da consulta — só se a pref no aparelho estiver ligada.
      if (reminders.length > 0 && (await loadRemindersPref())) {
        await scheduleAppointmentReminders(created);
      }
      resetForm();
      formSheetRef.current?.close();
      toast.success('Consulta agendada.');
    } catch {
      toast.error('Não foi possível agendar.');
    }
  }

  function setStatus(id: string, status: 'completed' | 'cancelled') {
    m.update.mutate({ id, patch: { status } });
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Consultas" subtitle="Seus atendimentos médicos" icon={CalendarHeart} back />
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        <Button label="Agendar consulta" icon={Plus} onPress={() => setOpen(true)} />

        {/* Levar os registros para a consulta é o passo mais útil desta tela —
            por isso fica antes da lista, não escondido em um menu. */}
        {pid ? <ClinicalReportButton patientId={pid} /> : null}

        {/* Abas */}
        <View style={{ borderCurve: 'continuous' }} className="flex-row rounded-2xl border border-line bg-surface-2 p-1">
          {([{ v: 'next', label: `Próximas (${next.length})` }, { v: 'past', label: `Passadas (${past.length})` }] as const).map((t) => (
            <Pressable
              key={t.v}
              onPress={() => setTab(t.v)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.v }}
              style={{ borderCurve: 'continuous' }}
              className={`flex-1 items-center rounded-xl py-2 ${tab === t.v ? 'bg-trust-100' : ''}`}
            >
              <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${tab === t.v ? 'text-primary' : 'text-muted'}`}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {isError && !appointments ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : list.length > 0 ? (
          <View className="gap-3">
            {list.map((a, i) => (
              <FadeInItem key={a.id} index={i}>
                <AppointmentItem
                  appointment={a}
                  exams={examList}
                  onUpdate={(patch) => m.update.mutate({ id: a.id, patch })}
                  onSetStatus={(s) => setStatus(a.id, s)}
                  onOpenExam={(id) => router.push(`/exames/${id}` as never)}
                />
              </FadeInItem>
            ))}
          </View>
        ) : (
          <EmptyState icon={CalendarHeart} title={tab === 'next' ? 'Nenhuma consulta agendada' : 'Sem consultas passadas'} subtitle="Agende para receber lembretes e manter o histórico." />
        )}
      </Screen>

      {/* Formulário de nova consulta */}
      {open ? (
        <AppSheet ref={formSheetRef} onClose={() => setOpen(false)} title="Agendar consulta">
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            <View className="gap-3">
              <Input label="Médico" value={doctor} onChangeText={setDoctor} placeholder="Dr(a). Nome" />
              <View className="flex-row gap-3">
                <View className="flex-1"><Input label="CRM" value={crm} onChangeText={setCrm} placeholder="123456/SP" autoCapitalize="characters" /></View>
                <View className="flex-1"><Input label="Especialidade" value={specialty} onChangeText={setSpecialty} placeholder="Cardiologia" /></View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1"><Input label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-07-10" /></View>
                <View className="flex-1"><Input label="Hora (HH:MM)" value={time} onChangeText={setTime} placeholder="14:30" /></View>
              </View>

              <View className="flex-row gap-2">
                {([
                  { v: 'in_person', label: 'Presencial' },
                  { v: 'telehealth', label: 'Telemedicina' },
                ] as const).map((o) => (
                  <Pressable
                    key={o.v}
                    onPress={() => setKind(o.v)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: kind === o.v }}
                    style={{ borderCurve: 'continuous' }}
                    className={`flex-1 items-center rounded-2xl border py-2.5 ${kind === o.v ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'}`}
                  >
                    <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${kind === o.v ? 'text-accent' : 'text-muted'}`}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>

              {kind === 'telehealth' ? (
                <Input label="Link da chamada" value={meetingLink} onChangeText={setMeetingLink} placeholder="https://meet…" autoCapitalize="none" keyboardType="url" />
              ) : (
                <Input label="Local" value={location} onChangeText={setLocation} placeholder="Clínica, endereço…" />
              )}

              {/* Lembretes */}
              <View className="gap-1.5">
                <Text maxFontSizeMultiplier={1.6} style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">Lembretes</Text>
                <View className="flex-row flex-wrap gap-2">
                  {REMINDER_OPTIONS.map((opt) => {
                    const on = reminders.includes(opt.minutes);
                    return (
                      <Pressable
                        key={opt.minutes}
                        onPress={() => toggleReminder(opt.minutes)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`Lembrete ${opt.label}`}
                        style={{ borderCurve: 'continuous' }}
                        className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${on ? 'border-accent bg-health-300/15' : 'border-line bg-surface'}`}
                      >
                        <Bell size={13} color={on ? colors.accent : colors.muted} />
                        <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${on ? 'text-accent' : 'text-muted'}`}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Anexar exame */}
              {examList.length > 0 ? (
                <View className="gap-1.5">
                  <Text maxFontSizeMultiplier={1.6} style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">Anexar exame (opcional)</Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Pressable
                      onPress={() => setExamId('')}
                      accessibilityRole="button"
                      accessibilityState={{ selected: examId === '' }}
                      style={{ borderCurve: 'continuous' }}
                      className={`rounded-full border px-3 py-1.5 ${examId === '' ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface'}`}
                    >
                      <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${examId === '' ? 'text-primary' : 'text-muted'}`}>Nenhum</Text>
                    </Pressable>
                    {examList.map((ex) => {
                      const on = examId === ex.id;
                      return (
                        <Pressable
                          key={ex.id}
                          onPress={() => setExamId(ex.id)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          style={{ borderCurve: 'continuous' }}
                          className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${on ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface'}`}
                        >
                          <Paperclip size={13} color={on ? colors.primary : colors.muted} />
                          <Text style={{ fontFamily: fonts.semibold }} numberOfLines={1} className={`max-w-[160px] text-[12px] ${on ? 'text-primary' : 'text-muted'}`}>{ex.title}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <Button label="Agendar" icon={Plus} loading={m.create.isPending} onPress={add} />
            </View>
          </ScrollView>
        </AppSheet>
      ) : null}
    </View>
  );
}

/* ─────────────────────────── Card da consulta ─────────────────────────── */

function AppointmentItem({
  appointment: a,
  exams,
  onUpdate,
  onSetStatus,
  onOpenExam,
}: {
  appointment: Appointment;
  exams: { id: string; title: string }[];
  onUpdate: (patch: { notes?: string | null }) => void;
  onSetStatus: (status: 'completed' | 'cancelled') => void;
  onOpenExam: (examId: string) => void;
}) {
  const colors = useColors();
  const d = new Date(a.scheduled_at);
  const statusTone = a.status === 'completed' ? 'ok' : a.status === 'cancelled' ? 'alert' : 'info';
  const [notes, setNotes] = useState(a.notes ?? '');
  const isPast = a.status !== 'scheduled';
  const attachedExam = a.exam_id ? exams.find((e) => e.id === a.exam_id) ?? null : null;

  return (
    <Card className="gap-2">
      <View className="flex-row items-center gap-3">
        <IconCircle icon={a.kind === 'telehealth' ? Video : Stethoscope} tone="primary" size={44} />
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">{a.doctor_name}</Text>
          <View className="flex-row flex-wrap items-center gap-x-2">
            {a.specialty ? <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">{a.specialty}</Text> : null}
            {a.doctor_crm ? <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">CRM {a.doctor_crm}</Text> : null}
          </View>
        </View>
        <Badge tone={statusTone}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
      </View>

      <View className="flex-row items-center gap-2">
        <CalendarClock size={15} color={colors.muted} />
        <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-fg-soft">
          {d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} · {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <MapPin size={15} color={colors.muted} />
        <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] text-fg-soft">{a.location ?? APPOINTMENT_KIND_LABELS[a.kind]}</Text>
      </View>

      {/* Exame anexado */}
      {attachedExam ? (
        <Pressable
          onPress={() => onOpenExam(attachedExam.id)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir exame ${attachedExam.title}`}
          style={{ borderCurve: 'continuous' }}
          className="flex-row items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 active:opacity-70"
        >
          <FileText size={15} color={colors.primary} />
          <Text style={{ fontFamily: fonts.semibold }} numberOfLines={1} className="flex-1 text-[13px] text-primary">{attachedExam.title}</Text>
        </Pressable>
      ) : null}

      {/* Ações da consulta agendada */}
      {a.status === 'scheduled' ? (
        <View className="gap-2">
          {a.kind === 'telehealth' && a.meeting_link ? (
            <Button label="Entrar na chamada" variant="accent" size="sm" icon={Video} onPress={() => { if (a.meeting_link) Linking.openURL(a.meeting_link); }} />
          ) : null}
          <Pressable
            onPress={() => shareAppointmentIcs(a)}
            accessibilityRole="button"
            accessibilityLabel="Adicionar esta consulta à agenda do celular"
            style={{ borderCurve: 'continuous' }}
            className="flex-row items-center justify-center gap-1.5 rounded-xl border border-line py-2 active:opacity-70"
          >
            <CalendarPlus size={15} color={colors.fgSoft} />
            <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-fg-soft">Adicionar à agenda</Text>
          </Pressable>
          <View className="flex-row gap-2">
            <Pressable onPress={() => onSetStatus('completed')} accessibilityRole="button" accessibilityLabel="Marcar consulta como realizada" className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-health-400/40 py-2 active:opacity-70" style={{ borderCurve: 'continuous' }}>
              <Check size={15} color={colors.accent} />
              <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-accent">Realizada</Text>
            </Pressable>
            <Pressable onPress={() => onSetStatus('cancelled')} accessibilityRole="button" accessibilityLabel="Cancelar consulta" className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-line py-2 active:opacity-70" style={{ borderCurve: 'continuous' }}>
              <X size={15} color={colors.muted} />
              <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-muted">Cancelar</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Notas pós-consulta (apenas em consultas passadas/realizadas/canceladas) */}
      {isPast ? (
        <View className="gap-1.5 border-t border-line pt-2">
          <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">Anotações da consulta</Text>
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="O que o médico orientou, próximos passos…"
            multiline
            numberOfLines={3}
            style={{ fontFamily: fonts.regular, minHeight: 84, height: undefined, paddingTop: 12, textAlignVertical: 'top' }}
            accessibilityLabel="Anotações da consulta"
          />
          <Button
            label="Salvar anotações"
            variant="outline"
            size="sm"
            icon={notes === (a.notes ?? '') ? BadgeCheck : Save}
            disabled={notes === (a.notes ?? '')}
            onPress={() => onUpdate({ notes: notes.trim() || null })}
          />
        </View>
      ) : null}
    </Card>
  );
}
