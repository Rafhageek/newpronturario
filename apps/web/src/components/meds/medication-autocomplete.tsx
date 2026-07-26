'use client';

/**
 * Campo de busca com sugestões da base embarcada de medicamentos (Anvisa).
 *
 * Pronto para plugar em qualquer formulário: é um input controlado. O texto
 * digitado continua valendo mesmo sem escolher sugestão — a lista AJUDA a achar
 * o nome, não obriga a usar um item da base (remédio manipulado, importado ou
 * fora do recorte tem que caber).
 *
 * O que este componente NÃO faz: prescrever, sugerir dose, dizer que o
 * medicamento serve para a pessoa. Só completa nome. Ver `MEDICAMENTOS_BR_DISCLAIMER`.
 */

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Pill, Search, X } from 'lucide-react';
import {
  MEDICAMENTOS_BR_DISCLAIMER,
  medicamentoPresentation,
  searchMedicamentos,
  type MedicamentoBr,
  type MedicamentoTarja,
} from '@hubpatients/core';

/** Mínimo de caracteres para começar a sugerir (2 evita listar meia base). */
const MIN_QUERY = 2;

const TARJA_BADGE: Record<MedicamentoTarja, { label: string; className: string } | null> = {
  'sem-tarja': { label: 'Venda livre', className: 'bg-emerald-500/15 text-status-ok-ink' },
  vermelha: { label: 'Receita', className: 'bg-amber-500/15 text-status-attention-ink' },
  'vermelha-retencao': { label: 'Receita retida', className: 'bg-orange-500/15 text-status-attention-ink' },
  preta: { label: 'Controle especial', className: 'bg-rose-500/15 text-status-alert-ink' },
};

export function MedicationAutocomplete({
  value,
  onChange,
  onSelect,
  id,
  name,
  placeholder = 'Ex.: Losartana, Puran T4, AAS…',
  limit = 8,
  disabled,
  required,
  autoFocus,
  showDisclaimer = true,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: {
  /** Texto do campo (controlado). */
  value: string;
  /** Chamado a cada tecla — é isto que o formulário deve salvar. */
  onChange: (value: string) => void;
  /** Chamado quando a pessoa escolhe uma sugestão (para preencher dose/forma). */
  onSelect?: (med: MedicamentoBr) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  /** Quantas sugestões mostrar. */
  limit?: number;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  /** Nota de procedência sob o campo. Só desligue se já houver aviso na tela. */
  showDisclaimer?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const reactId = useId();
  const inputId = id ?? `med-ac-${reactId}`;
  const listId = `${inputId}-list`;
  const noteId = `${inputId}-note`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = value.trim();
  const results = useMemo(
    () => (query.length >= MIN_QUERY ? searchMedicamentos(query, limit) : []),
    [query, limit],
  );
  const expanded = open && results.length > 0;

  function choose(med: MedicamentoBr) {
    onChange(med.activeIngredient);
    onSelect?.(med);
    setOpen(false);
    setActive(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!expanded) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        e.preventDefault();
        setOpen(true);
        setActive(0);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      const med = active >= 0 ? results[active] : undefined;
      if (med) {
        // Só intercepta o Enter quando há sugestão destacada — senão o
        // formulário continua enviando normalmente.
        e.preventDefault();
        choose(med);
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={ariaInvalid}
          aria-describedby={[ariaDescribedBy, showDisclaimer ? noteId : null].filter(Boolean).join(' ') || undefined}
          value={value}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
        />
        {value && !disabled && (
          <button
            type="button"
            aria-label="Limpar"
            // onMouseDown evita o blur do input antes do clique registrar.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              setActive(-1);
              inputRef.current?.focus();
            }}
            className="shrink-0 text-muted transition hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Sugestões de medicamento"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg shadow-black/5"
        >
          {results.map((med, i) => {
            const badge = TARJA_BADGE[med.tarja];
            return (
              <li key={med.id}>
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(med)}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                    i === active ? 'bg-surface-2' : 'hover:bg-surface-2'
                  }`}
                >
                  <Pill className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-fg">{med.activeIngredient}</span>
                      {med.brand && <span className="text-xs text-muted">({med.brand})</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {medicamentoPresentation(med)}
                    </span>
                  </span>
                  {badge && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {query.length >= MIN_QUERY && results.length === 0 && (
        <p className="mt-1.5 text-xs text-muted">
          Não achamos esse nome na nossa lista — pode digitar do seu jeito e salvar mesmo assim.
        </p>
      )}

      {showDisclaimer && (
        <p id={noteId} className="mt-1.5 text-[11px] leading-4 text-muted">
          {MEDICAMENTOS_BR_DISCLAIMER}
        </p>
      )}
    </div>
  );
}
