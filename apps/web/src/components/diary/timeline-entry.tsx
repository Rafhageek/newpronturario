'use client';

import { motion } from 'framer-motion';
import type { DiaryEntry, Vital } from '@hubpatients/core';
import { formatVital, MOOD_LABELS, VITAL_TYPES } from '@hubpatients/core';

const MOOD_EMOJI: Record<number, string> = { 1: '😣', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

export const entryVariant = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

export function TimelineEntry({ entry, vitals }: { entry: DiaryEntry; vitals: Vital[] }) {
  return (
    <motion.div variants={entryVariant} className="relative pl-8">
      {/* linha + ponto da timeline */}
      <span className="absolute left-[9px] top-1 h-full w-px bg-line" aria-hidden />
      <span className="absolute left-1 top-1 h-4 w-4 rounded-full border-2 border-primary bg-surface-2" aria-hidden />

      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-fg">
            {new Date(entry.entry_date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
          <div className="flex items-center gap-3 text-xs text-muted">
            {entry.mood != null && (
              <span title={MOOD_LABELS[entry.mood]} className="text-base">{MOOD_EMOJI[entry.mood]}</span>
            )}
            {/* SEM semáforo: energia e dor são o CORPO do paciente, não o
                sistema. Pintar dor 8 de vermelho é interpretar o dado — e as
                cores usadas (#EF4444 3,57:1 · #F59E0B 2,04:1 · #10B981 2,41:1)
                ainda reprovavam em AA. O número fica na tinta do texto. */}
            {entry.energy != null && <Metric label="energia" value={`${entry.energy}/5`} />}
            {entry.pain != null && <Metric label="dor" value={`${entry.pain}/10`} />}
          </div>
        </div>

        {entry.symptoms.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {entry.symptoms.map((s) => (
              <span key={s} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-soft">{s}</span>
            ))}
          </div>
        )}

        {vitals.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {vitals.map((v) => (
              <span key={v.id} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs text-fg-soft">
                <span className="text-muted">{VITAL_TYPES[v.type].label}:</span>
                <span className="font-medium text-fg">{formatVital(v)}</span>
              </span>
            ))}
          </div>
        )}

        {entry.note && <p className="mt-3 text-sm text-fg-soft">{entry.note}</p>}
      </div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-fg">{value}</span>
    </span>
  );
}
