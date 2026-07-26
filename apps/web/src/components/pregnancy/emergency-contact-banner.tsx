'use client';

import { Phone, Siren } from 'lucide-react';
import { PREGNANCY_EMERGENCY_NOTICE } from '@hubpatients/core';

/**
 * Banner de emergência PERMANENTE no topo da rota de gestação.
 * O app NÃO interpreta sinais — apenas oferece o contato direto do obstetra
 * e da maternidade de referência cadastrados pela gestante.
 */
export function EmergencyContactBanner({
  obstetricianPhone,
  maternityPhone,
}: {
  obstetricianPhone?: string | null;
  maternityPhone?: string | null;
}) {
  return (
    <div
      role="note"
      className="rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <Siren className="mt-0.5 h-5 w-5 shrink-0 text-status-alert-ink" />
        <p className="text-sm leading-relaxed text-rose-700 dark:text-rose-200">
          {PREGNANCY_EMERGENCY_NOTICE}
        </p>
      </div>
      {(obstetricianPhone || maternityPhone) && (
        <div className="mt-3 flex flex-wrap gap-2 pl-8">
          {obstetricianPhone && (
            <a
              href={`tel:${obstetricianPhone}`}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <Phone className="h-4 w-4" /> Ligar para o obstetra
            </a>
          )}
          {maternityPhone && (
            <a
              href={`tel:${maternityPhone}`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-500/50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-500/10 dark:text-rose-200"
            >
              <Phone className="h-4 w-4" /> Ligar para a maternidade
            </a>
          )}
        </div>
      )}
    </div>
  );
}
