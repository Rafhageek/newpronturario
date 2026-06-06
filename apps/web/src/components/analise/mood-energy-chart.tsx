'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DiaryEntry } from '@vidalog/core';

export function MoodEnergyChart({ entries }: { entries: DiaryEntry[] }) {
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
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
          <Tooltip contentStyle={{ background: '#0d1a2b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94A3B8' }} />
          <Line type="monotone" dataKey="mood" name="Humor" stroke="#38BDF8" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="energy" name="Energia" stroke="#34D399" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
