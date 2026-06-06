'use client';

import { AlertTriangle, Lock, ShieldCheck } from 'lucide-react';
import type { DrugInteraction } from '@vidalog/core';
import { INTERACTION_SEVERITY } from '@vidalog/core';

export function InteractionBanner({
  isPlus,
  interactions,
  onUpgrade,
}: {
  isPlus: boolean;
  interactions: DrugInteraction[];
  onUpgrade: () => void;
}) {
  if (!isPlus) {
    return (
      <button
        onClick={onUpgrade}
        className="flex w-full items-center gap-3 rounded-2xl border border-sky-400/20 bg-sky-500/[0.08] p-4 text-left transition hover:bg-sky-500/[0.12]"
      >
        <Lock className="h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-fg">Verificação de interações</p>
          <p className="text-xs text-muted">Desbloqueie alertas de interações entre seus medicamentos no Plus.</p>
        </div>
        <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-primary">PLUS</span>
      </button>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] p-4">
        <ShieldCheck className="h-5 w-5 text-emerald-400" />
        <p className="text-sm text-emerald-200">Nenhuma interação conhecida entre seus medicamentos ativos.</p>
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
            className={`flex items-start gap-3 rounded-2xl border p-4 ${alert ? 'border-rose-500/30 bg-rose-500/10' : 'border-amber-500/25 bg-amber-500/[0.08]'}`}
          >
            <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${alert ? 'text-rose-400' : 'text-amber-400'}`} />
            <div>
              <p className={`text-sm font-semibold ${alert ? 'text-rose-200' : 'text-amber-100'}`}>
                {i.drug_a} + {i.drug_b} · {meta.label}
              </p>
              <p className="mt-0.5 text-xs text-fg-soft">{i.description}</p>
              <p className="mt-1 text-[11px] text-muted">Converse com seu médico. O VidaLog não substitui avaliação profissional.</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
