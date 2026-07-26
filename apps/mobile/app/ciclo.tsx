import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  CalendarHeart,
  Droplets,
  Plus,
  Info,
  ShieldCheck,
  X,
  ChevronLeft,
  ChevronRight,
  PauseCircle,
} from 'lucide-react-native';
import {
  useProfile,
  useActivePregnancy,
  useCycleLogs,
  useAddCycleLog,
  useCycleSettings,
} from '@hubpatients/supabase';
import {
  currentPhase,
  daysUntilNextPeriod,
  dayInCycleFor,
  phaseForDayInCycle,
  findLastPeriodStart,
  cycleLogSchema,
  CYCLE_PHASE_LABELS,
  CYCLE_PHASE_COLORS,
  CYCLE_MOODS,
  CYCLE_SYMPTOMS,
  CYCLE_DISCLAIMER,
  CYCLE_PRIVACY_NOTICE,
  FLOW_LEVEL_LABELS,
  type CyclePhase,
} from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Input, Button, EmptyState, ErrorState, IconCircle, Badge } from '@/components/ui';
import { AppSheet, type AppSheetHandle } from '@/components/sheet';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { useColors, fonts } from '@/theme';

const FLOW_LEVELS = [0, 1, 2, 3] as const;
const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

// Chave de "aviso de privacidade já lido" — espelha 'vl_cycle_privacy_seen' da web.
const PRIVACY_KEY = 'vl_cycle_privacy_seen';

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayISO(): string {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDatePt(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function CicloScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const uid = user?.id ?? '';

  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const { data: pregnancy, isLoading: pregnancyLoading } = useActivePregnancy(user?.id);
  const { data: settings, isLoading: settingsLoading } = useCycleSettings(user?.id);
  const { data: logs, isLoading: logsLoading, isError, refetch } = useCycleLogs(user?.id);

  // Folha de registro: dia alvo (null = fechada).
  const [logDate, setLogDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const list = useMemo(() => logs ?? [], [logs]);
  const cycleLen = settings?.average_cycle_days ?? 28;
  const periodDays = settings?.average_period_days ?? 5;

  const lastPeriodStart = useMemo(() => findLastPeriodStart(list), [list]);
  const phase = useMemo(
    () => currentPhase(new Date(), lastPeriodStart, cycleLen, periodDays),
    [lastPeriodStart, cycleLen, periodDays],
  );
  const daysUntil = useMemo(
    () => daysUntilNextPeriod(list, { average_cycle_days: cycleLen }, new Date()),
    [list, cycleLen],
  );

  const loading = profileLoading || pregnancyLoading || settingsLoading || logsLoading;

  // ── Guardas de acesso ─────────────────────────────────────────────────────

  // Recurso para a própria pessoa que menstrua.
  if (!loading && profile && profile.biological_sex !== 'female') {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Ciclo" subtitle="Acompanhe seu ciclo menstrual" icon={CalendarHeart} back />
        <Screen>
          <EmptyState
            icon={CalendarHeart}
            title="Disponível no seu próprio perfil"
            subtitle="O acompanhamento do ciclo menstrual fica disponível para a própria pessoa que menstrua."
          />
        </Screen>
      </View>
    );
  }

  // Durante gestação ativa, o acompanhamento do ciclo é pausado.
  if (!loading && pregnancy) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Ciclo" subtitle="Acompanhe seu ciclo menstrual" icon={CalendarHeart} back />
        <Screen>
          <Card className="items-center gap-2">
            <IconCircle icon={PauseCircle} tone="primary" size={48} />
            <Text style={{ fontFamily: fonts.display }} className="text-center text-[16px] text-fg">
              Ciclo pausado durante a gestação
            </Text>
            <Text style={{ fontFamily: fonts.regular }} className="text-center text-[13px] text-muted">
              Ele volta a ficar disponível após o fim da gestação registrada.
            </Text>
          </Card>
          <CycleDisclaimer colors={colors} />
        </Screen>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Ciclo"
        subtitle="Acompanhe seu ciclo menstrual"
        icon={CalendarHeart}
        back
        right={
          <Pressable
            onPress={() => setLogDate(todayISO())}
            accessibilityRole="button"
            accessibilityLabel="Registrar hoje"
            hitSlop={8}
            style={{ borderCurve: 'continuous' }}
            className="h-10 w-10 items-center justify-center rounded-2xl bg-trust-100 active:opacity-70"
          >
            <Plus size={20} color={colors.primary} />
          </Pressable>
        }
      />
      <Screen onRefresh={() => void onRefresh()} refreshing={refreshing}>
        <PrivacyBanner colors={colors} />

        {isError ? <ErrorState onRetry={() => void refetch()} /> : null}

        {/* Fase atual */}
        {phase ? (
          <Card className="flex-row items-center gap-3">
            <IconCircle icon={Droplets} tone="alert" size={48} />
            <View className="flex-1">
              <Text style={{ fontFamily: fonts.display }} className="text-[16px] text-fg">{CYCLE_PHASE_LABELS[phase]}</Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
                {daysUntil != null
                  ? daysUntil >= 0
                    ? `Próxima menstruação em ~${daysUntil} dia(s)`
                    : `Menstruação atrasada ~${Math.abs(daysUntil)} dia(s)`
                  : `Ciclo médio de ${cycleLen} dias`}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Calendário navegável + fases */}
        <CycleCalendar
          logs={list}
          cycleLength={cycleLen}
          periodDays={periodDays}
          lastPeriodStart={lastPeriodStart}
          onPickDay={setLogDate}
          colors={colors}
        />

        {/* Disclaimer permanente */}
        <CycleDisclaimer colors={colors} />

        {/* Histórico */}
        {list.length > 0 ? (
          <View className="gap-2">
            {list.map((log, i) => (
              <FadeInItem key={log.id} index={i}>
                <Card className="flex-row items-center gap-3">
                  <IconCircle icon={Droplets} tone="alert" size={40} />
                  <View className="flex-1">
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                      {new Date(log.log_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                    </Text>
                    {log.symptoms.length > 0 ? (
                      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">{log.symptoms.join(', ')}</Text>
                    ) : null}
                    {log.mood.length > 0 ? (
                      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">{log.mood.join(', ')}</Text>
                    ) : null}
                  </View>
                  <Badge tone={log.flow_level >= 2 ? 'alert' : 'neutral'}>{FLOW_LEVEL_LABELS[log.flow_level] ?? '—'}</Badge>
                </Card>
              </FadeInItem>
            ))}
          </View>
        ) : !isError ? (
          <EmptyState
            icon={CalendarHeart}
            title="Sem registros ainda"
            subtitle="Toque em um dia do calendário ou em + para registrar e ver fase e previsões."
          />
        ) : null}
      </Screen>

      {/* Folha de registro do dia */}
      {logDate != null ? (
        <LogDaySheet uid={uid} date={logDate} onClose={() => setLogDate(null)} />
      ) : null}
    </View>
  );
}

/* ──────────────────────────── Privacidade ──────────────────────────── */

/**
 * Aviso de privacidade dispensável (dado íntimo). Persiste o "lido" no
 * SecureStore (chave 'vl_cycle_privacy_seen'), espelhando a web — começa oculto
 * para evitar flash antes da leitura assíncrona do storage.
 */
function PrivacyBanner({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(PRIVACY_KEY)
      .then((v) => {
        if (active && v !== '1') setVisible(true);
      })
      .catch(() => {
        if (active) setVisible(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function dismiss() {
    void SecureStore.setItemAsync(PRIVACY_KEY, '1').catch(() => {
      // ignora indisponibilidade do storage; só não persiste o "lido"
    });
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <View
      accessibilityRole="summary"
      style={{ borderCurve: 'continuous' }}
      className="gap-2 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3"
    >
      <View className="flex-row items-start gap-2.5">
        <ShieldCheck size={18} color={colors.primary} style={{ marginTop: 1 }} />
        <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
          {CYCLE_PRIVACY_NOTICE}
        </Text>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dispensar aviso de privacidade"
          hitSlop={8}
          className="h-7 w-7 items-center justify-center rounded-lg active:opacity-70"
        >
          <X size={14} color={colors.muted} />
        </Pressable>
      </View>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Entendi"
        style={{ borderCurve: 'continuous' }}
        className="ml-7 self-start rounded-lg bg-trust-100 px-3 py-1.5 active:opacity-70"
      >
        <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-primary">Entendi</Text>
      </Pressable>
    </View>
  );
}

/* ──────────────────────────── Disclaimer ──────────────────────────── */

function CycleDisclaimer({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3">
      <Info size={16} color={colors.primary} style={{ marginTop: 1 }} />
      <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
        {CYCLE_DISCLAIMER} Previsões não substituem método contraceptivo nem avaliação médica.
      </Text>
    </View>
  );
}

/* ──────────────────────────── Calendário ──────────────────────────── */

/**
 * Calendário MENSAL navegável (‹ ›) com os dias coloridos por fase estimada,
 * projetada a partir do último início de menstruação. Dias com fluxo recebem um
 * ponto de realce. Tocar num dia chama onPickDay(ISO) para registrar AQUELE dia.
 */
function CycleCalendar({
  logs,
  cycleLength,
  periodDays,
  lastPeriodStart,
  onPickDay,
  colors,
}: {
  logs: { log_date: string; flow_level: number }[];
  cycleLength: number;
  periodDays: number;
  lastPeriodStart: Date | null;
  onPickDay: (dateISO: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const today = todayISO();

  // Datas (ISO) com fluxo > 0, para realçar.
  const flowDays = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) if (l.flow_level > 0) set.add(l.log_date);
    return set;
  }, [logs]);

  const cells = useMemo<({ day: number; iso: string } | null)[]>(() => {
    const leading = new Date(view.year, view.month, 1).getDay(); // 0=Dom
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const out: ({ day: number; iso: string } | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push({ day: d, iso: toISO(view.year, view.month, d) });
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  function phaseFor(iso: string): CyclePhase | null {
    if (!lastPeriodStart) return null;
    return phaseForDayInCycle(dayInCycleFor(iso, lastPeriodStart, cycleLength), cycleLength, periodDays);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  const monthLabel = `${MONTHS[view.month] ?? ''} de ${view.year}`;

  return (
    <Card className="gap-3">
      {/* Navegação de mês */}
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => shiftMonth(-1)}
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          hitSlop={8}
          style={{ borderCurve: 'continuous' }}
          className="h-10 w-10 items-center justify-center rounded-2xl bg-surface-2 active:opacity-70"
        >
          <ChevronLeft size={20} color={colors.fg} />
        </Pressable>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
          {monthLabel}
        </Text>
        <Pressable
          onPress={() => shiftMonth(1)}
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          hitSlop={8}
          style={{ borderCurve: 'continuous' }}
          className="h-10 w-10 items-center justify-center rounded-2xl bg-surface-2 active:opacity-70"
        >
          <ChevronRight size={20} color={colors.fg} />
        </Pressable>
      </View>

      {/* Cabeçalho dos dias da semana */}
      <View className="flex-row">
        {WEEK.map((w, i) => (
          <Text key={i} style={{ fontFamily: fonts.medium, width: `${100 / 7}%` }} className="text-center text-[11px] text-faint">
            {w}
          </Text>
        ))}
      </View>

      {/* Grade */}
      <View className="flex-row flex-wrap">
        {cells.map((cell, i) => {
          if (!cell) return <View key={`e-${i}`} style={{ width: `${100 / 7}%` }} className="py-1" />;
          const phase = phaseFor(cell.iso);
          const isToday = cell.iso === today;
          const hasFlow = flowDays.has(cell.iso);
          const bg = phase ? CYCLE_PHASE_COLORS[phase] : undefined;
          const label = phase
            ? `${cell.day} — ${CYCLE_PHASE_LABELS[phase]}${hasFlow ? ', fluxo registrado' : ''}`
            : `${cell.day}${hasFlow ? ' — fluxo registrado' : ''}`;
          return (
            <Pressable
              key={cell.iso}
              onPress={() => onPickDay(cell.iso)}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={{ width: `${100 / 7}%` }}
              className="items-center py-1"
            >
              <View
                style={{ backgroundColor: bg, borderCurve: 'continuous' }}
                className={`h-9 w-9 items-center justify-center rounded-full ${isToday ? 'border-2 border-primary' : ''}`}
              >
                <Text style={{ fontFamily: isToday ? fonts.semibold : fonts.medium, color: bg ? '#1f2937' : colors.fg }} className="text-[12px]">
                  {cell.day}
                </Text>
                {hasFlow ? <View style={{ position: 'absolute', bottom: 2, width: 5, height: 5, borderRadius: 3, backgroundColor: '#e11d48' }} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Legenda das fases */}
      <View className="flex-row flex-wrap gap-x-3 gap-y-1.5 pt-0.5">
        {(Object.keys(CYCLE_PHASE_LABELS) as CyclePhase[]).map((p) => (
          <View key={p} className="flex-row items-center gap-1.5">
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: CYCLE_PHASE_COLORS[p] }} />
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-fg-soft">{CYCLE_PHASE_LABELS[p]}</Text>
          </View>
        ))}
        <View className="flex-row items-center gap-1.5">
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#e11d48' }} />
          <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-fg-soft">Fluxo registrado</Text>
        </View>
      </View>

      {!lastPeriodStart ? (
        <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-faint">
          As cores de fase aparecem depois que você registrar ao menos um dia de menstruação. Toque em um dia para registrar.
        </Text>
      ) : null}
    </Card>
  );
}

/* ──────────────────────────── Registro do dia ──────────────────────────── */

/**
 * Folha de registro diário do ciclo — espelha o log-day-modal da web: fluxo
 * 0–3, sintomas e humor (chips múltiplos) e notas. Valida com cycleLogSchema
 * (safeParse) e grava via useAddCycleLog. Anima a saída antes de desmontar
 * (padrão pendingRef + sheetRef.close()).
 */
function LogDaySheet({
  uid,
  date,
  onClose,
}: {
  uid: string;
  date: string;
  onClose: () => void;
}) {
  const sheetRef = useRef<AppSheetHandle>(null);
  const addLog = useAddCycleLog(uid);

  const [flowLevel, setFlowLevel] = useState(0);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function submit() {
    const parsed = cycleLogSchema.safeParse({
      logDate: date,
      flowLevel,
      symptoms,
      mood,
      notes: notes.trim() || undefined,
    });
    if (!parsed.success) {
      toast.info(parsed.error.issues[0]?.message ?? 'Verifique os dados do registro.');
      return;
    }
    try {
      await addLog.mutateAsync({
        logDate: date,
        input: {
          flowLevel: parsed.data.flowLevel,
          symptoms: parsed.data.symptoms,
          mood: parsed.data.mood,
          notes: parsed.data.notes,
        },
      });
      toast.success('Registro do ciclo salvo.');
      sheetRef.current?.close();
    } catch {
      toast.error('Não foi possível salvar o registro.');
    }
  }

  return (
    <AppSheet ref={sheetRef} onClose={onClose} title="Registrar dia">
      <View className="gap-4 pb-2">
        <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">{formatDatePt(date)}</Text>

        {/* Nível de fluxo */}
        <View>
          <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">Nível de fluxo</Text>
          <View className="flex-row gap-2">
            {FLOW_LEVELS.map((level) => {
              const on = flowLevel === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => setFlowLevel(level)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{ borderCurve: 'continuous' }}
                  className={`flex-1 items-center rounded-2xl border py-2.5 ${on ? 'border-rose-300 bg-rose-50' : 'border-line bg-surface-2'}`}
                >
                  <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${on ? 'text-rose-700' : 'text-muted'}`}>
                    {FLOW_LEVEL_LABELS[level]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sintomas */}
        <View>
          <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">Sintomas</Text>
          <View className="flex-row flex-wrap gap-2">
            {CYCLE_SYMPTOMS.map((s) => {
              const on = symptoms.includes(s);
              return (
                <Pressable
                  key={s}
                  onPress={() => toggle(symptoms, setSymptoms, s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{ borderCurve: 'continuous' }}
                  className={`rounded-full border px-3 py-1.5 ${on ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface-2'}`}
                >
                  <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${on ? 'text-primary' : 'text-muted'}`}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Humor */}
        <View>
          <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">Humor</Text>
          <View className="flex-row flex-wrap gap-2">
            {CYCLE_MOODS.map((m) => {
              const on = mood.includes(m);
              return (
                <Pressable
                  key={m}
                  onPress={() => toggle(mood, setMood, m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{ borderCurve: 'continuous' }}
                  className={`rounded-full border px-3 py-1.5 ${on ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface-2'}`}
                >
                  <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${on ? 'text-primary' : 'text-muted'}`}>{m}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Notas */}
        <Input
          label="Notas (opcional)"
          value={notes}
          onChangeText={setNotes}
          maxLength={500}
          placeholder="Algo que queira lembrar deste dia…"
          multiline
        />

        <Button label="Salvar registro" icon={Plus} loading={addLog.isPending} onPress={submit} />
        <Text style={{ fontFamily: fonts.regular }} className="text-center text-[11px] text-faint">
          {CYCLE_DISCLAIMER}
        </Text>
      </View>
    </AppSheet>
  );
}
