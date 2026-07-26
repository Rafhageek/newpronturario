'use client';

import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { smoothedTrendPct, trendDirection, trendLabel } from '@hubpatients/core';

/**
 * Chip de tendência em linguagem simples (↑/↓ + "caiu 8% no período").
 * Framing FACTUAL (nunca "melhor/pior" = juízo clínico). Some com poucos dados.
 */
export function TrendChip({ values, label }: { values: number[]; label: string }) {
  if (values.length < 4) return null;
  const pct = smoothedTrendPct(values);
  const dir = trendDirection(pct);
  const Icon: LucideIcon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  const tone =
    dir === 'flat'
      ? 'bg-surface-2 text-fg-soft'
      : 'bg-primary/10 text-primary';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {label} {trendLabel(pct)}
    </span>
  );
}
