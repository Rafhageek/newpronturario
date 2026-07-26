'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DiaryEntry } from '@hubpatients/core';
import { ChartSummary } from './chart-summary';
import {
  AXIS_TICK_SIZE,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipStyle,
  useChartMotion,
  useChartPalette,
} from './chart-theme';

/**
 * Humor × energia (escala pessoal de 1 a 5).
 *
 * NÃO tem faixa de referência: é uma escala subjetiva, autodeclarada, sem
 * valor de corte na literatura. Inventar uma faixa aqui seria interpretar.
 *
 * As duas séries se diferenciam por cor **e** por traço (contínuo × tracejado),
 * para não depender só de cor (WCAG 1.4.1).
 */
export function MoodEnergyChart({
  entries,
  showSummary = false,
  periodLabel,
}: {
  entries: DiaryEntry[];
  showSummary?: boolean;
  periodLabel?: string;
}) {
  const palette = useChartPalette();
  const motionProps = useChartMotion();
  const moodColor = palette.series[0];
  const energyColor = palette.series[1];
  const energyDash = palette.dash[1] ?? '6 3';
  const data = [...entries]
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    .filter((e) => e.mood != null || e.energy != null)
    .map((e) => ({
      date: new Date(e.entry_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      mood: e.mood,
      energy: e.energy,
    }));
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
        Registre humor e energia no Diário para ver a correlação.
      </div>
    );
  }
  return (
    <div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: palette.axis, fontSize: AXIS_TICK_SIZE }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: palette.axis, fontSize: AXIS_TICK_SIZE }} tickLine={false} axisLine={false} width={30} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
            <Line type="monotone" dataKey="mood" name="Humor" stroke={moodColor} strokeWidth={2} dot={false} connectNulls {...motionProps} />
            {/* Tracejado: distingue a série sem depender de cor. */}
            <Line type="monotone" dataKey="energy" name="Energia" stroke={energyColor} strokeWidth={2} strokeDasharray={energyDash} dot={false} connectNulls {...motionProps} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-5 rounded-full" style={{ background: moodColor }} />
          Humor (linha contínua)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-0.5 w-5"
            style={{ backgroundImage: `repeating-linear-gradient(90deg, ${energyColor} 0 5px, transparent 5px 9px)` }}
          />
          Energia (linha tracejada)
        </span>
        <span>Escala pessoal de 1 a 5 — sem faixa de referência.</span>
      </div>

      {showSummary && (
        <ChartSummary
          title="Humor e energia"
          periodLabel={periodLabel}
          series={[
            { label: 'Humor', values: data.map((d) => d.mood), kind: 'humor', unit: 'de 1 a 5' },
            { label: 'Energia', values: data.map((d) => d.energy), kind: 'energia', unit: 'de 1 a 5' },
          ]}
          labels={data.map((d) => d.date)}
          className="mt-2"
        />
      )}
    </div>
  );
}
