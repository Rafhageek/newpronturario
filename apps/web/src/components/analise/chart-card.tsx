'use client';

import { Table2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TableColumn {
  key: string;
  label: string;
}

/** Card de gráfico com acessibilidade: figure + aria-label + tabela alternativa. */
export function ChartCard({
  icon: Icon,
  title,
  ariaLabel,
  children,
  summary,
  tableColumns,
  tableRows,
}: {
  icon: LucideIcon;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
  summary: React.ReactNode;
  tableColumns: TableColumn[];
  tableRows: Record<string, string | number>[];
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
      </div>

      <figure role="img" aria-label={ariaLabel} className="m-0">
        {children}
      </figure>

      <div className="mt-3">{summary}</div>

      {tableRows.length > 0 && (
        <details className="mt-3 text-xs">
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
