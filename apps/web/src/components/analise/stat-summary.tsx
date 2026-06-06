'use client';

import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { SeriesStats } from '@vidalog/core';
import { trendLabel } from '@vidalog/core';

export function StatSummary({
  stats,
  trendPct,
  unit,
  label,
}: {
  stats: SeriesStats | null;
  trendPct: number | null;
  unit: string;
  label: string;
}) {
  if (!stats) return <p className="text-xs text-muted">Sem registros no período.</p>;
  const Icon = trendPct == null || Math.abs(trendPct) < 2 ? Minus : trendPct > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
      <Stat label="Média" value={`${stats.avg.toFixed(1)} ${unit}`} />
      <Stat label="Mín" value={`${stats.min} ${unit}`} />
      <Stat label="Máx" value={`${stats.max} ${unit}`} />
      <span className="inline-flex items-center gap-1 text-fg-soft">
        <Icon className="h-3.5 w-3.5 text-primary" />
        Sua {label} {trendLabel(trendPct)}.
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-muted">
      {label}: <span className="font-semibold text-fg">{value}</span>
    </span>
  );
}
