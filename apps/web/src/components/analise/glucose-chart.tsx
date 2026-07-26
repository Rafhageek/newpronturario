'use client';

import { useId } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Vital } from '@hubpatients/core';
import { ChartSummary } from './chart-summary';
import {
  AXIS_TICK_SIZE,
  bandColors,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipStyle,
  useChartMotion,
  useChartPalette,
} from './chart-theme';
import { ReferenceBandLegend, referenceBandElements, referenceBandFor } from './reference-band';

/**
 * Glicemia com faixa de referência 70–180 mg/dL (consenso internacional de
 * tempo-na-faixa em CGM). A faixa é um enquadramento de leitura, não um
 * diagnóstico — ver `reference-band.tsx`.
 */
export function GlucoseChart({
  vitals,
  showReferenceBand = true,
  showSummary = false,
  periodLabel,
}: {
  vitals: Vital[];
  showReferenceBand?: boolean;
  /** Renderiza a frase-resumo abaixo (use quando o gráfico não está num ChartCard). */
  showSummary?: boolean;
  periodLabel?: string;
}) {
  const uid = useId();
  const palette = useChartPalette();
  const motionProps = useChartMotion();
  const data = vitals.map((v) => ({
    date: new Date(v.measured_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    value: v.value_primary,
  }));
  const band = showReferenceBand ? referenceBandFor('glicemia') : null;
  if (data.length === 0) return <Empty />;

  return (
    <div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            {referenceBandElements(band, uid, { colors: bandColors(palette) })}
            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: palette.axis, fontSize: AXIS_TICK_SIZE }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={[40, 'dataMax + 20']} tick={{ fill: palette.axis, fontSize: AXIS_TICK_SIZE }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v: number) => [`${v} mg/dL`, 'Glicemia']} />
            <Line type="monotone" dataKey="value" stroke={palette.series[0]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} {...motionProps} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showSummary && (
        <>
          <ReferenceBandLegend bands={[band]} />
          <ChartSummary
            title="Glicemia"
            periodLabel={periodLabel}
            series={[{ label: 'Glicemia', values: data.map((d) => d.value), kind: 'glicemia', band }]}
            labels={data.map((d) => d.date)}
            className="mt-2"
          />
        </>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
      Sem registros de glicemia no período.
    </div>
  );
}
