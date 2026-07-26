'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Info } from 'lucide-react';
import {
  PAIN_DISCLAIMER,
  bodyRegionLabel,
  bodyRegion,
  summarizePainHistory,
  painMigrationDetection,
  type PainPointLike,
} from '@hubpatients/core';
import { usePainHistory } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { BodyPainMap, type BodyPainMapPoint } from '@/components/diary/body-pain-map';

const PERIODS = [
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
] as const;

function sinceDateISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default function HistoricoDorPage() {
  const { user } = useAuth();
  const [days, setDays] = useState<number>(30);

  const since = useMemo(() => sinceDateISO(days), [days]);
  const { data: points, isLoading, isError } = usePainHistory(user?.id, since);

  const list = points ?? [];

  // Resumo/ranking (helpers puros do core — descritivos, nunca interpretativos).
  const summary = useMemo(
    () => summarizePainHistory(list as PainPointLike[], days),
    [list, days],
  );

  const migration = useMemo(
    () => painMigrationDetection(list as PainPointLike[]),
    [list],
  );

  // Heatmap: cada região colorida pela intensidade MÁXIMA registrada no período.
  const heatmapPoints: BodyPainMapPoint[] = useMemo(
    () =>
      summary.map((s) => ({
        bodyRegion: s.region,
        intensity: s.maxIntensity,
      })),
    [summary],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/diario"
          className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Voltar ao diário"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
          Histórico de dor
        </h1>
      </div>

      {/* Seletor de período + exportação (em breve) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex rounded-xl border border-line bg-surface p-1"
          role="group"
          aria-label="Período do histórico"
        >
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              aria-pressed={days === p.days}
              className={`min-h-[44px] rounded-lg px-4 text-sm font-medium transition ${
                days === p.days ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled
          title="Exportação em PDF em breve"
          className="inline-flex min-h-[44px] cursor-not-allowed items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-muted opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden />
          Exportar (em breve)
        </button>
      </div>

      {/* Estados */}
      {isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
      ) : isError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
          Não foi possível carregar seu histórico de dor. Tente novamente mais tarde.
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-16 text-center">
          <p className="text-sm text-muted">Nenhum registro de dor neste período.</p>
          <Link
            href="/diario/novo"
            className="mt-3 text-sm font-medium text-primary hover:underline"
          >
            Marcar dor em um novo registro →
          </Link>
        </div>
      ) : (
        <>
          {/* Nota factual de migração (sem interpretar) */}
          {migration && (
            <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-status-info-ink" aria-hidden />
              <p className="text-xs leading-relaxed text-fg-soft">
                Sua dor mais registrada mudou de{' '}
                <strong className="text-fg">{bodyRegionLabel(migration.from)}</strong> para{' '}
                <strong className="text-fg">{bodyRegionLabel(migration.to)}</strong> no período.
              </p>
            </div>
          )}

          {/* Heatmap em modo leitura */}
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-1 text-sm font-semibold text-fg">Mapa acumulado</h2>
            <p className="mb-4 text-xs text-muted">
              Cada região é colorida pela maior intensidade registrada no período.
            </p>
            <BodyPainMap points={heatmapPoints} readOnly />
          </section>

          {/* Ranking textual */}
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-fg">
              Regiões mais registradas
            </h2>
            <ul className="space-y-2">
              {summary.map((s) => {
                const known = bodyRegion(s.region) != null;
                return (
                  <li
                    key={s.region}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-fg">
                      {known ? bodyRegionLabel(s.region) : s.region}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-muted">
                      <span>
                        {s.count} {s.count === 1 ? 'registro' : 'registros'}
                      </span>
                      <span>média {s.avgIntensity}/10</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {/* Disclaimer permanente */}
      <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-status-info-ink" aria-hidden />
        <p className="text-xs leading-relaxed text-fg-soft">{PAIN_DISCLAIMER}</p>
      </div>
    </div>
  );
}
