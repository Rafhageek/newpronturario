'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Activity, Droplet, HeartPulse, Lock, Scale, Smile } from 'lucide-react';
import { useVitalsRange, useDiaryRange, useProfile } from '@hubpatients/supabase';
import {
  bmiCategory,
  computeBMI,
  computeStats,
  computeTrendPct,
  DISCLAIMERS,
  describeGlucoseRange,
  type Vital,
} from '@hubpatients/core';
import { useActiveProfile } from '@/components/profile-context';
import { ExamDisclaimer } from '@/components/exams/exam-disclaimer';
import { ChartCard } from '@/components/analise/chart-card';
import { StatSummary } from '@/components/analise/stat-summary';
import { WeightAlertBanner } from '@/components/analise/weight-alert-banner';
import { UpgradeModal } from '@/components/ui/upgrade-modal';
import { PageHeader } from '@/components/ui/painel';

const chartLoading = () => (
  <div className="flex h-48 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm text-muted" role="status">
    Carregando gráfico…
  </div>
);
const BloodPressureChart = dynamic(
  () => import('@/components/dashboard/bp-chart').then((module) => module.BloodPressureChart),
  { ssr: false, loading: chartLoading },
);
const GlucoseChart = dynamic(
  () => import('@/components/analise/glucose-chart').then((module) => module.GlucoseChart),
  { ssr: false, loading: chartLoading },
);
const WeightChart = dynamic(
  () => import('@/components/analise/weight-chart').then((module) => module.WeightChart),
  { ssr: false, loading: chartLoading },
);
const MoodEnergyChart = dynamic(
  () => import('@/components/analise/mood-energy-chart').then((module) => module.MoodEnergyChart),
  { ssr: false, loading: chartLoading },
);
const MoodYearMap = dynamic(
  () => import('@/components/analise/mood-year-map').then((module) => module.MoodYearMap),
  { ssr: false, loading: chartLoading },
);

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 365, label: '1 ano', plus: true },
  { days: 36500, label: 'Tudo', plus: true },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const primary = (v: Vital[]) => v.map((x) => x.value_primary);

export default function AnalisePage() {
  const { patientId } = useActiveProfile();
  const isPlus = false;
  const [days, setDays] = useState(30);
  const [upgrade, setUpgrade] = useState(false);

  const { data: profile } = useProfile(patientId || undefined);
  const { data: bp } = useVitalsRange(patientId || undefined, 'blood_pressure', days);
  const { data: glucose } = useVitalsRange(patientId || undefined, 'glucose', days);
  const { data: weight } = useVitalsRange(patientId || undefined, 'weight', days);
  const { data: diary } = useDiaryRange(patientId || undefined, days);

  const bpRows = bp ?? [];
  const glucoseRows = glucose ?? [];
  const weightRows = weight ?? [];
  const diaryRows = diary ?? [];

  // IMC pelo último peso + altura do perfil
  const lastWeight = weightRows[weightRows.length - 1]?.value_primary ?? null;
  const bmi = computeBMI(lastWeight, profile?.height_cm ?? null);
  const bmiCat = bmi ? bmiCategory(bmi) : null;

  const bpSysStats = useMemo(() => computeStats(primary(bpRows)), [bpRows]);
  const glucoseStats = useMemo(() => computeStats(primary(glucoseRows)), [glucoseRows]);
  const weightStats = useMemo(() => computeStats(primary(weightRows)), [weightRows]);

  function pickPeriod(p: (typeof PERIODS)[number]) {
    if (p.plus && !isPlus) {
      setUpgrade(true);
      return;
    }
    setDays(p.days);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 hp-page hp-page--wellbeing">
      <PageHeader
        eyebrow="Indicadores"
        title="Análise da sua saúde"
        subtitle="Compare seus registros ao longo do tempo sem transformar tendências em diagnóstico."
        icon={Activity}
        tone="turquesa"
      />

      {/* Período */}
      <div className="flex flex-wrap rounded-xl border border-line bg-surface p-1">
        {PERIODS.map((p) => {
          const active = days === p.days;
          const locked = p.plus && !isPlus;
          return (
            <button
              key={p.days}
              onClick={() => pickPeriod(p)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'}`}
            >
              {p.label}
              {locked && <Lock className="h-3 w-3 text-primary" />}
            </button>
          );
        })}
      </div>

      <ExamDisclaimer />

      {/* Pressão arterial */}
      <ChartCard
        icon={HeartPulse}
        title="Pressão arterial"
        ariaLabel={`Gráfico de pressão arterial nos últimos ${days} dias`}
        summary={<StatSummary stats={bpSysStats} trendPct={computeTrendPct(primary(bpRows))} unit="mmHg" label="pressão sistólica" />}
        tableColumns={[{ key: 'date', label: 'Data' }, { key: 'sys', label: 'Sistólica' }, { key: 'dia', label: 'Diastólica' }]}
        tableRows={bpRows.map((v) => ({ date: fmtDate(v.measured_at), sys: v.value_primary, dia: v.value_secondary ?? '—' }))}
      >
        <BloodPressureChart vitals={bpRows} />
      </ChartCard>

      {/* Glicemia */}
      <ChartCard
        icon={Droplet}
        title="Glicemia"
        ariaLabel={`Gráfico dos registros de glicemia nos últimos ${days} dias`}
        summary={
          <div className="space-y-1">
            <StatSummary stats={glucoseStats} trendPct={computeTrendPct(primary(glucoseRows))} unit="mg/dL" label="glicemia" />
            {glucoseStats && (
              <p className="text-xs text-muted">
                Média registrada: {glucoseStats.avg.toFixed(1)} mg/dL ({describeGlucoseRange(glucoseStats.avg)}).
                O app não sabe se as medições foram feitas em jejum e não classifica diagnósticos.
              </p>
            )}
          </div>
        }
        tableColumns={[{ key: 'date', label: 'Data' }, { key: 'value', label: 'mg/dL' }]}
        tableRows={glucoseRows.map((v) => ({ date: fmtDate(v.measured_at), value: v.value_primary }))}
      >
        <GlucoseChart vitals={glucoseRows} />
      </ChartCard>

      {/* Peso e IMC */}
      <ChartCard
        icon={Scale}
        title="Peso e IMC"
        ariaLabel={`Gráfico de peso nos últimos ${days} dias`}
        summary={
          <div className="space-y-1.5">
            <StatSummary stats={weightStats} trendPct={computeTrendPct(primary(weightRows))} unit="kg" label="peso" />
            {bmi && bmiCat ? (
              <p className="text-xs">
                <span className="text-muted">IMC atual: </span>
                <span className="font-semibold text-fg">{bmi.toFixed(1)}</span>{' '}
                {/* Classificação de IMC é leitura do CORPO: vai em tinta neutra,
                    não em semáforo (verde/âmbar/vermelho = diagnóstico
                    disfarçado — e ainda reprovavam em contraste: 2,41 / 2,04 /
                    3,57:1). O rótulo em palavras já carrega o significado. */}
                <span className="text-status-neutro-ink">· {bmiCat.label}</span>
              </p>
            ) : (
              <p className="text-xs text-muted">Informe sua altura no Perfil para calcular o IMC.</p>
            )}
          </div>
        }
        tableColumns={[{ key: 'date', label: 'Data' }, { key: 'value', label: 'kg' }]}
        tableRows={weightRows.map((v) => ({ date: fmtDate(v.measured_at), value: v.value_primary }))}
      >
        <WeightAlertBanner weights={weightRows.map((v) => ({ date: v.measured_at, kg: v.value_primary }))} />
        <WeightChart vitals={weightRows} />
      </ChartCard>

      {/* Humor e energia */}
      <ChartCard
        icon={Smile}
        title="Humor e energia"
        ariaLabel={`Gráfico de humor e energia do diário nos últimos ${days} dias`}
        summary={
          <p className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Acompanhe como seu bem-estar se relaciona com os sinais vitais.
          </p>
        }
        tableColumns={[{ key: 'date', label: 'Data' }, { key: 'mood', label: 'Humor' }, { key: 'energy', label: 'Energia' }]}
        tableRows={diaryRows.map((e) => ({ date: fmtDate(e.entry_date), mood: e.mood ?? '—', energy: e.energy ?? '—' }))}
      >
        <MoodEnergyChart entries={diaryRows} />
      </ChartCard>

      <MoodYearMap patientId={patientId || undefined} />

      <p className="text-center text-xs text-muted">{DISCLAIMERS.notDiagnosis}</p>

      <UpgradeModal open={upgrade} reason="unlimited_history" onClose={() => setUpgrade(false)} />
    </div>
  );
}
