'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, NotebookPen, Plus } from 'lucide-react';
import { useDiaryEntries, useVitalsAllRange } from '@hubpatients/supabase';
import type { Vital } from '@hubpatients/core';
import { useActiveProfile } from '@/components/profile-context';
import { TimelineEntry } from '@/components/diary/timeline-entry';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 3650, label: 'Tudo' },
];

export default function DiarioPage() {
  const { patientId } = useActiveProfile();
  const { data: entries, isLoading } = useDiaryEntries(patientId || undefined);
  const { data: vitals } = useVitalsAllRange(patientId || undefined, 365);

  const [period, setPeriod] = useState(30);
  const [symptom, setSymptom] = useState<string>('');

  // vitais agrupados por data (yyyy-mm-dd)
  const vitalsByDate = useMemo(() => {
    const map = new Map<string, Vital[]>();
    for (const v of vitals ?? []) {
      const key = v.measured_at.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    return map;
  }, [vitals]);

  const allSymptoms = useMemo(() => {
    const set = new Set<string>();
    (entries ?? []).forEach((e) => e.symptoms.forEach((s) => set.add(s)));
    return [...set].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    return (entries ?? []).filter((e) => {
      if (new Date(e.entry_date) < cutoff) return false;
      if (symptom && !e.symptoms.includes(symptom)) return false;
      return true;
    });
  }, [entries, period, symptom]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
          Diário clínico
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/diario/dor"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium text-fg-soft transition hover:bg-surface-2"
          >
            <Activity className="h-4 w-4" aria-hidden /> Ver histórico de dor
          </Link>
          <Link
            href="/diario/novo"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo registro
          </Link>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setPeriod(p.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${period === p.days ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {allSymptoms.length > 0 && (
          <select
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            className="h-9 rounded-xl border border-line bg-surface px-3 text-xs text-fg"
          >
            <option value="">Todos os sintomas</option>
            {allSymptoms.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        )}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : filtered.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
          className="space-y-3"
        >
          {filtered.map((entry) => (
            <TimelineEntry key={entry.id} entry={entry} vitals={vitalsByDate.get(entry.entry_date) ?? []} />
          ))}
        </motion.div>
      ) : (
        <EmptyState
          icon={NotebookPen}
          title="Nenhum registro neste período"
          description="Anote como você se sente — humor, energia, dor e sintomas — para acompanhar sua saúde no tempo."
          action={
            <Link
              href="/diario/novo"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Criar o primeiro registro
            </Link>
          }
        />
      )}
    </div>
  );
}
