'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  WHATS_NEW_ITEMS,
  WHATS_NEW_STORAGE_KEY,
  WHATS_NEW_TITLE,
  WHATS_NEW_VERSION,
} from '@hubpatients/core';
import { Modal } from '@/components/ui/modal';

/**
 * Modal "O que mudou", exibido UMA vez por versão. Espelha o
 * `whats-new-sheet.tsx` do mobile e lê o mesmo conteúdo do `@hubpatients/core`,
 * então os dois não saem de sincronia.
 *
 * Decisões que valem registro:
 *  - Marca como visto ao ABRIR, não ao fechar: quem fechar a aba no meio não é
 *    perseguido pelo mesmo aviso na próxima visita.
 *  - `localStorage` dentro de `useEffect`: em SSR ele não existe, e ler no corpo
 *    do componente quebraria a hidratação.
 *  - Falha de acesso ao armazenamento (modo privativo, storage cheio) não mostra
 *    erro nem bloqueia nada — é preferência, não dado clínico.
 *  - A animação e o respeito a `prefers-reduced-motion` já vêm do `Modal`.
 */
export function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(WHATS_NEW_STORAGE_KEY) === WHATS_NEW_VERSION) return;
      setOpen(true);
      localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_VERSION);
    } catch {
      // sem popup neste caso — de propósito
    }
  }, []);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={WHATS_NEW_TITLE}
      description="A atualização já está no ar — não é preciso fazer nada."
      className="max-w-lg"
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2.5 text-sm text-fg-soft">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          Veja o que mudou nesta versão.
        </p>

        <ul className="space-y-3.5">
          {WHATS_NEW_ITEMS.map((item) => (
            <li key={item.title}>
              <p className="text-sm font-semibold text-fg">{item.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-fg-soft">{item.body}</p>
            </li>
          ))}
        </ul>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Entendi
          </button>
        </div>
      </div>
    </Modal>
  );
}
