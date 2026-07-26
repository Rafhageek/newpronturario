'use client';

import { motion } from 'framer-motion';
import { Check, Circle, Clock } from 'lucide-react';
import { MILESTONE_CATEGORY_LABELS } from '@hubpatients/core';
import type { TimelineItem } from '@hubpatients/supabase';

const TRIMESTERS = [
  { n: 1 as const, label: '1º trimestre', range: 'até 13 semanas' },
  { n: 2 as const, label: '2º trimestre', range: '14 a 27 semanas' },
  { n: 3 as const, label: '3º trimestre', range: '28 semanas ao parto' },
];

type Status = 'done' | 'current' | 'overdue' | 'upcoming';

function statusOf(item: TimelineItem, currentWeek: number | null): Status {
  if (item.milestone.completed_at) return 'done';
  const c = item.catalog;
  if (!c || currentWeek == null) return 'upcoming';
  if (currentWeek > c.week_max) return 'overdue';
  if (currentWeek >= c.week_min) return 'current';
  return 'upcoming';
}

const STATUS_META: Record<Status, { icon: typeof Check; cls: string; label: string }> = {
  done: { icon: Check, cls: 'text-status-ok-ink', label: 'Concluído' },
  current: { icon: Clock, cls: 'text-primary', label: 'Nesta fase' },
  overdue: { icon: Clock, cls: 'text-amber-700 dark:text-amber-300', label: 'Atrasado' },
  upcoming: { icon: Circle, cls: 'text-faint', label: 'Em breve' },
};

const listVariants = { show: { transition: { staggerChildren: 0.05 } } };
const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0 },
};

export function TrimesterTimeline({
  items,
  currentWeek,
  onToggle,
  pending,
}: {
  items: TimelineItem[];
  currentWeek: number | null;
  onToggle: (milestoneId: string, completed: boolean) => void;
  pending?: boolean;
}) {
  return (
    <div className="space-y-5">
      {TRIMESTERS.map((tri) => {
        const triItems = items.filter((i) => i.catalog?.trimester === tri.n);
        if (triItems.length === 0) return null;
        return (
          <section key={tri.n} className="rounded-2xl border border-line bg-surface p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
                {tri.label}
              </h3>
              <span className="text-xs text-muted">{tri.range}</span>
            </div>
            <motion.ul
              className="space-y-1"
              variants={listVariants}
              initial="hidden"
              animate="show"
            >
              {triItems.map((item) => {
                const st = statusOf(item, currentWeek);
                const meta = STATUS_META[st];
                const Icon = meta.icon;
                const c = item.catalog;
                const done = st === 'done';
                return (
                  <motion.li
                    key={item.milestone.id}
                    variants={itemVariants}
                    className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition hover:bg-surface-2"
                  >
                    <button
                      onClick={() => onToggle(item.milestone.id, !done)}
                      disabled={pending}
                      aria-pressed={done}
                      aria-label={`${done ? 'Desmarcar' : 'Marcar como concluído'}: ${c?.label_pt ?? item.milestone.milestone_code}`}
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${done ? 'border-emerald-400/40 bg-emerald-500/15' : 'border-line hover:border-primary/40'}`}
                    >
                      <Icon className={`h-4 w-4 ${meta.cls}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${done ? 'text-muted line-through' : 'text-fg'}`}>
                        {c?.label_pt ?? item.milestone.milestone_code}
                      </p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {c && (
                          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium">
                            {MILESTONE_CATEGORY_LABELS[c.category] ?? c.category}
                          </span>
                        )}
                        {c && <span>semanas {c.week_min}–{c.week_max}</span>}
                        <span aria-hidden>·</span>
                        <span className={meta.cls}>{meta.label}</span>
                      </p>
                      {c?.description_short && (
                        <p className="mt-0.5 text-xs text-faint">{c.description_short}</p>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          </section>
        );
      })}
    </div>
  );
}
