import { useState, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LineChart as LineIcon, HeartPulse, Droplet, Scale, Smile, Lock, Info, TrendingUp, TrendingDown, Table2, type LucideIcon } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useVitalsRange, useDiaryRange, useProfile, useHasPlusAccess } from '@hubpatients/supabase';
import { computeStats, computeTrendPct, describeGlucoseRange, computeBMI, bmiCategory, type Vital, type SeriesStats } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, EmptyState, ErrorState } from '@/components/ui';
import { toast } from '@/components/toast';
import { LineChart } from '@/components/charts';
import { MoodYearMap } from '@/components/mood-year-map';
import { WeightAlertBanner } from '@/components/weight-alert-banner';
import { HealthSyncCard } from '@/components/health-sync-card';
import { useColors, fonts } from '@/theme';

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 365, label: '1 ano', plus: true },
  { days: 36500, label: 'Tudo', plus: true },
];
const primary = (v: Vital[]) => v.map((x) => x.value_primary);
const ptsOf = (vals: number[]) => vals.map((y, x) => ({ x, y }));
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

type TableColumn = { key: string; label: string };
type TableRow = Record<string, string | number>;

export default function AnaliseScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const pid = user?.id;
  const isPlus = useHasPlusAccess(pid).data ?? false;
  const [days, setDays] = useState(30);

  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await qc.invalidateQueries(); } finally { setRefreshing(false); }
  };

  const { data: profile } = useProfile(pid);
  const { data: bp, isError, refetch } = useVitalsRange(pid, 'blood_pressure', days);
  const { data: glucose } = useVitalsRange(pid, 'glucose', days);
  const { data: weight } = useVitalsRange(pid, 'weight', days);
  const { data: diary } = useDiaryRange(pid, days);

  const bpRows = bp ?? [];
  const glRows = glucose ?? [];
  const wRows = weight ?? [];
  const dRows = diary ?? [];

  const lastWeight = wRows[wRows.length - 1]?.value_primary ?? null;
  const bmi = computeBMI(lastWeight, profile?.height_cm ?? null);
  const bmiCat = bmi ? bmiCategory(bmi) : null;

  const glMax = Math.max(160, ...primary(glRows)) * 1.1;
  const moodPts = dRows.filter((e) => e.mood != null).map((e, x) => ({ x, y: e.mood as number }));
  const energyPts = dRows.filter((e) => e.energy != null).map((e, x) => ({ x, y: e.energy as number }));

  function pick(p: (typeof PERIODS)[number]) {
    if (p.plus && !isPlus) {
      toast.info('🔒 Períodos longos (1 ano / Tudo) fazem parte do plano Plus.');
      return;
    }
    setDays(p.days);
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Análise" subtitle="Evolução da sua saúde no tempo" icon={LineIcon} back />
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        {/* Health Connect (Android): o card se esconde sozinho quando o
            aparelho não tem Health Connect utilizável. Só leitura. */}
        <HealthSyncCard patientId={pid} />

        {/* Período */}
        <View style={{ borderCurve: 'continuous' }} className="flex-row rounded-2xl border border-line bg-surface p-1">
          {PERIODS.map((p) => {
            const active = days === p.days;
            return (
              <Pressable
                key={p.days}
                onPress={() => pick(p)}
                style={{ borderCurve: 'continuous' }}
                className={`flex-1 flex-row items-center justify-center gap-1 rounded-xl py-2 ${active ? 'bg-trust-100' : ''}`}
              >
                <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${active ? 'text-primary' : 'text-muted'}`}>
                  {p.label}
                </Text>
                {p.plus && !isPlus ? <Lock size={11} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>

        {/* Disclaimer */}
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3">
          <Info size={16} color={colors.primary} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
            Informações educativas. Apenas seu médico interpreta seus dados com o contexto completo.
          </Text>
        </View>

        {isError && !bp ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
        {/* Pressão */}
        <ChartCard
          icon={HeartPulse}
          title="Pressão arterial"
          stats={computeStats(primary(bpRows))}
          trend={computeTrendPct(primary(bpRows))}
          unit="mmHg"
          empty={bpRows.length < 2}
          tableColumns={[{ key: 'date', label: 'Data' }, { key: 'sys', label: 'Sistólica' }, { key: 'dia', label: 'Diastólica' }]}
          tableRows={bpRows.map((v) => ({ date: fmtDate(v.measured_at), sys: v.value_primary, dia: v.value_secondary ?? '—' }))}
        >
          <LineChart
            yMin={40}
            yMax={200}
            zones={[
              { from: 40, to: 130, color: colors.ok },
              { from: 130, to: 140, color: colors.attention },
              { from: 140, to: 200, color: colors.alert },
            ]}
            series={[
              { points: ptsOf(bpRows.map((v) => v.value_primary)), color: colors.primary },
              { points: ptsOf(bpRows.map((v) => v.value_secondary ?? 0)), color: colors.accent },
            ]}
          />
          <Legend items={[{ c: colors.primary, t: 'Sistólica' }, { c: colors.accent, t: 'Diastólica' }]} />
        </ChartCard>

        {/* Glicemia */}
        <ChartCard
          icon={Droplet}
          title="Glicemia"
          stats={computeStats(primary(glRows))}
          trend={computeTrendPct(primary(glRows))}
          unit="mg/dL"
          empty={glRows.length < 2}
          note={glRows.length >= 1
            ? `Média registrada: ${(computeStats(primary(glRows))?.avg ?? 0).toFixed(1)} mg/dL (${describeGlucoseRange(computeStats(primary(glRows))?.avg ?? 0)}). O app não sabe se houve jejum e não classifica diagnósticos.`
            : undefined}
          tableColumns={[{ key: 'date', label: 'Data' }, { key: 'value', label: 'mg/dL' }]}
          tableRows={glRows.map((v) => ({ date: fmtDate(v.measured_at), value: v.value_primary }))}
        >
          <LineChart
            yMin={40}
            yMax={glMax}
            series={[{ points: ptsOf(primary(glRows)), color: colors.primary }]}
          />
        </ChartCard>

        {/* Peso e IMC */}
        <ChartCard
          icon={Scale}
          title="Peso e IMC"
          stats={computeStats(primary(wRows))}
          trend={computeTrendPct(primary(wRows))}
          unit="kg"
          empty={wRows.length < 2}
          note={bmi && bmiCat ? `IMC atual: ${bmi.toFixed(1)} · ${bmiCat.label}` : 'Informe sua altura no Perfil para o IMC.'}
          tableColumns={[{ key: 'date', label: 'Data' }, { key: 'value', label: 'kg' }]}
          tableRows={wRows.map((v) => ({ date: fmtDate(v.measured_at), value: v.value_primary }))}
        >
          <WeightAlertBanner weights={wRows.map((v) => ({ date: v.measured_at, kg: v.value_primary }))} />
          <LineChart series={[{ points: ptsOf(primary(wRows)), color: colors.accent }]} formatY={(n) => n.toFixed(0)} />
        </ChartCard>

        {/* Humor e energia */}
        <ChartCard
          icon={Smile}
          title="Humor e energia"
          empty={moodPts.length < 2 && energyPts.length < 2}
          tableColumns={[{ key: 'date', label: 'Data' }, { key: 'mood', label: 'Humor' }, { key: 'energy', label: 'Energia' }]}
          tableRows={dRows.map((e) => ({ date: fmtDate(e.entry_date), mood: e.mood ?? '—', energy: e.energy ?? '—' }))}
        >
          <LineChart
            yMin={0}
            yMax={5}
            series={[
              { points: moodPts, color: colors.brand },
              { points: energyPts, color: colors.attention },
            ]}
          />
          <Legend items={[{ c: colors.brand, t: 'Humor' }, { c: colors.attention, t: 'Energia' }]} />
        </ChartCard>

        <MoodYearMap patientId={pid} />
          </>
        )}
      </Screen>
    </View>
  );
}

function ChartCard({
  icon: Icon,
  title,
  stats,
  trend,
  unit,
  note,
  empty,
  tableColumns,
  tableRows,
  children,
}: {
  icon: LucideIcon;
  title: string;
  stats?: SeriesStats | null;
  trend?: number | null;
  unit?: string;
  note?: string;
  empty?: boolean;
  tableColumns?: TableColumn[];
  tableRows?: TableRow[];
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <Icon size={18} color={colors.primary} />
        <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
          {title}
        </Text>
      </View>
      {empty ? (
        <EmptyState icon={Icon} title="Sem dados no período" subtitle="Registre medidas para ver a evolução." />
      ) : (
        <>
          {children}
          {stats ? (
            <View className="flex-row items-center gap-3">
              <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-fg">
                Média {stats.avg.toFixed(unit === 'kg' ? 1 : 0)} {unit}
              </Text>
              {trend != null ? (
                <View className="flex-row items-center gap-0.5">
                  {trend >= 0 ? (
                    <TrendingUp size={14} color={colors.alert} />
                  ) : (
                    <TrendingDown size={14} color={colors.ok} />
                  )}
                  <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                    {trend >= 0 ? '+' : ''}
                    {trend.toFixed(0)}%
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {note ? (
            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
              {note}
            </Text>
          ) : null}
          {tableColumns && tableRows && tableRows.length > 0 ? (
            <DataTable columns={tableColumns} rows={tableRows} caption={title} />
          ) : null}
        </>
      )}
    </Card>
  );
}

/** Tabela de dados acessível sob cada gráfico (espelha tableRows/tableColumns da web). */
function DataTable({ columns, rows, caption }: { columns: TableColumn[]; rows: TableRow[]; caption: string }) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Tabela de dados: ${caption}, ${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}.`}
      className="mt-1 rounded-xl border border-line bg-surface-2"
    >
      <View className="flex-row items-center gap-1.5 border-b border-line px-3 py-2">
        <Table2 size={13} color={colors.muted} />
        <Text style={{ fontFamily: fonts.medium }} className="text-[11px] text-muted">
          Dados em tabela
        </Text>
      </View>
      {/* Cabeçalho */}
      <View className="flex-row border-b border-line px-3 py-1.5">
        {columns.map((c, ci) => (
          <Text
            key={c.key}
            style={{ fontFamily: fonts.semibold }}
            className={`text-[11px] text-muted ${ci === 0 ? 'flex-1' : 'w-20 text-right'}`}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {/* Linhas */}
      {rows.map((row, ri) => (
        <View
          key={ri}
          className={`flex-row px-3 py-1.5 ${ri < rows.length - 1 ? 'border-b border-line/60' : ''}`}
        >
          {columns.map((c, ci) => (
            <Text
              key={c.key}
              style={{ fontFamily: fonts.regular }}
              className={`text-[12px] text-fg-soft ${ci === 0 ? 'flex-1' : 'w-20 text-right'}`}
            >
              {row[c.key] ?? '—'}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Legend({ items }: { items: { c: string; t: string }[] }) {
  return (
    <View className="flex-row gap-4">
      {items.map((it) => (
        <View key={it.t} className="flex-row items-center gap-1.5">
          <View style={{ backgroundColor: it.c }} className="h-2.5 w-2.5 rounded-full" />
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
            {it.t}
          </Text>
        </View>
      ))}
    </View>
  );
}
