'use client';

import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Vital } from '@vidalog/core';

export function GlucoseChart({ vitals }: { vitals: Vital[] }) {
  const data = vitals.map((v) => ({
    date: new Date(v.measured_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    value: v.value_primary,
  }));
  if (data.length === 0) return <Empty />;

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <ReferenceArea y1={0} y2={100} fill="#10B981" fillOpacity={0.06} />
          <ReferenceArea y1={100} y2={126} fill="#F59E0B" fillOpacity={0.08} />
          <ReferenceArea y1={126} y2={400} fill="#EF4444" fillOpacity={0.08} />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[40, 'dataMax + 20']} tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
          <Tooltip contentStyle={{ background: '#0d1a2b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94A3B8' }} formatter={(v: number) => [`${v} mg/dL`, 'Glicemia']} />
          <Line type="monotone" dataKey="value" stroke="#38BDF8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
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
