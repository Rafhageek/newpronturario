'use client';

import { Info, Siren } from 'lucide-react';
import { DISCLAIMERS } from '@vidalog/core';

/** Disclaimer permanente, não-dispensável (obrigatório nas telas de exame). */
export function ExamDisclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="text-xs leading-relaxed text-fg-soft">
        Estas informações são educativas. Apenas seu médico pode interpretar seus exames com seu
        contexto completo. {DISCLAIMERS.examInterpretation}
      </p>
    </div>
  );
}

/** Banner vermelho para valores críticos — recomenda procurar atendimento. */
export function CriticalBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3">
      <Siren className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
      <div>
        <p className="text-sm font-semibold text-rose-200">Atenção: valor fora de faixa segura</p>
        <p className="mt-0.5 text-xs text-rose-200/80">
          Um ou mais resultados estão bem alterados. Não espere — procure seu médico ou um
          serviço de saúde. Em emergência, ligue 192 (SAMU).
        </p>
      </div>
    </div>
  );
}
