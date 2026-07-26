'use client';

import { Info } from 'lucide-react';
import { CHILD_DISCLAIMER } from '@hubpatients/core';

/** Disclaimer permanente, não-dispensável — obrigatório nas telas da criança (LGPD Art. 14). */
export function ChildDisclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="text-xs leading-relaxed text-fg-soft">{CHILD_DISCLAIMER}</p>
    </div>
  );
}
