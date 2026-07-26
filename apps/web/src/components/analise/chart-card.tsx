'use client';

import { useId } from 'react';
import { Table2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  ChartSummary,
  extractPeriodLabel,
  seriesFromTableRows,
  type SummarySeries,
} from './chart-summary';
import { ReferenceBandLegend, referenceBandFor, type MeasureKind, type ReferenceBand } from './reference-band';

export interface TableColumn {
  key: string;
  label: string;
}

/**
 * Card de gráfico acessível: figure + aria-label + **resumo em frase** +
 * legenda da faixa de referência + tabela alternativa.
 *
 * O SVG do gráfico não é lido por leitor de tela; quem carrega a informação é
 * a frase-resumo (visível, ajuda todo mundo) e a tabela. A frase é derivada
 * automaticamente de `tableColumns`/`tableRows` — nenhuma página precisa mudar
 * para ganhar o recurso. Passe `summarySeries` para controlar manualmente.
 */
export function ChartCard({
  icon: Icon,
  title,
  ariaLabel,
  children,
  summary,
  tableColumns,
  tableRows,
  periodLabel,
  summarySeries,
  bandOverrides,
  autoSummary = true,
}: {
  icon: LucideIcon;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
  summary?: React.ReactNode;
  tableColumns: TableColumn[];
  tableRows: Record<string, string | number>[];
  /** "últimos 30 dias". Se omitido, é extraído do `ariaLabel`. */
  periodLabel?: string;
  /** Séries explícitas para o resumo (desliga a derivação automática). */
  summarySeries?: SummarySeries[];
  /** Faixas que dependem de contexto (ex.: peso precisa da altura). */
  bandOverrides?: Partial<Record<MeasureKind, ReferenceBand | null>>;
  autoSummary?: boolean;
}) {
  const uid = useId();
  const summaryId = `${uid}-resumo`;

  const derived = seriesFromTableRows(title, tableColumns, tableRows, { bandOverrides });
  const series = summarySeries ?? (autoSummary ? derived.series : []);
  const period = periodLabel ?? extractPeriodLabel(ariaLabel);

  const bands: (ReferenceBand | null)[] = series.map((s) =>
    s.band !== undefined ? s.band : s.kind ? referenceBandFor(s.kind) : null,
  );

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-paper">
      <div className="mb-3 flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-label font-semibold text-fg">{title}</h2>
      </div>

      <figure
        role="img"
        aria-label={ariaLabel}
        aria-describedby={series.length > 0 ? summaryId : undefined}
        className="m-0"
      >
        {children}
      </figure>

      <ReferenceBandLegend bands={bands} />

      {series.length > 0 && (
        <ChartSummary
          id={summaryId}
          title={title}
          periodLabel={period}
          series={series}
          labels={derived.labels}
          // A tabela visível abaixo já é a equivalência acessível dos dados;
          // repetir tudo em `sr-only` só atrapalharia o leitor de tela.
          includeTable={tableRows.length === 0}
          className="mt-2"
        />
      )}

      {summary && <div className="mt-3">{summary}</div>}

      {tableRows.length > 0 && (
        <details className="mt-3 text-caption">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-muted hover:text-fg">
            <Table2 className="h-3.5 w-3.5" /> Ver dados em tabela (acessível)
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{ariaLabel}</caption>
              <thead>
                <tr className="text-muted">
                  {tableColumns.map((c) => (
                    <th key={c.key} scope="col" className="py-1 pr-4 font-medium">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={i} className="border-t border-line text-fg-soft">
                    {tableColumns.map((c) => (
                      <td key={c.key} className="py-1 pr-4">{row[c.key] ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
