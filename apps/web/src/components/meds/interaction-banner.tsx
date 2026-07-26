'use client';

import { AlertTriangle, Info } from 'lucide-react';
import type { DrugInteraction } from '@hubpatients/core';
import { INTERACTION_SEVERITY } from '@hubpatients/core';

export function InteractionBanner({
  interactions,
  isLoading,
  isError,
}: {
  interactions: DrugInteraction[];
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4">
        <Info className="h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-fg-soft">Verificando possíveis interações na base disponível…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-attention-ink" />
        <p className="text-sm text-amber-800 dark:text-amber-100">
          Não foi possível verificar possíveis interações agora. Confira os princípios ativos e consulte um médico ou farmacêutico antes de tomar qualquer decisão.
        </p>
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-fg-soft">
          A base atual não encontrou correspondências entre os nomes cadastrados. A verificação não é
          completa e não substitui a avaliação de um médico ou farmacêutico. Confira os princípios ativos e as bulas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {interactions.map((i) => {
        const meta = INTERACTION_SEVERITY[i.severity];
        const alert = meta.tone === 'alert';
        return (
          <div
            key={i.id}
            role={alert ? 'alert' : undefined}
            aria-live={alert ? 'assertive' : undefined}
            className={`flex items-start gap-3 rounded-2xl border p-4 ${alert ? 'border-rose-500/40 bg-rose-500/15' : 'border-amber-500/25 bg-amber-500/[0.08]'}`}
          >
            <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${alert ? 'text-status-alert-ink' : 'text-status-attention-ink'}`} />
            <div>
              <p className={`text-sm font-semibold ${alert ? 'text-rose-700 dark:text-rose-200' : 'text-amber-700 dark:text-amber-100'}`}>
                {i.drug_a} + {i.drug_b} · {meta.label}
              </p>
              <p className="mt-0.5 text-xs text-fg-soft">{i.description}</p>
              <p className="mt-1 text-[11px] text-muted">Converse com seu médico. O HubPatients não substitui avaliação profissional.</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
