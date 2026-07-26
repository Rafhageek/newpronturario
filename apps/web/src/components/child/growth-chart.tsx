'use client';

import { useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { Child, ChildGrowthMeasurement } from '@hubpatients/core';
import {
  GROWTH_INDICATORS,
  PERCENTILE_LINES,
  PERCENTILE_HINT,
  percentileForAge,
  valueAtPercentileForAge,
} from '@hubpatients/core';
import { useWhoStandard } from '@hubpatients/supabase';
import { AXIS_TICK_SIZE, useChartMotion, useChartPalette } from '@/components/analise/chart-theme';

/**
 * As curvas da OMS são REFERÊNCIA, não série de dado: ficam todas na cor de
 * banda neutra dos tokens, com a mediana (P50) um pouco mais forte.
 *
 * Antes vinham como `var(--muted)` / `var(--faint)` direto no atributo `stroke`
 * do SVG — o Recharts pinta stroke/fill como ATRIBUTO, e `stroke="var(--x)"` tem
 * suporte irregular entre motores (mesma razão documentada em `chart-theme.ts`).
 * Agora a cor é resolvida em JS a partir da paleta do tema.
 */
function percentileColor(p: number, band: string, ink: string): string {
  return p === 50 ? ink : band;
}

/** Valor medido da criança para cada indicador. */
function measuredValue(indicatorKey: string, m: ChildGrowthMeasurement): number | null {
  switch (indicatorKey) {
    case 'wfa':
      return m.weight_kg;
    case 'lhfa':
      return m.length_or_height_cm;
    case 'bfa':
      return m.bmi;
    case 'hcfa':
      return m.head_circumference_cm;
    default:
      return null;
  }
}

interface ChartRow {
  x: number;
  child?: number | null;
  [percentileKey: string]: number | null | undefined;
}

interface WhoPoint {
  x: number;
  l: number;
  m: number;
  s: number;
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number;
}

function GrowthTooltip({
  active,
  payload,
  label,
  unit,
  whoPoints,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  unit: string;
  whoPoints: WhoPoint[];
}) {
  if (!active || !payload || payload.length === 0 || label == null) return null;
  const childItem = payload.find((p) => p.dataKey === 'child' && p.value != null);

  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-xs text-fg shadow-lg">
      <p className="font-semibold text-fg">{label} meses</p>
      {childItem?.value != null && (
        <p className="mt-1 text-fg-soft">
          Medida da criança: <span className="font-semibold text-fg">{childItem.value} {unit}</span>
          {(() => {
            const pct = percentileForAge(childItem.value, label, whoPoints);
            return pct != null ? <span className="text-muted"> · próximo de P{pct}</span> : null;
          })()}
        </p>
      )}
      {payload
        .filter((p) => typeof p.dataKey === 'string' && p.dataKey.startsWith('p') && p.value != null)
        .map((p) => (
          <p key={String(p.dataKey)} className="text-muted">
            {String(p.dataKey).replace('p', 'P')}: {Math.round((p.value ?? 0) * 10) / 10} {unit}
          </p>
        ))}
    </div>
  );
}

export function GrowthChart({ child, measurements }: { child: Child; measurements: ChildGrowthMeasurement[] }) {
  const palette = useChartPalette();
  const motionProps = useChartMotion();
  const [indicatorKey, setIndicatorKey] = useState(GROWTH_INDICATORS[0]!.key);
  const indicator = GROWTH_INDICATORS.find((i) => i.key === indicatorKey)!;
  const { data: whoStandard, isLoading, isError } = useWhoStandard(indicatorKey, child.sex);

  const whoPoints = useMemo<WhoPoint[]>(
    () => (whoStandard ?? []).map((p) => ({ x: p.x, l: p.l, m: p.m, s: p.s })),
    [whoStandard],
  );

  const childPoints = useMemo(() => {
    return measurements
      .map((m) => {
        const value = measuredValue(indicatorKey, m);
        return value != null ? { x: m.age_months_at_measurement, child: value } : null;
      })
      .filter((p): p is { x: number; child: number } => p !== null);
  }, [measurements, indicatorKey]);

  const data = useMemo<ChartRow[]>(() => {
    const [min, max] = indicator.ageRange;
    if (whoPoints.length === 0) return [];
    const rows: ChartRow[] = [];
    for (let x = min; x <= max; x++) {
      const row: ChartRow = { x };
      for (const p of PERCENTILE_LINES) {
        row[`p${p}`] = valueAtPercentileForAge(p, x, whoPoints);
      }
      rows.push(row);
    }
    // Mescla os pontos da criança no eixo X correspondente.
    for (const cp of childPoints) {
      const existing = rows.find((r) => r.x === cp.x);
      if (existing) existing.child = cp.child;
      else rows.push({ x: cp.x, child: cp.child });
    }
    rows.sort((a, b) => a.x - b.x);
    return rows;
  }, [indicator.ageRange, whoPoints, childPoints]);

  return (
    <div>
      {/* Seletor de indicador */}
      <div role="group" aria-label="Indicador de crescimento" className="mb-4 flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-1">
        {GROWTH_INDICATORS.map((ind) => (
          <button
            key={ind.key}
            type="button"
            aria-pressed={ind.key === indicatorKey}
            onClick={() => setIndicatorKey(ind.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
              ind.key === indicatorKey
                ? 'bg-status-info-tint text-status-info-ink'
                : 'text-muted hover:text-fg'
            }`}
          >
            {ind.shortLabel}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">{indicator.label}</h3>
        <span className="group/hint relative inline-flex">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg-soft"
            aria-label="O que são percentis?"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-9 z-10 w-64 rounded-xl border border-line bg-surface p-3 text-[11px] leading-relaxed text-fg-soft opacity-0 shadow-lg transition group-hover/hint:opacity-100"
          >
            {PERCENTILE_HINT}
          </span>
        </span>
      </div>

      {isLoading ? (
        <div className="h-72 animate-pulse rounded-2xl bg-surface-2" />
      ) : isError ? (
        <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
          Não foi possível carregar as curvas de referência da OMS.
        </p>
      ) : data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
          Sem dados de referência para este indicador.
        </p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
              <XAxis
                dataKey="x"
                type="number"
                domain={[indicator.ageRange[0], indicator.ageRange[1]]}
                tick={{ fontSize: AXIS_TICK_SIZE, fill: palette.axis }}
                label={{ value: 'meses', position: 'insideBottomRight', offset: -2, fontSize: AXIS_TICK_SIZE, fill: palette.axis }}
              />
              <YAxis tick={{ fontSize: AXIS_TICK_SIZE, fill: palette.axis }} width={48} />
              <Tooltip
                content={<GrowthTooltip unit={indicator.unit} whoPoints={whoPoints} />}
              />
              {PERCENTILE_LINES.map((p) => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={`p${p}`}
                  stroke={percentileColor(p, palette.band, palette.bandInk)}
                  strokeWidth={p === 50 ? 1.75 : 1}
                  strokeDasharray={p === 50 ? undefined : '4 4'}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  name={`p${p}`}
                />
              ))}
              <Scatter
                dataKey="child"
                fill={palette.series[0]}
                name="child"
                line={{ stroke: palette.series[0], strokeWidth: 2 }}
                {...motionProps}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-2 text-center text-caption text-hint">
        Linhas tracejadas: percentis da OMS (P3–P97). A linha cheia com pontos é a medida da criança.
        Apenas posicionamento, sem julgamento.
      </p>
    </div>
  );
}
