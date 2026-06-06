'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Vital } from '@vidalog/core';

interface Point {
  date: string;
  sys: number;
  dia: number | null;
}

export function BloodPressureChart({ vitals }: { vitals: Vital[] }) {
  const data: Point[] = vitals.map((v) => ({
    date: new Date(v.measured_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    sys: v.value_primary,
    dia: v.value_secondary,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
        Sem registros de pressão nos últimos 30 dias. Adicione em Medicamentos → Sinais vitais.
      </div>
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          {/* Zonas de referência (não diagnóstico) */}
          <ReferenceArea y1={40} y2={130} fill="#10B981" fillOpacity={0.06} />
          <ReferenceArea y1={130} y2={140} fill="#F59E0B" fillOpacity={0.08} />
          <ReferenceArea y1={140} y2={200} fill="#EF4444" fillOpacity={0.08} />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[40, 200]} tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
          <Tooltip content={<DarkTooltip />} />
          <Line type="monotone" dataKey="sys" name="Sistólica" stroke="#38BDF8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="dia" name="Diastólica" stroke="#22D3EE" strokeWidth={2} strokeDasharray="4 3" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function DarkTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-fg-soft">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value} mmHg</span>
        </p>
      ))}
    </div>
  );
}
