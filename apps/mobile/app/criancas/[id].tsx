import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, type LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import {
  ChevronLeft,
  Baby,
  Plus,
  Syringe,
  Trophy,
  CalendarHeart,
  Info,
  Scale,
  CheckCircle2,
  Check,
} from 'lucide-react-native';
import {
  ageLabel,
  ageInMonths,
  growthMeasurementSchema,
  recordVaccineSchema,
  nextDueVaccines,
  valueAtPercentileForAge,
  percentileForAge,
  GROWTH_INDICATORS,
  PERCENTILE_LINES,
  PERCENTILE_HINT,
  CHILD_MILESTONE_CATEGORY_LABELS,
  type Child,
  type ChildGrowthMeasurement,
  type ChildMilestone,
  type ChildMilestoneCatalog,
  type MilestoneCategory,
  type WhoGrowthStandard,
} from '@hubpatients/core';
import {
  useChild,
  useChildGrowth,
  useAddMeasurement,
  useWhoStandard,
  useChildVaccinations,
  useVaccineSchedule,
  useRecordVaccine,
  useMilestoneCatalog,
  useChildMilestones,
  useMarkMilestone,
} from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Input, Button, EmptyState, SectionTitle, Badge } from '@/components/ui';
import { AppSheet, type AppSheetHandle } from '@/components/sheet';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { useScreenGuard } from '@/components/screen-guard';
import { useColors, fonts } from '@/theme';

type TabKey = 'crescimento' | 'vacinas' | 'marcos' | 'consultas';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'crescimento', label: 'Crescimento' },
  { key: 'vacinas', label: 'Vacinas' },
  { key: 'marcos', label: 'Marcos' },
  { key: 'consultas', label: 'Consultas' },
];

const CHILD_DISCLAIMER_TEXT =
  'Cada criança tem seu ritmo. Estas informações são educativas — em caso de dúvida sobre o crescimento ou o desenvolvimento, fale com o pediatra.';

function ChildDisclaimer() {
  const colors = useColors();
  return (
    <View className="mb-24 flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3">
      <Info size={16} color={colors.primary} style={{ marginTop: 1 }} />
      <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
        {CHILD_DISCLAIMER_TEXT}
      </Text>
    </View>
  );
}

export default function ChildDetailScreen() {
  useScreenGuard('crianca-detalhe');
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: child, isLoading } = useChild(id);
  const [tab, setTab] = useState<TabKey>('crescimento');

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View style={{ paddingTop: insets.top + 10 }} className="bg-bg px-4 pb-3">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={{ borderCurve: 'continuous' }}
            className="h-10 w-10 items-center justify-center rounded-2xl bg-surface-2 active:opacity-70"
          >
            <ChevronLeft size={22} color={colors.fg} />
          </Pressable>
          <View
            style={{ borderCurve: 'continuous' }}
            className="h-12 w-12 items-center justify-center rounded-2xl bg-rose-500"
          >
            <Baby size={24} color="#fff" />
          </View>
          <View className="flex-1">
            <Text style={{ fontFamily: fonts.displayX }} className="text-[22px] text-fg" numberOfLines={1}>
              {child?.full_name ?? 'Criança'}
            </Text>
            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
              {child ? ageLabel(child.birth_date, new Date()) : '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="px-4">
        <View
          accessibilityRole="tablist"
          style={{ borderCurve: 'continuous' }}
          className="flex-row gap-1 rounded-2xl border border-line bg-surface-2 p-1"
        >
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.key }}
              accessibilityLabel={t.label}
              style={{ borderCurve: 'continuous' }}
              className={`flex-1 items-center rounded-xl py-2 ${tab === t.key ? 'bg-trust-100' : ''}`}
            >
              <Text
                style={{ fontFamily: fonts.semibold }}
                className={`text-[12px] ${tab === t.key ? 'text-primary' : 'text-muted'}`}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading || !child ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : tab === 'crescimento' ? (
        <GrowthTab child={child} />
      ) : tab === 'vacinas' ? (
        <VaccinesTab child={child} />
      ) : tab === 'marcos' ? (
        <MilestonesTab child={child} />
      ) : (
        <View className="flex-1 px-4 pt-4">
          <EmptyState
            icon={CalendarHeart}
            title="Consultas"
            subtitle="Esta aba chega na próxima atualização do app."
          />
          <View className="mt-4">
            <ChildDisclaimer />
          </View>
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────── Crescimento ─────────────────────────── */

/** Valor medido da criança para o indicador OMS selecionado. */
function measuredValue(indicatorKey: string, m: ChildGrowthMeasurement): number | null {
  switch (indicatorKey) {
    case 'wfa':
      return m.weight_kg;
    case 'lhfa':
      return m.length_or_height_cm;
    case 'bfa':
      return m.bmi;
    case 'hcfa':
      return m.head_circumference_cm;
    default:
      return null;
  }
}

function GrowthTab({ child }: { child: Child }) {
  const colors = useColors();
  const { data: measurements, isLoading } = useChildGrowth(child.id);
  const add = useAddMeasurement(child.id);

  const [indicatorKey, setIndicatorKey] = useState(GROWTH_INDICATORS[0]!.key);
  const indicator = GROWTH_INDICATORS.find((i) => i.key === indicatorKey) ?? GROWTH_INDICATORS[0]!;
  const { data: whoStandard, isLoading: whoLoading, isError: whoError } = useWhoStandard(indicatorKey, child.sex);

  const [date, setDate] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [head, setHead] = useState('');
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState(false);
  const formSheetRef = useRef<AppSheetHandle>(null);

  const list = measurements ?? [];

  async function onAdd() {
    // Teclado decimal pt-BR gera vírgula ("8,4"); normaliza p/ z.coerce.number() não virar NaN.
    const dec = (v: string) => (v.trim() === '' ? undefined : v.replace(',', '.').trim());
    const parsed = growthMeasurementSchema.safeParse({
      measuredAt: date || undefined,
      weightKg: dec(weight),
      lengthOrHeightCm: dec(height),
      headCircumferenceCm: dec(head),
      notes: notes || undefined,
    });
    if (!parsed.success) {
      toast.info(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    const refDate = date || new Date().toISOString().slice(0, 10);
    try {
      await add.mutateAsync({
        ageMonths: ageInMonths(child.birth_date, refDate),
        input: {
          measuredAt: date || undefined,
          weightKg: parsed.data.weightKg,
          lengthOrHeightCm: parsed.data.lengthOrHeightCm,
          headCircumferenceCm: parsed.data.headCircumferenceCm,
          notes: parsed.data.notes,
        },
      });
      toast.success('Medida registrada.');
      setDate('');
      setWeight('');
      setHeight('');
      setHead('');
      setNotes('');
      formSheetRef.current?.close();
    } catch {
      toast.error('Não foi possível registrar a medida.');
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          {/* Seletor de indicador */}
          <View
            accessibilityRole="tablist"
            accessibilityLabel="Indicador de crescimento"
            style={{ borderCurve: 'continuous' }}
            className="flex-row gap-1 rounded-2xl border border-line bg-surface-2 p-1"
          >
            {GROWTH_INDICATORS.map((ind) => (
              <Pressable
                key={ind.key}
                onPress={() => setIndicatorKey(ind.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: ind.key === indicatorKey }}
                accessibilityLabel={ind.label}
                style={{ borderCurve: 'continuous' }}
                className={`flex-1 items-center rounded-xl py-2 ${ind.key === indicatorKey ? 'bg-trust-100' : ''}`}
              >
                <Text
                  style={{ fontFamily: fonts.semibold }}
                  className={`text-[11px] ${ind.key === indicatorKey ? 'text-primary' : 'text-muted'}`}
                >
                  {ind.shortLabel}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Gráfico OMS */}
          <Card className="gap-2">
            <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
              {indicator.label}
            </Text>
            {whoLoading ? (
              <View className="py-10 items-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : whoError ? (
              <Text style={{ fontFamily: fonts.regular }} className="py-6 text-center text-[13px] text-muted">
                Não foi possível carregar as curvas de referência da OMS.
              </Text>
            ) : (
              <WhoGrowthChart
                whoStandard={whoStandard ?? []}
                measurements={list}
                indicatorKey={indicatorKey}
                ageRange={indicator.ageRange}
                unit={indicator.unit}
              />
            )}
            <Text style={{ fontFamily: fonts.regular }} className="mt-1 text-center text-[11px] text-faint">
              Linhas cinza: percentis da OMS (P3–P97). Pontos azuis: medidas da criança.
            </Text>
            <Text style={{ fontFamily: fonts.regular }} className="text-center text-[11px] leading-4 text-faint">
              {PERCENTILE_HINT}
            </Text>
          </Card>

          <View className="flex-row items-center justify-between">
            <SectionTitle>Medidas registradas</SectionTitle>
            <Button label="Nova medida" size="sm" icon={Plus} onPress={() => setOpen(true)} />
          </View>

          {list.length === 0 ? (
            <EmptyState icon={Scale} title="Nenhuma medida registrada" subtitle="Toque em Nova medida para começar." />
          ) : (
            <View className="gap-2">
              {list.map((m, i) => (
                <FadeInItem key={m.id} index={i}>
                  <Card className="flex-row items-center gap-3">
                    <View className="flex-1">
                      <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                        {new Date(m.measured_at).toLocaleDateString('pt-BR')}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                        {m.age_months_at_measurement} meses
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap justify-end gap-1.5">
                      {m.weight_kg != null ? <Badge tone="info">{m.weight_kg} kg</Badge> : null}
                      {m.length_or_height_cm != null ? <Badge tone="ok">{m.length_or_height_cm} cm</Badge> : null}
                      {m.head_circumference_cm != null ? (
                        <Badge tone="neutral">{m.head_circumference_cm} cm PC</Badge>
                      ) : null}
                    </View>
                  </Card>
                </FadeInItem>
              ))}
            </View>
          )}

          <ChildDisclaimer />
        </>
      )}

      {/* Form "nova medida" em bottom sheet */}
      {open ? (
        <AppSheet ref={formSheetRef} onClose={() => setOpen(false)} title="Nova medida">
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            <View className="gap-3">
              <Input label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} placeholder="hoje se vazio" />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input label="Peso (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="8.4" />
                </View>
                <View className="flex-1">
                  <Input label="Altura (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="72" />
                </View>
              </View>
              <Input label="P. cefálico (cm)" value={head} onChangeText={setHead} keyboardType="decimal-pad" placeholder="45" />
              <Input label="Observações (opcional)" value={notes} onChangeText={setNotes} placeholder="—" />
              <Button label="Salvar medida" icon={Scale} loading={add.isPending} onPress={onAdd} />
            </View>
          </ScrollView>
        </AppSheet>
      ) : null}
    </ScrollView>
  );
}

/** Curva de crescimento da OMS (percentis) + medidas da criança, em react-native-svg. */
function WhoGrowthChart({
  whoStandard,
  measurements,
  indicatorKey,
  ageRange,
  unit,
}: {
  whoStandard: WhoGrowthStandard[];
  measurements: ChildGrowthMeasurement[];
  indicatorKey: string;
  ageRange: [number, number];
  unit: string;
}) {
  const colors = useColors();
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const whoPoints = useMemo(
    () => whoStandard.map((p) => ({ x: p.x, l: p.l, m: p.m, s: p.s })),
    [whoStandard],
  );

  const childPoints = useMemo(
    () =>
      measurements
        .map((m) => {
          const value = measuredValue(indicatorKey, m);
          return value != null ? { x: m.age_months_at_measurement, y: value } : null;
        })
        .filter((p): p is { x: number; y: number } => p !== null)
        .sort((a, b) => a.x - b.x),
    [measurements, indicatorKey],
  );

  // Curvas de percentil: 1 ponto por mês na faixa etária do indicador.
  const percentileSeries = useMemo(() => {
    const [min, max] = ageRange;
    if (whoPoints.length === 0) return [];
    return PERCENTILE_LINES.map((p) => {
      const pts: { x: number; y: number }[] = [];
      for (let x = min; x <= max; x++) {
        const v = valueAtPercentileForAge(p, x, whoPoints);
        if (v != null && Number.isFinite(v)) pts.push({ x, y: v });
      }
      return { percentile: p, pts };
    }).filter((s) => s.pts.length >= 2);
  }, [whoPoints, ageRange]);

  const H = 220;
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 20;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = H - padT - padB;

  if (whoPoints.length === 0) {
    return (
      <Text style={{ fontFamily: fonts.regular }} className="py-6 text-center text-[13px] text-muted">
        Sem dados de referência para este indicador.
      </Text>
    );
  }

  // Domínio do eixo Y: cobre percentis + medidas da criança.
  const allY = [
    ...percentileSeries.flatMap((s) => s.pts.map((p) => p.y)),
    ...childPoints.map((p) => p.y),
  ];
  const minY = allY.length ? Math.min(...allY) * 0.95 : 0;
  const maxY = allY.length ? Math.max(...allY) * 1.05 : 1;
  const [minX, maxX] = ageRange;

  const sx = (x: number) => padL + (maxX === minX ? 0.5 : (x - minX) / (maxX - minX)) * innerW;
  const sy = (y: number) => padT + (1 - (maxY === minY ? 0.5 : (y - minY) / (maxY - minY))) * innerH;

  const polyD = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x)},${sy(p.y)}`).join(' ');

  // Idade atual da última medida → percentil aproximado (rótulo educativo).
  const lastChild = childPoints[childPoints.length - 1];
  const lastPct = lastChild ? percentileForAge(lastChild.y, lastChild.x, whoPoints) : null;

  const yLabels = [maxY, (maxY + minY) / 2, minY];
  const xTicks = [minX, Math.round((minX + maxX) / 2), maxX];

  return (
    <View onLayout={onLayout}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          {/* Grade horizontal + rótulos do eixo Y */}
          {yLabels.map((v, i) => (
            <SvgLine
              key={`g${i}`}
              x1={padL}
              y1={sy(v)}
              x2={padL + innerW}
              y2={sy(v)}
              stroke={colors.line}
              strokeWidth={1}
              opacity={0.7}
            />
          ))}
          {yLabels.map((v, i) => (
            <SvgText key={`y${i}`} x={padL - 5} y={sy(v) + 3} fontSize={9} fill={colors.muted} textAnchor="end">
              {Math.round(v * 10) / 10}
            </SvgText>
          ))}

          {/* Rótulos do eixo X (meses) */}
          {xTicks.map((x, i) => (
            <SvgText
              key={`x${i}`}
              x={sx(x)}
              y={H - 6}
              fontSize={9}
              fill={colors.muted}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
            >
              {x}
            </SvgText>
          ))}
          <SvgText x={padL + innerW} y={padT + 8} fontSize={9} fill={colors.faint} textAnchor="end">
            meses
          </SvgText>

          {/* Curvas de percentil (referência cinza; P50 mais marcada) */}
          {percentileSeries.map((s) => {
            const isMedian = s.percentile === 50;
            return (
              <Path
                key={`p${s.percentile}`}
                d={polyD(s.pts)}
                fill="none"
                stroke={isMedian ? colors.faint : colors.line}
                strokeWidth={isMedian ? 1.5 : 1}
                strokeDasharray={isMedian ? undefined : '4 4'}
                strokeLinejoin="round"
                opacity={isMedian ? 0.9 : 0.8}
              />
            );
          })}

          {/* Rótulos PXX à direita da curva */}
          {percentileSeries.map((s) => {
            const last = s.pts[s.pts.length - 1];
            if (!last) return null;
            return (
              <SvgText
                key={`pl${s.percentile}`}
                x={sx(last.x) - 2}
                y={sy(last.y) - 2}
                fontSize={8}
                fill={colors.faint}
                textAnchor="end"
              >
                P{s.percentile}
              </SvgText>
            );
          })}

          {/* Medidas da criança (linha + pontos destacados) */}
          {childPoints.length >= 2 ? (
            <Path d={polyD(childPoints)} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          ) : null}
          {childPoints.map((p, i) => (
            <Circle key={`c${i}`} cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill={colors.primary} />
          ))}
        </Svg>
      ) : (
        <View style={{ height: H }} />
      )}

      {childPoints.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular }} className="py-2 text-center text-[12px] text-muted">
          Registre medidas para posicionar a criança na curva.
        </Text>
      ) : lastPct != null ? (
        <Text style={{ fontFamily: fonts.regular }} className="mt-1 text-center text-[12px] text-fg-soft">
          Última medida: {lastChild?.y} {unit} · próximo de P{lastPct}
        </Text>
      ) : null}
    </View>
  );
}

/* ─────────────────────────── Vacinas ─────────────────────────── */

const VAX_STATUS: Record<'overdue' | 'due' | 'upcoming', { label: string; tone: 'alert' | 'attention' | 'ok' }> = {
  overdue: { label: 'Em atraso', tone: 'alert' },
  due: { label: 'Para agora', tone: 'attention' },
  upcoming: { label: 'A seguir', tone: 'ok' },
};

function ageLabelMonths(months: number): string {
  if (months === 0) return 'Ao nascer';
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} ${years === 1 ? 'ano' : 'anos'}`;
  return rest > 0 ? `${y} e ${rest} ${rest === 1 ? 'mês' : 'meses'}` : y;
}

function VaccinesTab({ child }: { child: Child }) {
  const colors = useColors();
  const { user } = useAuth();
  const { data: vaccinations, isLoading, isError } = useChildVaccinations(child.id);
  const { data: schedule, isLoading: schedLoading } = useVaccineSchedule();
  const record = useRecordVaccine(child.id, user?.id ?? '');

  const [open, setOpen] = useState(false);
  const [vaccineName, setVaccineName] = useState('');
  const [doseLabel, setDoseLabel] = useState('');
  const [appliedAt, setAppliedAt] = useState('');
  const [lot, setLot] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [location, setLocation] = useState('');
  const sheetRef = useRef<AppSheetHandle>(null);

  const applied = vaccinations ?? [];

  const appliedCodes = useMemo(
    () => applied.map((v) => v.dose_label ?? v.vaccine_name).filter((c): c is string => Boolean(c)),
    [applied],
  );

  const dueMeta = useMemo(() => {
    if (!schedule) return [];
    const due = nextDueVaccines(
      child.birth_date,
      appliedCodes,
      schedule.map((s) => ({ code: s.code, recommended_age_months: s.recommended_age_months })),
      new Date(),
    );
    return due
      .map((d) => {
        const meta = schedule.find((s) => s.code === d.code);
        return meta ? { ...d, label_pt: meta.label_pt, dose_label: meta.dose_label } : null;
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }, [schedule, appliedCodes, child.birth_date]);

  const nextCode = dueMeta[0]?.code;

  function openFor(labelPt?: string, dose?: string, recommendedMonths?: number) {
    setVaccineName(labelPt ?? '');
    setDoseLabel(dose ?? '');
    setAppliedAt('');
    setLot('');
    setManufacturer('');
    setLocation('');
    setOpen(true);
    // recommendedMonths é só contexto visual; não preenche nada além do nome/dose.
    void recommendedMonths;
  }

  async function onRecord() {
    const parsed = recordVaccineSchema.safeParse({
      vaccineName,
      doseLabel: doseLabel || undefined,
      appliedAt: appliedAt || undefined,
      lot: lot || undefined,
      manufacturer: manufacturer || undefined,
      location: location || undefined,
    });
    if (!parsed.success) {
      toast.info(parsed.error.issues[0]?.message ?? 'Confira os dados.');
      return;
    }
    try {
      await record.mutateAsync({
        vaccineName: parsed.data.vaccineName,
        doseLabel: parsed.data.doseLabel,
        appliedAt: appliedAt || undefined,
        lot: parsed.data.lot,
        manufacturer: parsed.data.manufacturer,
        location: parsed.data.location,
      });
      toast.success('Vacina registrada.');
      sheetRef.current?.close();
    } catch {
      toast.error('Não foi possível registrar a vacina.');
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {isLoading || schedLoading ? (
        <View className="py-10 items-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <Text style={{ fontFamily: fonts.regular }} className="py-10 text-center text-[13px] text-muted">
          Não foi possível carregar as vacinas.
        </Text>
      ) : (
        <>
          <View className="flex-row items-center justify-between">
            <SectionTitle>Calendário vacinal (PNI)</SectionTitle>
            <Button label="Registrar" size="sm" icon={Plus} onPress={() => openFor()} />
          </View>

          {/* Pendentes / próximas */}
          {dueMeta.length > 0 ? (
            <View className="gap-2">
              {dueMeta.map((v, i) => {
                const meta = VAX_STATUS[v.status];
                const isNext = v.code === nextCode;
                return (
                  <FadeInItem key={v.code} index={i}>
                    <Card className={`flex-row items-center gap-3 ${isNext ? 'border-trust-100' : ''}`}>
                      <View
                        style={{ borderCurve: 'continuous' }}
                        className="h-10 w-10 items-center justify-center rounded-2xl bg-surface-2"
                      >
                        <Syringe size={20} color={colors.primary} />
                      </View>
                      <View className="flex-1">
                        <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg" numberOfLines={1}>
                          {v.label_pt}
                          {v.dose_label ? ` · ${v.dose_label}` : ''}
                        </Text>
                        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                          Recomendada: {ageLabelMonths(v.recommended_age_months)}
                        </Text>
                      </View>
                      <View className="items-end gap-1.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <Pressable
                          onPress={() => openFor(v.label_pt, v.dose_label, v.recommended_age_months)}
                          accessibilityRole="button"
                          accessibilityLabel={`Registrar ${v.label_pt}`}
                          hitSlop={6}
                        >
                          <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-primary">
                            Registrar
                          </Text>
                        </Pressable>
                      </View>
                    </Card>
                  </FadeInItem>
                );
              })}
            </View>
          ) : (
            <EmptyState icon={Syringe} title="Nenhuma dose pendente" subtitle="Não há doses pendentes no calendário registrado." />
          )}

          {/* Aplicadas */}
          <SectionTitle>Vacinas registradas</SectionTitle>
          {applied.length === 0 ? (
            <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
              Nenhuma vacina registrada ainda.
            </Text>
          ) : (
            <View className="gap-2">
              {applied.map((v, i) => (
                <FadeInItem key={v.id} index={i}>
                  <Card className="flex-row items-center gap-3">
                    <CheckCircle2 size={18} color={colors.accent} />
                    <View className="flex-1">
                      <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg" numberOfLines={1}>
                        {v.vaccine_name}
                        {v.dose_label ? ` · ${v.dose_label}` : ''}
                      </Text>
                      {v.applied_at ? (
                        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                          {new Date(v.applied_at).toLocaleDateString('pt-BR')}
                        </Text>
                      ) : null}
                    </View>
                  </Card>
                </FadeInItem>
              ))}
            </View>
          )}

          <ChildDisclaimer />
        </>
      )}

      {/* Form "registrar vacina" */}
      {open ? (
        <AppSheet ref={sheetRef} onClose={() => setOpen(false)} title="Registrar vacina">
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            <View className="gap-3">
              <Input label="Vacina" value={vaccineName} onChangeText={setVaccineName} placeholder="Ex.: Pentavalente" />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input label="Dose (opcional)" value={doseLabel} onChangeText={setDoseLabel} placeholder="Ex.: 1ª dose" />
                </View>
                <View className="flex-1">
                  <Input label="Data (AAAA-MM-DD)" value={appliedAt} onChangeText={setAppliedAt} placeholder="hoje se vazio" />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input label="Lote (opcional)" value={lot} onChangeText={setLot} />
                </View>
                <View className="flex-1">
                  <Input label="Fabricante (opcional)" value={manufacturer} onChangeText={setManufacturer} />
                </View>
              </View>
              <Input label="Local (opcional)" value={location} onChangeText={setLocation} placeholder="Ex.: UBS Central" />
              <Button label="Registrar vacina" icon={Syringe} loading={record.isPending} onPress={onRecord} />
            </View>
          </ScrollView>
        </AppSheet>
      ) : null}
    </ScrollView>
  );
}

/* ─────────────────────────── Marcos ─────────────────────────── */

const CATEGORY_ORDER: MilestoneCategory[] = ['motor', 'language', 'social', 'cognitive'];

function typicalAgeLabel(min: number, max: number): string {
  const fmt = (m: number) => {
    if (m < 12) return `${m} m`;
    const y = Math.floor(m / 12);
    const r = m % 12;
    return r > 0 ? `${y}a${r}m` : `${y}a`;
  };
  return min === max ? `~${fmt(min)}` : `${fmt(min)}–${fmt(max)}`;
}

function MilestonesTab({ child }: { child: Child }) {
  const colors = useColors();
  const { data: catalog, isLoading: catalogLoading, isError: catalogError } = useMilestoneCatalog();
  const { data: milestones, isLoading: milestonesLoading, isError: milestonesError } = useChildMilestones(child.id);
  const mark = useMarkMilestone(child.id);

  const achievedMap = useMemo(() => {
    const map = new Map<string, ChildMilestone>();
    for (const m of milestones ?? []) {
      if (m.achieved_at) map.set(m.milestone_code, m);
    }
    return map;
  }, [milestones]);

  const byCategory = useMemo(() => {
    const groups = new Map<MilestoneCategory, ChildMilestoneCatalog[]>();
    for (const c of catalog ?? []) {
      const arr = groups.get(c.category) ?? [];
      arr.push(c);
      groups.set(c.category, arr);
    }
    return groups;
  }, [catalog]);

  function onToggle(item: ChildMilestoneCatalog) {
    const current = achievedMap.get(item.code);
    const achievedAt = current ? null : new Date().toISOString().slice(0, 10);
    mark.mutate(
      { code: item.code, achievedAt },
      {
        onSuccess: () => toast.success(achievedAt ? 'Marco registrado.' : 'Marco desmarcado.'),
        onError: () => toast.error('Não foi possível salvar.'),
      },
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {catalogLoading || milestonesLoading ? (
        <View className="py-10 items-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : catalogError || milestonesError ? (
        <Text style={{ fontFamily: fonts.regular }} className="py-10 text-center text-[13px] text-muted">
          Não foi possível carregar os marcos do desenvolvimento.
        </Text>
      ) : (catalog ?? []).length === 0 ? (
        <EmptyState icon={Trophy} title="Sem marcos disponíveis" subtitle="O catálogo de marcos ainda não está disponível." />
      ) : (
        <>
          <View className="rounded-2xl border border-line bg-surface-2 px-3 py-2.5">
            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-5 text-muted">
              As faixas etárias são típicas, não rígidas. Cada criança tem seu próprio ritmo.
            </Text>
          </View>

          {CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => (
            <View key={cat} className="gap-2">
              <SectionTitle>{CHILD_MILESTONE_CATEGORY_LABELS[cat]}</SectionTitle>
              {(byCategory.get(cat) ?? []).map((item, i) => {
                const achieved = achievedMap.get(item.code) ?? null;
                const isDone = achieved != null;
                return (
                  <FadeInItem key={item.code} index={i}>
                    <Pressable
                      onPress={() => onToggle(item)}
                      disabled={mark.isPending}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isDone, disabled: mark.isPending }}
                      accessibilityLabel={
                        isDone ? `Desmarcar: ${item.label_pt}` : `Marcar como atingido: ${item.label_pt}`
                      }
                    >
                      <Card className="flex-row items-center gap-3">
                        <View
                          style={{ borderCurve: 'continuous' }}
                          className={`h-11 w-11 items-center justify-center rounded-2xl border ${
                            isDone ? 'border-health-300 bg-health-300/30' : 'border-line bg-surface-2'
                          }`}
                        >
                          <Check size={20} color={isDone ? colors.accent : colors.faint} />
                        </View>
                        <View className="flex-1">
                          <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                            {item.label_pt}
                          </Text>
                          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                            Faixa típica: {typicalAgeLabel(item.typical_age_months_min, item.typical_age_months_max)}
                            {achieved?.achieved_at
                              ? ` · atingido em ${new Date(achieved.achieved_at).toLocaleDateString('pt-BR')}`
                              : ''}
                          </Text>
                          {item.description_short ? (
                            <Text style={{ fontFamily: fonts.regular }} className="mt-0.5 text-[11px] text-faint">
                              {item.description_short}
                            </Text>
                          ) : null}
                        </View>
                      </Card>
                    </Pressable>
                  </FadeInItem>
                );
              })}
            </View>
          ))}

          <ChildDisclaimer />
        </>
      )}
    </ScrollView>
  );
}
