'use client';

import { CalendarHeart } from 'lucide-react';
import { buildMoodGrid, moodPixelColor, MOOD_PIXEL_LABEL } from '@hubpatients/core';
import { useDiaryEntries } from '@hubpatients/supabase';
import { ChartSummary } from './chart-summary';

/** "Ano em cores" — cada dia é um pixel colorido pelo humor do diário (1-5). */
export function MoodYearMap({ patientId }: { patientId?: string }) {
  const { data: entries = [] } = useDiaryEntries(patientId);
  const moodByDate = new Map<string, number>();
  entries.forEach((e) => {
    if (e.mood != null) moodByDate.set(e.entry_date, e.mood);
  });
  const t = new Date();
  const endIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  const weeks = buildMoodGrid(endIso, 182);
  const hasData = moodByDate.size > 0;

  // Dias com registro, em ordem — alimentam o resumo e a tabela equivalente.
  const days = weeks
    .flat()
    .filter((d): d is string => d != null)
    .map((date) => ({ date, mood: moodByDate.get(date) ?? null }))
    .filter((d) => d.mood != null);

  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return y && m && d ? `${d}/${m}/${y}` : iso;
  };

  return (
    <section className="vl-rise rounded-2xl border border-line bg-surface p-5 shadow-paper">
      <div className="mb-3 flex items-center gap-2.5">
        <CalendarHeart className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="text-label font-semibold text-fg">Seu ano em cores</h3>
        <span className="text-caption text-muted">humor dos últimos 6 meses</span>
      </div>

      {!hasData ? (
        <p className="text-body-sm text-muted">Registre como você se sente no Diário para ver o mapa do seu ano. 💙</p>
      ) : (
        <>
          {/* O mapa é puramente visual: o leitor de tela recebe o resumo + a
              tabela abaixo, em vez de 182 quadradinhos sem rótulo. */}
          <div
            role="img"
            aria-label="Mapa de humor dos últimos 6 meses. O resumo em texto vem logo abaixo."
            className="flex gap-[3px] overflow-x-auto pb-1"
          >
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((date, di) => {
                  const mood = date ? moodByDate.get(date) : undefined;
                  const color = date ? moodPixelColor(mood) : null;
                  return (
                    <span
                      key={di}
                      className="h-3 w-3 shrink-0 rounded-[3px]"
                      style={{ background: color ?? 'var(--surface-2)' }}
                      // Texto no hover: o dado não fica só na cor.
                      title={date ? `${fmt(date)}: ${mood != null ? MOOD_PIXEL_LABEL[mood] ?? mood : 'sem registro'}` : ''}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
            {[1, 2, 3, 4, 5].map((m) => (
              <span key={m} className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: moodPixelColor(m) as string }} />
                {MOOD_PIXEL_LABEL[m]}
              </span>
            ))}
          </div>

          <ChartSummary
            title="Seu ano em cores"
            periodLabel="últimos 6 meses"
            series={[
              {
                label: 'Humor',
                values: days.map((d) => d.mood),
                unit: 'de 1 a 5',
                kind: 'humor',
                noun: { one: 'dia registrado', many: 'dias registrados' },
              },
            ]}
            labels={days.map((d) => fmt(d.date))}
            className="mt-3"
          />
        </>
      )}
    </section>
  );
}
