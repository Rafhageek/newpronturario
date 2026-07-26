'use client';

import { Line, LineChart, ReferenceArea, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { ExamMetric } from '@hubpatients/core';
import { AXIS_TICK_SIZE, useChartMotion, useChartPalette } from '@/components/analise/chart-theme';

/**
 * Evolução temporal de uma métrica vs. exames anteriores (mini-gráfico).
 *
 * Redesign "Papel Clínico Quente": a faixa de referência do laboratório era
 * pintada de VERDE (`#10B981`) — verde é "está bom", ou seja, interpretação. Aqui
 * ela virou a banda cinza-azulada neutra dos tokens (`palette.band`): enquadra a
 * leitura sem classificar o resultado. A cor da linha também deixou de mudar
 * conforme a tendência (azul "subiu" / cinza "estável" era outro julgamento por
 * cor) e a animação passou a respeitar `prefers-reduced-motion`.
 */
export function MetricEvolutionChart({ history }: { history: ExamMetric[] }) {
  const palette = useChartPalette();
  const motionProps = useChartMotion();

  const points = history
    .filter((h) => h.value != null)
    .map((h) => ({
      date: h.measured_at ? new Date(h.measured_at).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' }) : '',
      value: h.value as number,
    }));

  if (points.length < 2) {
    return <p className="text-xs text-muted">Sem histórico anterior para comparar.</p>;
  }

  const ref = history.find((h) => h.reference_min != null || h.reference_max != null);

  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          {ref?.reference_min != null && ref?.reference_max != null && (
            <ReferenceArea
              y1={ref.reference_min}
              y2={ref.reference_max}
              fill={palette.band}
              fillOpacity={0.12}
              stroke={palette.band}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
            />
          )}
          <XAxis dataKey="date" tick={{ fill: palette.axis, fontSize: AXIS_TICK_SIZE }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: palette.axis, fontSize: AXIS_TICK_SIZE }} tickLine={false} axisLine={false} width={36} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={palette.series[0]}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            {...motionProps}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
