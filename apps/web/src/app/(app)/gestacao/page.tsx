'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Activity, CalendarCheck, Phone, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProfile,
  useActivePregnancy,
  usePregnancyTimeline,
  useSetMilestoneCompleted,
  useWeightLog,
  useLogWeight,
} from '@hubpatients/supabase';
import { calculateGestationalAge, FETAL_MOVEMENTS_FROM_WEEK } from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { PregnancyOnboarding } from '@/components/pregnancy/pregnancy-onboarding';
import { GestationalAgeHeader } from '@/components/pregnancy/gestational-age-header';
import { TrimesterTimeline } from '@/components/pregnancy/trimester-timeline';
import { FetalMovementsModal } from '@/components/pregnancy/fetal-movements-modal';
import { EmergencyContactBanner } from '@/components/pregnancy/emergency-contact-banner';
import { PregnancyDisclaimer } from '@/components/pregnancy/pregnancy-disclaimer';

const WeightGainChart = dynamic(
  () => import('@/components/pregnancy/weight-gain-chart').then((module) => module.WeightGainChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 animate-pulse rounded-xl bg-surface-2" role="status">
        <span className="sr-only">Carregando gráfico de evolução do peso</span>
      </div>
    ),
  },
);

export default function GestacaoPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: profile } = useProfile(user?.id);
  const { data: journey, isLoading } = useActivePregnancy(user?.id);

  if (isLoading) {
    return <div className="mx-auto max-w-3xl"><div className="h-40 animate-pulse rounded-2xl bg-surface-2" /></div>;
  }

  // Guarda de acesso: recurso para a própria gestante.
  if (profile && profile.biological_sex !== 'female') {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-sm text-muted">O acompanhamento de gestação fica disponível no seu próprio perfil.</p>
      </div>
    );
  }

  if (!journey) {
    return <PregnancyOnboarding userId={userId} />;
  }

  return <PregnancyDashboard journeyId={journey.id} journey={journey} heightCm={profile?.height_cm ?? null} />;
}

function PregnancyDashboard({
  journeyId,
  journey,
  heightCm,
}: {
  journeyId: string;
  journey: NonNullable<ReturnType<typeof useActivePregnancy>['data']>;
  heightCm: number | null;
}) {
  const { data: timeline } = usePregnancyTimeline(journeyId);
  const { data: weightLog } = useWeightLog(journeyId);
  const toggle = useSetMilestoneCompleted(journeyId);
  const logWeight = useLogWeight(journeyId);

  const [movOpen, setMovOpen] = useState(false);
  const [weekInput, setWeekInput] = useState('');
  const [weightInput, setWeightInput] = useState('');

  const ga = calculateGestationalAge(
    { lmpDate: journey.lmp_date, dueDate: journey.due_date },
    new Date(),
  );
  const currentWeek = ga?.weeks ?? null;

  // Próxima consulta sugerida = primeira "consulta" não concluída, por semana.
  const nextConsult = useMemo(() => {
    return (timeline ?? [])
      .filter((i) => i.catalog?.category === 'consulta' && !i.milestone.completed_at)
      .sort((a, b) => (a.catalog?.week_min ?? 99) - (b.catalog?.week_min ?? 99))[0];
  }, [timeline]);

  // IMC aproximado a partir da altura e do primeiro peso registrado.
  const bmi = useMemo(() => {
    const first = [...(weightLog ?? [])].sort((a, b) => a.week - b.week)[0];
    if (!first || !heightCm) return null;
    const m = heightCm / 100;
    return first.weight_kg / (m * m);
  }, [weightLog, heightCm]);

  async function addWeight() {
    const week = Number(weekInput || currentWeek || 0);
    const kg = Number(weightInput);
    if (!week || week < 1 || week > 42 || !kg || kg <= 0) {
      toast.error('Informe semana (1–42) e peso válidos.');
      return;
    }
    try {
      await logWeight.mutateAsync({ week, weightKg: kg });
      setWeightInput('');
      toast.success('Peso registrado.');
    } catch {
      toast.error('Não foi possível registrar.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <EmergencyContactBanner
        obstetricianPhone={journey.obstetrician_phone}
        maternityPhone={journey.maternity_phone}
      />

      <GestationalAgeHeader journey={journey} />

      {/* Próxima consulta sugerida */}
      {nextConsult && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-primary">
            <CalendarCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">Próxima consulta sugerida</p>
            <p className="text-xs text-muted">
              {nextConsult.catalog?.label_pt} · semanas {nextConsult.catalog?.week_min}–{nextConsult.catalog?.week_max}
            </p>
          </div>
          <button
            onClick={() => toggle.mutate({ milestoneId: nextConsult.milestone.id, completedAt: new Date().toISOString().slice(0, 10) })}
            className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white"
          >
            Já agendei
          </button>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="flex flex-wrap gap-2">
        {currentWeek != null && currentWeek >= FETAL_MOVEMENTS_FROM_WEEK && (
          <button onClick={() => setMovOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-fg-soft hover:bg-surface-2">
            <Activity className="h-4 w-4 text-primary" /> Registrar movimentos do bebê
          </button>
        )}
        {journey.obstetrician_phone && (
          <a href={`tel:${journey.obstetrician_phone}`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-fg-soft hover:bg-surface-2">
            <Phone className="h-4 w-4 text-primary" /> Falar com meu obstetra
          </a>
        )}
      </div>

      {/* Ganho de peso */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Ganho de peso</h2>
        </div>
        <WeightGainChart weightLog={weightLog ?? []} bmi={bmi} />
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            Semana
            <input
              type="number"
              value={weekInput}
              onChange={(e) => setWeekInput(e.target.value)}
              placeholder={currentWeek != null ? String(currentWeek) : '—'}
              className="mt-1 block h-10 w-24 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
            />
          </label>
          <label className="text-xs text-muted">
            Peso (kg)
            <input
              type="number"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="mt-1 block h-10 w-28 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
            />
          </label>
          <button onClick={addWeight} disabled={logWeight.isPending} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-sky-500/15 px-3.5 text-sm font-semibold text-primary hover:bg-sky-500/25">
            <Plus className="h-4 w-4" /> Registrar
          </button>
        </div>
      </section>

      {/* Timeline do pré-natal */}
      <TrimesterTimeline
        items={timeline ?? []}
        currentWeek={currentWeek}
        onToggle={(milestoneId, completed) =>
          toggle.mutate({ milestoneId, completedAt: completed ? new Date().toISOString().slice(0, 10) : null })
        }
        pending={toggle.isPending}
      />

      <PregnancyDisclaimer />

      <FetalMovementsModal open={movOpen} onClose={() => setMovOpen(false)} journeyId={journeyId} />
    </div>
  );
}
