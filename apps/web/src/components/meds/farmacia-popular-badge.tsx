'use client';

import { useId, useState } from 'react';
import { Info, Store } from 'lucide-react';
import {
  FARMACIA_POPULAR_LABEL,
  FARMACIA_POPULAR_NOTE,
  farmaciaPopularCategoryLabel,
  type FarmaciaPopularItem,
} from '@hubpatients/core';

/**
 * Etiqueta discreta para medicamentos cujo princípio ativo consta no elenco
 * gratuito do Farmácia Popular. É informativa: não afirma que a pessoa "tem
 * direito", só que o item está no elenco — a retirada depende de receita válida
 * e da autorização no Meu SUS Digital.
 */
export function FarmaciaPopularBadge({
  item,
  className = '',
}: {
  item?: FarmaciaPopularItem | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const noteId = useId();

  return (
    <div className={`min-w-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={noteId}
        title={FARMACIA_POPULAR_NOTE}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold leading-none text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
      >
        <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{FARMACIA_POPULAR_LABEL}</span>
        <Info className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
      </button>

      <div id={noteId} role="note" hidden={!open}>
        <div className="mt-2 max-w-xl rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
          {item && (
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              {item.activeIngredient} · {farmaciaPopularCategoryLabel(item)}
            </p>
          )}
          <p className="mt-1 text-xs leading-relaxed text-fg-soft">{FARMACIA_POPULAR_NOTE}</p>
          {item?.note && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              Apresentações no elenco: {item.note}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
