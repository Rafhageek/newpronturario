'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { CYCLE_PRIVACY_NOTICE } from '@hubpatients/core';

const STORAGE_KEY = 'vl_cycle_privacy_seen';

/**
 * Aviso de privacidade exibido na PRIMEIRA visita às telas do ciclo.
 * Dado íntimo: deixa claro que tudo é privado e o compartilhamento é opt-in.
 * Dispensável; a marca de "lido" fica em localStorage ('vl_cycle_privacy_seen').
 */
export function PrivacyBanner() {
  // Começa oculto para evitar flash antes de checar o localStorage (SSR-safe).
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== '1') setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignora indisponibilidade do storage; só não persiste o "lido"
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="note"
      className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/[0.08] px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-700" />
        <p className="flex-1 text-sm leading-relaxed text-fg-soft">{CYCLE_PRIVACY_NOTICE}</p>
        <button
          onClick={dismiss}
          aria-label="Entendi, dispensar aviso de privacidade"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 pl-8">
        <button
          onClick={dismiss}
          className="inline-flex h-9 items-center rounded-lg bg-fuchsia-500/15 px-3 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-500/25 dark:text-fuchsia-300"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
