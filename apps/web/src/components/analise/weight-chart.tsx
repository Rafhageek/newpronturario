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
 * Peso. Peso isolado NÃO tem faixa de referência: a faixa só existe quando a
 * altura é conhecida, e aí é derivada do IMC 18,5–24,9 (OMS). Sem `heightCm`
 * nenhuma faixa é desenhada — melhor nada do que uma referência inventada.
 */
export function WeightChart({
  vitals,
  heightCm,
  showSummary = false,
  periodLabel,
}: {
  vitals: Vital[];
  /** Altura do perfil, em cm. Sem ela o gráfico não desenha faixa. */
  heightCm?: number | null;
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
  const band = referenceBandFor('peso', { heightCm });
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
        Sem registros de peso no período.
      </div>
    );
  }
  return (
    <div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            {referenceBandElements(band, uid, { colors: bandColors(palette) })}
            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: palette.axis, fontSize: AXIS_TICK_SIZE }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fill: palette.axis, fontSize: AXIS_TICK_SIZE }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v: number) => [`${v} kg`, 'Peso']} />
            {/* Sem verde: série de dado do paciente não usa cor de semáforo. */}
            <Line type="monotone" dataKey="value" stroke={palette.series[0]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} {...motionProps} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showSummary && (
        <>
          <ReferenceBandLegend bands={[band]} />
          <ChartSummary
            title="Peso"
            periodLabel={periodLabel}
            series={[{ label: 'Peso', values: data.map((d) => d.value), kind: 'peso', band }]}
            labels={data.map((d) => d.date)}
            className="mt-2"
          />
        </>
      )}
    </div>
  );
}
