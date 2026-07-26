'use client';

import { Info } from 'lucide-react';
import { PROFESSIONAL_DISCLAIMER } from '@hubpatients/core';

/**
 * Rodapé ético obrigatório em respostas de usuários com selo profissional.
 * A badge médica NUNCA implica consulta.
 */
export function ProfessionalDisclaimer({ className = '' }: { className?: string }) {
  return (
    <p
      className={`mt-2 flex items-start gap-1.5 border-t border-line/60 pt-2 text-[11px] leading-relaxed text-muted ${className}`}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{PROFESSIONAL_DISCLAIMER}</span>
    </p>
  );
}
