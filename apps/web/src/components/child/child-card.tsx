'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Baby, ChevronRight, Syringe } from 'lucide-react';
import type { Child } from '@hubpatients/core';
import { ageLabel, nextDueVaccines } from '@hubpatients/core';
import { useChildVaccinations, useVaccineSchedule } from '@hubpatients/supabase';

const STATUS_STYLES: Record<'overdue' | 'due' | 'upcoming', string> = {
  overdue: 'text-rose-700 dark:text-rose-300',
  due: 'text-amber-700 dark:text-amber-300',
  upcoming: 'text-emerald-700 dark:text-emerald-300',
};

const STATUS_LABELS: Record<'overdue' | 'due' | 'upcoming', string> = {
  overdue: 'Em atraso',
  due: 'Para hoje',
  upcoming: 'A seguir',
};

export function ChildCard({ child }: { child: Child }) {
  const { data: vaccinations } = useChildVaccinations(child.id);
  const { data: schedule } = useVaccineSchedule();

  const next = useMemo(() => {
    if (!schedule) return null;
    const appliedCodes = (vaccinations ?? [])
      .map((v) => v.dose_label ?? v.vaccine_name)
      .filter((c): c is string => Boolean(c));
    const due = nextDueVaccines(
      child.birth_date,
      appliedCodes,
      schedule.map((s) => ({ code: s.code, recommended_age_months: s.recommended_age_months })),
      new Date(),
    );
    const item = due[0];
    if (!item) return null;
    const meta = schedule.find((s) => s.code === item.code);
    return { label: meta?.label_pt ?? item.code, doseLabel: meta?.dose_label ?? '', status: item.status };
  }, [child.birth_date, schedule, vaccinations]);

  return (
    <Link
      href={`/criancas/${child.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:bg-surface-2"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-400 text-white">
        <Baby className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{child.full_name}</p>
        <p className="text-xs text-muted">{ageLabel(child.birth_date, new Date())}</p>
        {next && (
          <p className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium ${STATUS_STYLES[next.status]}`}>
            <Syringe className="h-3.5 w-3.5" />
            <span>
              Próxima vacina: {next.label}
              {next.doseLabel ? ` (${next.doseLabel})` : ''} · {STATUS_LABELS[next.status]}
            </span>
          </p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted transition group-hover:text-fg-soft" />
    </Link>
  );
}
