'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

export const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
export const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

export type Tone = 'ok' | 'attention' | 'alert' | 'neutral';

const TONE_COLOR: Record<Tone, string> = {
  ok: '#10B981',
  attention: '#F59E0B',
  alert: '#EF4444',
  neutral: '#38BDF8',
};

export function MetricCard({
  icon: Icon,
  accent,
  label,
  children,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={item}
      className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 transition hover:border-primary/40"
    >
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${accent}1f`, color: accent }}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-1">{children}</div>
    </motion.div>
  );
}

/** Chip de status clínico (faixa de referência — não diagnóstico). */
export function StatusChip({ tone, label }: { tone: Tone; label: string }) {
  const color = TONE_COLOR[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `${color}1f`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function Trend({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up') return <ArrowUpRight className="h-4 w-4 text-rose-400" />;
  if (direction === 'down') return <ArrowDownRight className="h-4 w-4 text-emerald-400" />;
  return <ArrowRight className="h-4 w-4 text-muted" />;
}
