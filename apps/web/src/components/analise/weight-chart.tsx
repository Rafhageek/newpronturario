'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Vital } from '@vidalog/core';

export function WeightChart({ vitals }: { vitals: Vital[] }) {
  const data = vitals.map((v) => ({
    date: new Date(v.measured_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    value: v.value_primary,
  }));
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
        Sem registros de peso no período.
      </div>
    );
  }
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
          <Tooltip contentStyle={{ background: '#0d1a2b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94A3B8' }} formatter={(v: number) => [`${v} kg`, 'Peso']} />
          <Line type="monotone" dataKey="value" stroke="#34D399" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
