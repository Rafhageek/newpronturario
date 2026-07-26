'use client';

import { CYCLE_PHASE_COLORS, CYCLE_PHASE_LABELS, type CyclePhase } from '@hubpatients/core';

/**
 * Cartão da fase atual do ciclo.
 * - phase: fase estimada hoje (ou null se ainda não há histórico)
 * - daysUntilNext: dias até a próxima menstruação ESTIMADA (ou null)
 *
 * Tudo aqui é estimativa — reforçada por um mini-disclaimer.
 */
export function PhaseCard({
  phase,
  daysUntilNext,
}: {
  phase: CyclePhase | null;
  daysUntilNext: number | null;
}) {
  const phaseLabel = phase ? CYCLE_PHASE_LABELS[phase] : 'Sem dados suficientes';
  const dotColor = phase ? CYCLE_PHASE_COLORS[phase] : 'var(--color-line, #9ca3af)';

  let nextLine: string;
  if (daysUntilNext == null) {
    nextLine = 'Registre seus dias de menstruação para estimarmos a próxima.';
  } else if (daysUntilNext > 0) {
    nextLine = `Próxima menstruação estimada em ${daysUntilNext} ${daysUntilNext === 1 ? 'dia' : 'dias'}.`;
  } else if (daysUntilNext === 0) {
    nextLine = 'Próxima menstruação estimada para hoje.';
  } else {
    const late = Math.abs(daysUntilNext);
    nextLine = `Estimativa: ${late} ${late === 1 ? 'dia' : 'dias'} de atraso em relação à previsão.`;
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: dotColor }}
        >
          <span className="h-3 w-3 rounded-full bg-fg/30" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Fase atual</p>
          <p
            className="text-lg font-bold text-fg"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {phaseLabel}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-fg-soft">{nextLine}</p>

      <p className="mt-3 text-xs leading-relaxed text-faint">
        Estimativa baseada no seu histórico — pode variar e não substitui avaliação médica.
      </p>
    </section>
  );
}
