'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { weightGainRange, type PregnancyWeightLog } from '@hubpatients/core';
import {
  AXIS_TICK_SIZE,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipStyle,
  useChartMotion,
  useChartPalette,
} from '@/components/analise/chart-theme';

/**
 * Ganho de peso por semana com a FAIXA recomendada IOM (sem julgamento):
 * duas linhas pontilhadas (mínimo/máximo) e a curva da gestante.
 * O ganho é calculado em relação ao primeiro peso registrado (baseline).
 *
 * Redesign: a curva da gestante era `#ec4899` (rosa fixo, fora de qualquer
 * paleta e sem versão de tema escuro) e agora vem de `useChartPalette()`. Os
 * limites IOM usam a cor de banda de referência dos tokens, e a animação
 * respeita `prefers-reduced-motion` (o Recharts 2.15 não respeita sozinho).
 */
export function WeightGainChart({
  weightLog,
  bmi,
}: {
  weightLog: PregnancyWeightLog[];
  bmi: number | null;
}) {
  const palette = useChartPalette();
  const motionProps = useChartMotion();

  const sorted = [...weightLog].sort((a, b) => a.week - b.week);
  const baseline = sorted[0]?.weight_kg ?? null;
  const userByWeek = new Map(sorted.map((w) => [w.week, w.weight_kg]));

  const data = Array.from({ length: 40 }, (_, i) => {
    const week = i + 1;
    const range = bmi != null ? weightGainRange(bmi, week) : null;
    const userKg = userByWeek.get(week);
    return {
      week,
      min: range?.min ?? null,
      max: range?.max ?? null,
      user: userKg != null && baseline != null ? Math.round((userKg - baseline) * 10) / 10 : null,
    };
  });

  if (sorted.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
        Registre seu peso para ver a evolução comparada à faixa de referência.
      </p>
    );
  }

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: AXIS_TICK_SIZE, fill: palette.axis }}
              ticks={[1, 8, 14, 20, 28, 36, 40]}
            />
            <YAxis tick={{ fontSize: AXIS_TICK_SIZE, fill: palette.axis }} unit="kg" width={48} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
              labelFormatter={(w) => `Semana ${w}`}
              formatter={(v: number, name) => [
                `${v} kg`,
                name === 'user' ? 'Seu ganho' : name === 'min' ? 'Mín. IOM' : 'Máx. IOM',
              ]}
            />
            {bmi != null && (
              <>
                <Line type="monotone" dataKey="min" stroke={palette.band} strokeDasharray="5 5" dot={false} strokeWidth={1.5} connectNulls {...motionProps} />
                <Line type="monotone" dataKey="max" stroke={palette.band} strokeDasharray="5 5" dot={false} strokeWidth={1.5} connectNulls {...motionProps} />
              </>
            )}
            <Line type="monotone" dataKey="user" stroke={palette.series[0]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls {...motionProps} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-caption text-hint">
        {bmi != null
          ? 'Linhas pontilhadas: faixa de ganho recomendada (IOM 2009). Referência, não julgamento.'
          : 'Informe sua altura no Perfil para ver a faixa recomendada.'}
      </p>
    </div>
  );
}
