'use client';

import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { SeriesStats } from '@hubpatients/core';
import { trendLabel } from '@hubpatients/core';
import { fmtNumber } from './chart-summary';

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
  if (!stats) return <p className="text-body-sm text-muted">Sem registros no período.</p>;
  const Icon = trendPct == null || Math.abs(trendPct) < 2 ? Minus : trendPct > 0 ? TrendingUp : TrendingDown;
  // Vírgula decimal (PT-BR) e sem casas sobrando em valores inteiros.
  const num = (n: number) => fmtNumber(n, Number.isInteger(n) ? 0 : 1);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-body-sm">
      <Stat label="Média" value={`${fmtNumber(stats.avg, 1)} ${unit}`} />
      <Stat label="Mín" value={`${num(stats.min)} ${unit}`} />
      <Stat label="Máx" value={`${num(stats.max)} ${unit}`} />
      <span className="inline-flex items-center gap-1">
        {/* Ícone decorativo: a direção também está escrita ao lado. */}
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span className="text-fg-soft">
          Sua {label} {trendLabel(trendPct)}.
        </span>
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-muted">
      {/* `hp-num`: Atkinson Mono tabular — 1/l e 0/O inconfundíveis e o dígito
          não muda de largura quando o valor atualiza. */}
      {label}: <span className="hp-num font-semibold text-fg">{value}</span>
    </span>
  );
}
