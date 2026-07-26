'use client';

import { useRef } from 'react';
import { Droplets, Plus } from 'lucide-react';
import { useVitals, useTodayWater, useLogWater } from '@hubpatients/supabase';
import { GLASS_ML, waterGoalMl, glassesForGoal, WATER_CAP_NOTE } from '@hubpatients/core';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

const oneDecimalL = (ml: number) => (ml / 1000).toFixed(1).replace('.', ',');

/**
 * Card de hidratação (bem-estar, grátis). A meta é SEMPRE enquadrada como
 * "estimativa" e o card mostra o aviso de teto para cardiopata/renal. Um clique
 * = 1 copo (250 ml). Owner-only: recebe o próprio id (ownId) do dashboard.
 */
export function WaterCard({
  patientId,
  dateOfBirth,
}: {
  patientId: string | undefined;
  dateOfBirth: string | null | undefined;
}) {
  const { data: todayMl, isLoading, isError } = useTodayWater(patientId);
  const { data: weightVitals } = useVitals(patientId, 'weight');
  const logWater = useLogWater(patientId);
  // Trava síncrona anti duplo-clique (o disabled só reage após re-render).
  const submitting = useRef(false);

  const latestWeight =
    (weightVitals ?? [])
      .slice()
      .sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime())[0]
      ?.value_primary ?? null;
  const age = dateOfBirth
    ? Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / 31557600000)
    : null;

  const goal = waterGoalMl(latestWeight, age);
  const ml = todayMl ?? 0;
  const reached = ml >= goal;
  const pct = Math.min(1, ml / goal);
  const glasses = Math.round(ml / GLASS_ML);
  const goalGlasses = glassesForGoal(goal);
  const busy = logWater.isPending;

  async function addGlass() {
    if (!patientId || submitting.current) return;
    submitting.current = true;
    try {
      await logWater.mutateAsync(GLASS_ML);
    } catch {
      toast.error('Não foi possível registrar agora.');
    } finally {
      submitting.current = false;
    }
  }

  const subtitle = isError
    ? 'Não foi possível carregar agora'
    : isLoading
      ? 'Carregando…'
      : `${glasses} ${glasses === 1 ? 'copo' : 'copos'} · meta estimada ${goalGlasses} (${oneDecimalL(goal)} L)`;

  return (
    <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-status-info-ink">
            <Droplets className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-fg">Hidratação</h3>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
        </div>
        <span className="text-xl font-bold text-status-info-ink">
          {isError || isLoading ? '—' : `${Math.round(pct * 100)}%`}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={isError || isLoading ? 0 : Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso de hidratação"
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-sky-500 transition-[width] duration-500"
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      {reached && !isError && !isLoading ? (
        <p className="mt-2 text-xs font-medium text-status-info-ink">Meta estimada atingida 🎉</p>
      ) : null}

      <button
        onClick={addGlass}
        disabled={busy}
        aria-busy={busy || undefined}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        Bebi um copo (250 ml)
      </button>

      <p className="mt-2 text-[11px] leading-4 text-muted">{WATER_CAP_NOTE}</p>
    </section>
  );
}
