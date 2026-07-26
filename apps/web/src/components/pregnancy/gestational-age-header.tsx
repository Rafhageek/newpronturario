'use client';

import { Baby } from 'lucide-react';
import {
  calculateGestationalAge,
  weeksUntilDue,
  PREGNANCY_RISK_LABELS,
  type PregnancyJourney,
} from '@hubpatients/core';

const ORDINAL = ['', '1º', '2º', '3º'];

export function GestationalAgeHeader({ journey }: { journey: PregnancyJourney }) {
  const today = new Date();
  const ga = calculateGestationalAge(
    { lmpDate: journey.lmp_date, dueDate: journey.due_date },
    today,
  );
  const remaining = journey.due_date ? weeksUntilDue(journey.due_date, today) : null;

  return (
    <header className="vl-rise rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-400 text-white">
          <Baby className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          {ga ? (
            <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
              {ga.weeks} {ga.weeks === 1 ? 'semana' : 'semanas'}
              {ga.days > 0 && ` e ${ga.days} ${ga.days === 1 ? 'dia' : 'dias'}`}
            </h1>
          ) : (
            <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
              Acompanhamento da gestação
            </h1>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {ga && <span>{ORDINAL[ga.trimester]} trimestre</span>}
            {ga && remaining != null && <span aria-hidden>·</span>}
            {remaining != null && (
              <span>
                faltam {remaining} {remaining === 1 ? 'semana' : 'semanas'}
              </span>
            )}
            {journey.risk_level && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-soft">
                {PREGNANCY_RISK_LABELS[journey.risk_level]}
              </span>
            )}
          </p>
        </div>
      </div>
    </header>
  );
}
