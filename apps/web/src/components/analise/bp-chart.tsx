'use client';

import { useId } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Vital } from '@hubpatients/core';
import { ChartSummary } from './chart-summary';
import {
  AXIS_TICK_SIZE,
  bandColors,
  useChartMotion,
  useChartPalette,
} from './chart-theme';
import {
  ReferenceBandLegend,
  bandRangeText,
  referenceBandElements,
  referenceBandFor,
} from './reference-band';

/**
 * Pressão arterial com faixas de referência NEUTRAS.
 *
 * Substitui o `dashboard/bp-chart` nas telas de Análise: aquele pinta zonas em
 * verde/amarelo/vermelho, o que já é um julgamento ("bom/ruim"). Aqui a faixa é
 * cinza-azulada + hachurada + rotulada — enquadra a leitura sem classificar o
 * resultado. Mesma assinatura (`{ vitals }`), é drop-in.
 */
export function BloodPressureChart({
  vitals,
  showReferenceBand = true,
  showSummary = false,
  periodLabel,
}: {
  vitals: Vital[];
  showReferenceBand?: boolean;
  showSummary?: boolean;
  periodLabel?: string;
}) {
  const uid = useId();
  const palette = useChartPalette();
  const motionProps = useChartMotion();
  const sysColor = palette.series[0];
  const diaColor = palette.series[1];
  const diaDash = palette.dash[1] ?? '6 3';
  const data = vitals.map((v) => ({
    date: new Date(v.measured_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    sys: v.value_primary,
    dia: v.value_secondary,
  }));

  const sysBand = showReferenceBand ? referenceBandFor('pressao_sistolica') : null;
  const diaBand = showReferenceBand ? referenceBandFor('pressao_diastolica') : null;

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
        Sem registros de pressão no período. Adicione em Medicamentos → Sinais vitais.
      </div>
    );
  }

  return (
    <div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            {referenceBandElements(sysBand, uid, {
              colors: bandColors(palette),
              labelText: sysBand ? `sistólica — faixa de referência ${bandRangeText(sysBand)}` : undefined,
            })}
            {referenceBandElements(diaBand, uid, {
              colors: bandColors(palette),
              labelText: diaBand ? `diastólica — faixa de referência ${bandRangeText(diaBand)}` : undefined,
            })}
            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: palette.axis, fontSize: AXIS_TICK_SIZE }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={[40, 200]} tick={{ fill: palette.axis, fontSize: AXIS_TICK_SIZE }} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={<BpTooltip />} />
            <Line type="monotone" dataKey="sys" name="Sistólica" stroke={sysColor} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} {...motionProps} />
            {/* Tracejado: distingue as séries sem depender de cor. */}
            <Line type="monotone" dataKey="dia" name="Diastólica" stroke={diaColor} strokeWidth={2} strokeDasharray={diaDash} dot={false} {...motionProps} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-5 rounded-full" style={{ background: sysColor }} />
          Sistólica (linha contínua)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-0.5 w-5"
            style={{ backgroundImage: `repeating-linear-gradient(90deg, ${diaColor} 0 4px, transparent 4px 7px)` }}
          />
          Diastólica (linha tracejada)
        </span>
      </div>

      {showSummary && (
        <>
          <ReferenceBandLegend bands={[sysBand, diaBand]} />
          <ChartSummary
            title="Pressão arterial"
            periodLabel={periodLabel}
            series={[
              { label: 'Sistólica', values: data.map((d) => d.sys), kind: 'pressao_sistolica', band: sysBand },
              { label: 'Diastólica', values: data.map((d) => d.dia), kind: 'pressao_diastolica', band: diaBand },
            ]}
            labels={data.map((d) => d.date)}
            className="mt-2"
          />
        </>
      )}
    </div>
  );
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function BpTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-caption shadow-paper-lg">
      <p className="mb-1 font-semibold text-muted">{label}</p>
      {payload.map((p) => (
        // A cor da série vai no marcador, não no texto: uma das séries do
        // gráfico não alcança 4,5:1 sobre a superfície do card.
        <p key={p.name} className="flex items-center gap-1.5 text-fg">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="hp-num font-semibold">{p.value} mmHg</span>
        </p>
      ))}
    </div>
  );
}
