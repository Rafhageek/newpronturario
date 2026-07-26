'use client';

import { Info } from 'lucide-react';
import { PREGNANCY_DISCLAIMER } from '@hubpatients/core';

/** Disclaimer permanente, não-dispensável — obrigatório nas telas de gestação. */
export function PregnancyDisclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="text-xs leading-relaxed text-fg-soft">{PREGNANCY_DISCLAIMER}</p>
    </div>
  );
}
