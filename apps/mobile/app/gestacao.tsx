import { useMemo, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import {
  Baby,
  Activity,
  CalendarCheck,
  Phone,
  Plus,
  Check,
  Clock,
  Circle as CircleIcon,
  Info,
  Sparkles,
} from 'lucide-react-native';
import {
  useProfile,
  useActivePregnancy,
  useStartPregnancy,
  usePregnancyTimeline,
  useSetMilestoneCompleted,
  useWeightLog,
  useLogWeight,
  useLogFetalMovement,
  type TimelineItem,
} from '@hubpatients/supabase';
import {
  calculateGestationalAge,
  weeksUntilDue,
  weightGainRange,
  PREGNANCY_RISK_LABELS,
  MILESTONE_CATEGORY_LABELS,
  FETAL_MOVEMENTS_FROM_WEEK,
  PREGNANCY_DISCLAIMER,
  type PregnancyJourney,
  type PregnancyRisk,
} from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import {
  Screen,
  AppHeader,
  Card,
  Input,
  Button,
  Badge,
  EmptyState,
  IconCircle,
  SectionTitle,
} from '@/components/ui';
import { toast } from '@/components/toast';
import { LineChart } from '@/components/charts';
import { FadeInItem } from '@/components/motion';
import { colors, useColors, fonts } from '@/theme';

const ORDINAL = ['', '1º', '2º', '3º'];

/* ─────────────────────────── Tela raiz ─────────────────────────── */

export default function GestacaoScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: profile } = useProfile(user?.id);
  const { data: journey, isLoading } = useActivePregnancy(user?.id);

  // Guarda de acesso: recurso para a própria gestante.
  const blocked = profile != null && profile.biological_sex !== 'female';

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Gestação" subtitle="Acompanhe sua gravidez" icon={Baby} back />
      <Screen>
        {isLoading ? (
          <Card className="h-40 items-center justify-center">
            <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
              Carregando…
            </Text>
          </Card>
        ) : blocked ? (
          <EmptyState
            icon={Baby}
            title="Disponível no perfil da gestante"
            subtitle="O acompanhamento de gestação fica disponível no seu próprio perfil."
          />
        ) : journey ? (
          <PregnancyDashboard journey={journey} heightCm={profile?.height_cm ?? null} />
        ) : (
          <PregnancyOnboarding userId={userId} />
        )}
      </Screen>
    </View>
  );
}

/* ─────────────────────────── Onboarding ─────────────────────────── */

function PregnancyOnboarding({ userId }: { userId: string }) {
  const start = useStartPregnancy(userId);
  const [mode, setMode] = useState<'dpp' | 'dum'>('dpp');
  const [dateStr, setDateStr] = useState('');
  const [risk, setRisk] = useState<PregnancyRisk | ''>('');
  const [obName, setObName] = useState('');
  const [obPhone, setObPhone] = useState('');
  const [matName, setMatName] = useState('');
  const [matPhone, setMatPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Aceita AAAA-MM-DD (formato dos campos das outras telas mobile).
  function parseDate(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const d = new Date(`${s.trim()}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  async function onSubmit() {
    setError(null);
    const date = parseDate(dateStr);
    if (!date) {
      setError('Informe a data no formato AAAA-MM-DD.');
      return;
    }
    try {
      await start.mutateAsync({
        dueDate: mode === 'dpp' ? date : undefined,
        lmpDate: mode === 'dum' ? date : undefined,
        riskLevel: risk || undefined,
        obstetricianName: obName.trim() || undefined,
        obstetricianPhone: obPhone.trim() || undefined,
        maternityReference: matName.trim() || undefined,
        maternityPhone: matPhone.trim() || undefined,
      });
      toast.success('Calculamos sua idade gestacional e o calendário do pré-natal.');
    } catch {
      setError('Não foi possível iniciar. Você já pode ter uma gestação ativa.');
    }
  }

  return (
    <View className="gap-4">
      <Card className="items-center gap-2 py-6">
        <View
          style={{ borderCurve: 'continuous' }}
          className="h-16 w-16 items-center justify-center rounded-3xl bg-rose-100"
        >
          <Baby size={30} color="#e11d48" />
        </View>
        <Text style={{ fontFamily: fonts.display }} className="text-center text-[17px] text-fg">
          Iniciar acompanhamento da gestação
        </Text>
        <Text style={{ fontFamily: fonts.regular }} className="text-center text-[13px] leading-5 text-muted">
          Informe uma data para calcularmos a idade gestacional e sugerirmos o calendário de pré-natal do Ministério da Saúde.
        </Text>
      </Card>

      <Card className="gap-3">
        {/* DUM ou DPP */}
        <View
          style={{ borderCurve: 'continuous' }}
          className="flex-row rounded-2xl border border-line bg-surface-2 p-1"
        >
          {(['dpp', 'dum'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{ borderCurve: 'continuous' }}
              className={`flex-1 items-center rounded-xl px-3 py-2 ${mode === m ? 'bg-trust-100' : ''}`}
            >
              <Text
                style={{ fontFamily: fonts.semibold }}
                className={`text-center text-[12px] ${mode === m ? 'text-trust-700' : 'text-muted'}`}
              >
                {m === 'dpp' ? 'Sei a data provável do parto' : 'Sei a data da última menstruação'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input
          label={mode === 'dpp' ? 'Data provável do parto (DPP)' : 'Data da última menstruação (DUM)'}
          value={dateStr}
          onChangeText={setDateStr}
          placeholder="AAAA-MM-DD"
          autoCapitalize="none"
          error={error ?? undefined}
        />

        {/* Risco (informado pelo médico) */}
        <View className="gap-1.5">
          <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
            Risco (informado pelo seu médico — opcional)
          </Text>
          <View className="flex-row gap-2">
            {([
              ['', 'Não informado'],
              ['habitual', 'Risco habitual'],
              ['alto', 'Alto risco'],
            ] as const).map(([value, label]) => {
              const selected = risk === value;
              return (
                <Pressable
                  key={value || 'none'}
                  onPress={() => setRisk(value)}
                  style={{ borderCurve: 'continuous' }}
                  className={`flex-1 items-center rounded-2xl border py-2 ${selected ? 'border-trust-200 bg-trust-100' : 'border-line bg-surface-2'}`}
                >
                  <Text
                    style={{ fontFamily: fonts.semibold }}
                    className={`text-center text-[11px] ${selected ? 'text-trust-700' : 'text-muted'}`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input label="Obstetra (opcional)" value={obName} onChangeText={setObName} placeholder="Dra. Ana" />
        <Input
          label="Telefone do obstetra"
          value={obPhone}
          onChangeText={setObPhone}
          placeholder="(11) 9…"
          keyboardType="phone-pad"
        />
        <Input label="Maternidade de referência" value={matName} onChangeText={setMatName} />
        <Input
          label="Telefone da maternidade"
          value={matPhone}
          onChangeText={setMatPhone}
          placeholder="(11) …"
          keyboardType="phone-pad"
        />

        <Button
          label="Iniciar acompanhamento"
          icon={Sparkles}
          loading={start.isPending}
          onPress={onSubmit}
        />
      </Card>

      <Disclaimer />
    </View>
  );
}

/* ─────────────────────────── Dashboard ─────────────────────────── */

function PregnancyDashboard({
  journey,
  heightCm,
}: {
  journey: PregnancyJourney;
  heightCm: number | null;
}) {
  const colors = useColors();
  const journeyId = journey.id;
  const { data: timeline } = usePregnancyTimeline(journeyId);
  const { data: weightLog } = useWeightLog(journeyId);
  const toggle = useSetMilestoneCompleted(journeyId);
  const logWeight = useLogWeight(journeyId);

  const today = new Date();
  const ga = calculateGestationalAge({ lmpDate: journey.lmp_date, dueDate: journey.due_date }, today);
  const currentWeek = ga?.weeks ?? null;
  const remaining = journey.due_date ? weeksUntilDue(journey.due_date, today) : null;

  const items = timeline ?? [];
  const weights = weightLog ?? [];

  // Próxima consulta sugerida = primeira "consulta" não concluída, por semana.
  const nextConsult = useMemo(() => {
    return items
      .filter((i) => i.catalog?.category === 'consulta' && !i.milestone.completed_at)
      .sort((a, b) => (a.catalog?.week_min ?? 99) - (b.catalog?.week_min ?? 99))[0];
  }, [items]);

  // IMC aproximado a partir da altura e do primeiro peso registrado.
  const bmi = useMemo(() => {
    const first = [...weights].sort((a, b) => a.week - b.week)[0];
    if (!first || !heightCm) return null;
    const m = heightCm / 100;
    return first.weight_kg / (m * m);
  }, [weights, heightCm]);

  return (
    <View className="gap-4">
      {/* Banner de emergência (permanente) */}
      <View
        style={{ borderCurve: 'continuous' }}
        className="flex-row items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3"
      >
        <Info size={16} color={colors.alert} style={{ marginTop: 1 }} />
        <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-rose-700">
          Em caso de sangramento, dor forte, redução de movimentos do bebê ou qualquer dúvida urgente, contate seu obstetra ou a maternidade imediatamente.
        </Text>
      </View>

      {/* Cabeçalho — idade gestacional */}
      <Card className="flex-row items-center gap-3.5">
        <View
          style={{ borderCurve: 'continuous' }}
          className="h-14 w-14 items-center justify-center rounded-2xl bg-rose-100"
        >
          <Baby size={28} color="#e11d48" />
        </View>
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.displayX }} className="text-[22px] leading-7 text-fg">
            {ga
              ? `${ga.weeks} ${ga.weeks === 1 ? 'semana' : 'semanas'}${ga.days > 0 ? ` e ${ga.days} ${ga.days === 1 ? 'dia' : 'dias'}` : ''}`
              : 'Acompanhamento da gestação'}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            {ga ? (
              <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
                {ORDINAL[ga.trimester] ?? ''} trimestre
              </Text>
            ) : null}
            {remaining != null ? (
              <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
                · faltam {remaining} {remaining === 1 ? 'semana' : 'semanas'}
              </Text>
            ) : null}
            {journey.risk_level ? (
              <Badge tone={journey.risk_level === 'alto' ? 'attention' : 'neutral'}>
                {PREGNANCY_RISK_LABELS[journey.risk_level]}
              </Badge>
            ) : null}
          </View>
        </View>
      </Card>

      {/* Próxima consulta sugerida */}
      {nextConsult ? (
        <Card className="flex-row items-center gap-3">
          <IconCircle icon={CalendarCheck} tone="primary" size={44} />
          <View className="min-w-0 flex-1">
            <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
              Próxima consulta sugerida
            </Text>
            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
              {nextConsult.catalog?.label_pt ?? nextConsult.milestone.milestone_code} · semanas{' '}
              {nextConsult.catalog?.week_min ?? '—'}–{nextConsult.catalog?.week_max ?? '—'}
            </Text>
          </View>
          <Button
            label="Já agendei"
            size="sm"
            loading={toggle.isPending}
            onPress={() =>
              toggle.mutate({
                milestoneId: nextConsult.milestone.id,
                completedAt: new Date().toISOString().slice(0, 10),
              })
            }
          />
        </Card>
      ) : null}

      {/* Ações rápidas */}
      {journey.obstetrician_phone ? (
        <Pressable
          onPress={() => Linking.openURL(`tel:${journey.obstetrician_phone}`)}
          style={{ borderCurve: 'continuous' }}
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3 active:opacity-80"
        >
          <Phone size={16} color={colors.primary} />
          <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg-soft">
            Falar com meu obstetra
          </Text>
        </Pressable>
      ) : null}

      {/* Movimentos fetais (a partir da semana 28) */}
      {currentWeek != null && currentWeek >= FETAL_MOVEMENTS_FROM_WEEK ? (
        <FetalMovementsCard journeyId={journeyId} />
      ) : null}

      {/* Ganho de peso */}
      <WeightGainSection
        weights={weights}
        bmi={bmi}
        currentWeek={currentWeek}
        onLog={(week, kg) => logWeight.mutateAsync({ week, weightKg: kg })}
        pending={logWeight.isPending}
      />

      {/* Timeline do pré-natal */}
      <TrimesterTimeline
        items={items}
        currentWeek={currentWeek}
        onToggle={(milestoneId, completed) =>
          toggle.mutate({
            milestoneId,
            completedAt: completed ? new Date().toISOString().slice(0, 10) : null,
          })
        }
        pending={toggle.isPending}
      />

      <Disclaimer />
    </View>
  );
}

/* ─────────────────────────── Movimentos fetais ─────────────────────────── */

function FetalMovementsCard({ journeyId }: { journeyId: string }) {
  const log = useLogFetalMovement(journeyId);
  const [duration, setDuration] = useState('');
  const [count, setCount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    const dur = duration ? Number(duration) : undefined;
    const cnt = count ? Number(count) : undefined;
    if (dur == null && cnt == null) {
      setError('Informe a duração e/ou o número de movimentos.');
      return;
    }
    if ((dur != null && (Number.isNaN(dur) || dur <= 0)) || (cnt != null && (Number.isNaN(cnt) || cnt <= 0))) {
      setError('Use valores numéricos válidos.');
      return;
    }
    try {
      await log.mutateAsync({
        durationMinutes: dur,
        movementsCount: cnt,
        notes: notes.trim() || undefined,
      });
      setDuration('');
      setCount('');
      setNotes('');
      toast.success('Movimentos do bebê salvos.');
    } catch {
      setError('Não foi possível salvar.');
    }
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2.5">
        <IconCircle icon={Activity} tone="accent" size={40} />
        <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
          Movimentos do bebê
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-5 text-muted">
        Registro pessoal — o app não avalia se os movimentos estão normais. Se perceber redução, contate seu obstetra ou a maternidade.
      </Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input label="Duração (min)" value={duration} onChangeText={setDuration} placeholder="Ex.: 60" keyboardType="numeric" />
        </View>
        <View className="flex-1">
          <Input label="Nº de movimentos" value={count} onChangeText={setCount} placeholder="Ex.: 10" keyboardType="numeric" />
        </View>
      </View>
      <Input label="Observações (opcional)" value={notes} onChangeText={setNotes} error={error ?? undefined} />
      <Button label="Registrar movimentos" icon={Plus} loading={log.isPending} onPress={onSubmit} />
    </Card>
  );
}

/* ─────────────────────────── Ganho de peso ─────────────────────────── */

function WeightGainSection({
  weights,
  bmi,
  currentWeek,
  onLog,
  pending,
}: {
  weights: { week: number; weight_kg: number }[];
  bmi: number | null;
  currentWeek: number | null;
  onLog: (week: number, kg: number) => Promise<unknown>;
  pending: boolean;
}) {
  const colors = useColors();
  const [weekInput, setWeekInput] = useState('');
  const [weightInput, setWeightInput] = useState('');

  const sorted = useMemo(() => [...weights].sort((a, b) => a.week - b.week), [weights]);
  const baseline = sorted[0]?.weight_kg ?? null;

  // Série da gestante: ganho relativo ao primeiro peso (baseline).
  const userPoints = useMemo(() => {
    if (baseline == null) return [];
    return sorted.map((w) => ({ x: w.week, y: Math.round((w.weight_kg - baseline) * 10) / 10 }));
  }, [sorted, baseline]);

  // Faixa IOM (min/max) — só quando há IMC. Cobre da 1ª semana à última registrada.
  const { minPoints, maxPoints } = useMemo(() => {
    if (bmi == null || sorted.length === 0) return { minPoints: [], maxPoints: [] };
    const lastWeek = sorted[sorted.length - 1]?.week ?? 1;
    const min: { x: number; y: number }[] = [];
    const max: { x: number; y: number }[] = [];
    for (let week = 1; week <= Math.max(lastWeek, currentWeek ?? 1); week++) {
      const range = weightGainRange(bmi, week);
      min.push({ x: week, y: range.min });
      max.push({ x: week, y: range.max });
    }
    return { minPoints: min, maxPoints: max };
  }, [bmi, sorted, currentWeek]);

  const series = useMemo(() => {
    const s: { points: { x: number; y: number }[]; color?: string }[] = [];
    if (minPoints.length > 0) s.push({ points: minPoints, color: colors.faint });
    if (maxPoints.length > 0) s.push({ points: maxPoints, color: colors.faint });
    if (userPoints.length > 0) s.push({ points: userPoints, color: '#ec4899' });
    return s;
  }, [minPoints, maxPoints, userPoints]);

  async function addWeight() {
    const week = Number(weekInput || (currentWeek ?? 0));
    const kg = Number(weightInput.replace(',', '.').trim()); // teclado pt-BR usa vírgula
    if (!week || week < 1 || week > 42 || !kg || kg <= 0) {
      toast.info('Informe semana (1–42) e peso válidos.');
      return;
    }
    try {
      await onLog(week, kg);
      setWeightInput('');
      setWeekInput('');
      toast.success('Peso salvo.');
    } catch {
      toast.error('Não foi possível registrar.');
    }
  }

  return (
    <Card className="gap-3">
      <SectionTitle>Ganho de peso</SectionTitle>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Sem registros de peso"
          subtitle="Registre seu peso para ver a evolução comparada à faixa de referência."
        />
      ) : (
        <View>
          <LineChart series={series} height={200} formatY={(n) => `${Math.round(n * 10) / 10}kg`} />
          <Text style={{ fontFamily: fonts.regular }} className="mt-2 text-center text-[11px] text-faint">
            {bmi != null
              ? 'Linhas cinza: faixa de ganho recomendada (IOM 2009). Referência, não julgamento.'
              : 'Informe sua altura no Perfil para ver a faixa recomendada.'}
          </Text>
        </View>
      )}

      <View className="flex-row items-end gap-2">
        <View className="w-24">
          <Input
            label="Semana"
            value={weekInput}
            onChangeText={setWeekInput}
            placeholder={currentWeek != null ? String(currentWeek) : '—'}
            keyboardType="numeric"
          />
        </View>
        <View className="flex-1">
          <Input
            label="Peso (kg)"
            value={weightInput}
            onChangeText={setWeightInput}
            placeholder="68"
            keyboardType="numeric"
          />
        </View>
      </View>
      <Button label="Registrar peso" icon={Plus} loading={pending} onPress={addWeight} />
    </Card>
  );
}

/* ─────────────────────────── Timeline do pré-natal ─────────────────────────── */

const TRIMESTERS = [
  { n: 1 as const, label: '1º trimestre', range: 'até 13 semanas' },
  { n: 2 as const, label: '2º trimestre', range: '14 a 27 semanas' },
  { n: 3 as const, label: '3º trimestre', range: '28 semanas ao parto' },
];

type Status = 'done' | 'current' | 'overdue' | 'upcoming';

function statusOf(item: TimelineItem, currentWeek: number | null): Status {
  if (item.milestone.completed_at) return 'done';
  const c = item.catalog;
  if (!c || currentWeek == null) return 'upcoming';
  if (currentWeek > c.week_max) return 'overdue';
  if (currentWeek >= c.week_min) return 'current';
  return 'upcoming';
}

const STATUS_META: Record<Status, { icon: typeof Check; color: string; label: string }> = {
  done: { icon: Check, color: colors.accent, label: 'Concluído' },
  current: { icon: Clock, color: colors.primary, label: 'Nesta fase' },
  overdue: { icon: Clock, color: colors.attention, label: 'Atrasado' },
  upcoming: { icon: CircleIcon, color: colors.faint, label: 'Em breve' },
};

function TrimesterTimeline({
  items,
  currentWeek,
  onToggle,
  pending,
}: {
  items: TimelineItem[];
  currentWeek: number | null;
  onToggle: (milestoneId: string, completed: boolean) => void;
  pending?: boolean;
}) {
  return (
    <View className="gap-4">
      {TRIMESTERS.map((tri) => {
        const triItems = items.filter((i) => i.catalog?.trimester === tri.n);
        if (triItems.length === 0) return null;
        return (
          <Card key={tri.n} className="gap-1">
            <View className="mb-1 flex-row items-baseline justify-between">
              <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
                {tri.label}
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                {tri.range}
              </Text>
            </View>
            {triItems.map((item, i) => {
              const st = statusOf(item, currentWeek);
              const meta = STATUS_META[st];
              const Icon = meta.icon;
              const c = item.catalog;
              const done = st === 'done';
              const label = c?.label_pt ?? item.milestone.milestone_code;
              return (
                <FadeInItem key={item.milestone.id} index={i}>
                  <Pressable
                    onPress={() => onToggle(item.milestone.id, !done)}
                    disabled={pending}
                    style={{ borderCurve: 'continuous' }}
                    className="flex-row items-start gap-3 rounded-2xl px-1 py-2 active:bg-surface-2"
                  >
                    <View
                      style={{ borderCurve: 'continuous' }}
                      className={`mt-0.5 h-7 w-7 items-center justify-center rounded-full border ${done ? 'border-health-300 bg-health-300/30' : 'border-line'}`}
                    >
                      <Icon size={15} color={meta.color} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text
                        style={{ fontFamily: fonts.medium, textDecorationLine: done ? 'line-through' : 'none' }}
                        className={`text-[14px] ${done ? 'text-muted' : 'text-fg'}`}
                      >
                        {label}
                      </Text>
                      <View className="mt-0.5 flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        {c ? (
                          <Text style={{ fontFamily: fonts.medium }} className="text-[10px] text-muted">
                            {MILESTONE_CATEGORY_LABELS[c.category] ?? c.category} · semanas {c.week_min}–{c.week_max}
                          </Text>
                        ) : null}
                        <Text style={{ fontFamily: fonts.semibold, color: meta.color }} className="text-[10px]">
                          · {meta.label}
                        </Text>
                      </View>
                      {c?.description_short ? (
                        <Text style={{ fontFamily: fonts.regular }} className="mt-0.5 text-[11px] text-faint">
                          {c.description_short}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                </FadeInItem>
              );
            })}
          </Card>
        );
      })}
    </View>
  );
}

/* ─────────────────────────── Disclaimer ─────────────────────────── */

function Disclaimer() {
  const colors = useColors();
  return (
    <View
      style={{ borderCurve: 'continuous' }}
      className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3"
    >
      <Info size={16} color={colors.primary} style={{ marginTop: 1 }} />
      <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
        {PREGNANCY_DISCLAIMER}
      </Text>
    </View>
  );
}
