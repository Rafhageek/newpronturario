'use client';

import { Sprout } from 'lucide-react';
import { computeConstancy } from '@hubpatients/core';
import { useDiaryEntries } from '@hubpatients/supabase';

/**
 * Card de Constância Gentil — mede o hábito de registrar sem punir. Um dia
 * perdido nunca zera; celebra sem infantilizar. Sinal = dias com registro no diário.
 */
export function ConstancyCard({ patientId }: { patientId?: string }) {
  const { data: entries = [] } = useDiaryEntries(patientId);
  const c = computeConstancy(entries.map((e) => e.entry_date));

  return (
    <section className="vl-rise flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
      <Ring pct={c.score} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Sprout className="h-4 w-4 text-status-ok-ink" />
          <h3 className="text-sm font-semibold text-fg">Sua constância</h3>
          <span className="rounded-full bg-health-500/15 px-2 py-0.5 text-[11px] font-semibold text-status-ok-ink">
            {c.levelLabel}
          </span>
          {c.firmWeeks > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {c.firmWeeks} semana{c.firmWeeks > 1 ? 's' : ''} firme{c.firmWeeks > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">{c.message}</p>
      </div>
    </section>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-fg">{pct}</span>
    </div>
  );
}
