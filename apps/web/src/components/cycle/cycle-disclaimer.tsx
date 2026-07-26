'use client';

import { Info } from 'lucide-react';
import { CYCLE_DISCLAIMER } from '@hubpatients/core';

/** Disclaimer permanente, não-dispensável — obrigatório em todas as telas do ciclo. */
export function CycleDisclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.06] px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-700" />
      <p className="text-xs leading-relaxed text-fg-soft">{CYCLE_DISCLAIMER}</p>
    </div>
  );
}
