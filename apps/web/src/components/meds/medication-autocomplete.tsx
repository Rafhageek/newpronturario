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
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LEGIBILIDADE 50+ e ALVOS DE TOQUE (correção 2026-08)
 * ════════════════════════════════════════════════════════════════════════════
 * Dívida da rodada anterior: o cartão do remédio e a barra de adesão subiram
 * para o piso de 15px, e este componente ficou para trás com uma escada de
 * tamanhos que ia ladeira abaixo — 14px no que a pessoa digita, 12px na marca e
 * na apresentação, 11px no aviso de procedência e 10px na tarja. A tarja é o
 * pior caso: "Controle especial" a 10px é a informação mais delicada da lista.
 *
 * Piso aplicado (o mesmo de `medication-card.tsx` / `adherence-bar.tsx`): nada
 * abaixo de `text-body-sm` (15px em `rem`, ~19,5px no Modo Sênior), o que a
 * pessoa digita e o nome da sugestão em `text-body` (17px), e tinta mínima
 * `fg-soft` no lugar de `muted`.
 *
 * CONTRASTES MEDIDOS (WCAG 2.x, sobre o fundo REAL de cada peça):
 *
 *   digitado    fg      sobre surface-2   claro 16,17:1 · escuro 13,39:1
 *   sugestão    fg      sobre surface     claro 17,16:1 · escuro 14,90:1
 *   marca/apres fg-soft sobre surface-2   claro  9,80:1 · escuro 10,82:1
 *               (era muted a 12px:        claro  5,56:1 · escuro  7,04:1)
 *   aviso/nota  fg-soft sobre surface     claro 10,40:1 · escuro 12,05:1
 *   tarja preta alert-ink sobre rose/15   claro  4,56:1 · escuro  6,00:1
 *               (medido sobre o item ATIVO, que é o fundo mais claro dos dois)
 *
 * ALVOS ≥44px: o botão "limpar" tinha ~16px (só o ícone) e cada sugestão da
 * lista ~36px. Ambos passam a `min-h-11` — `min-`, nunca `h-11` fixo, porque no
 * Modo Sênior o alvo precisa CRESCER com a fonte em vez de cortar o rótulo.
 *
 * ⚠️ ESTE ARQUIVO É MODELO. O autocomplete de CID-10 (busca de condições, a
 * queixa do cliente de que "não consegui inserir minhas outras doenças") está
 * sendo construído a partir daqui. O padrão que ele deve copiar:
 *   · combobox ARIA completo: `role="combobox"` + `aria-expanded` +
 *     `aria-controls` + `aria-activedescendant` apontando para o item ativo;
 *   · teclado inteiro: ↑ ↓ Enter Esc Tab, e o Enter só é interceptado quando há
 *     item destacado — senão o formulário envia normalmente;
 *   · `onMouseDown` com `preventDefault` nas opções, senão o `blur` do input
 *     fecha a lista antes do clique registrar;
 *   · e o principal: o texto digitado SEMPRE vale, com ou sem sugestão. A lista
 *     ajuda a achar, não é uma lista taxativa de opções permitidas.
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
        <Search className="h-5 w-5 shrink-0 text-fg-soft" aria-hidden="true" />
        {/*
         * `text-body` (17px) no que a pessoa DIGITA: é o texto que ela relê para
         * conferir se escreveu o nome do remédio certo. Bônus: a partir de 16px
         * o Safari do iPhone para de dar zoom automático ao focar o campo — o
         * salto de layout que atrapalhava quem digita com uma mão só.
         *
         * `min-h-11` em vez de `h-11`: com a fonte ampliada o campo cresce.
         */}
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
          className="min-h-11 w-full bg-transparent py-2 text-body text-fg outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
        />
        {value && !disabled && (
          // Era um ícone solto de 16px: alvo real de ~16px, contra o piso de 44.
          // `-mr-1.5` devolve ao campo o espaço que o alvo maior toma, para o
          // botão não empurrar o texto digitado.
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
            className="-mr-1.5 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-fg-soft transition hover:text-fg"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Sugestões de medicamento"
          className="absolute z-20 mt-1 max-h-96 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg shadow-black/5"
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
                  className={`flex min-h-11 w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition ${
                    i === active ? 'bg-surface-2' : 'hover:bg-surface-2'
                  }`}
                >
                  <Pill className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="text-body font-semibold text-fg">{med.activeIngredient}</span>
                      {med.brand && <span className="text-body-sm text-fg-soft">({med.brand})</span>}
                    </span>
                    {/*
                     * `truncate` saiu: a apresentação ("comprimido revestido
                     * 50mg") é o que distingue duas linhas quase iguais da lista,
                     * e cortá-la com reticências apagava justamente a diferença.
                     * A linha quebra; a lista fica com alturas desiguais, o que é
                     * um preço menor que esconder a dose.
                     */}
                    <span className="mt-0.5 block text-body-sm text-fg-soft">
                      {medicamentoPresentation(med)}
                    </span>
                  </span>
                  {badge && (
                    // "Controle especial" / "Receita retida" a 10px era quase
                    // invisível. A tarja é regra de dispensação: 15px e tinta de
                    // token medido (≥4,56:1 no pior fundo, o item destacado).
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-body-sm font-semibold ${badge.className}`}
                    >
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
        // A frase que impede a leitura "o app não aceita o meu remédio". É a
        // mesma confusão que o cliente teve na tela de Condições, e ela só
        // desfaz o mal-entendido se for lida — daí 15px em `fg-soft`.
        <p className="mt-1.5 text-body-sm text-fg-soft">
          Não achamos esse nome na nossa lista — pode digitar do seu jeito e salvar mesmo assim.
        </p>
      )}

      {showDisclaimer && (
        // `leading-4` (16px de entrelinha sob 11px de texto) saiu junto com o
        // tamanho: procedência do dado é o tipo de nota que só serve se der para
        // ler sem esforço.
        <p id={noteId} className="mt-1.5 text-body-sm leading-relaxed text-fg-soft">
          {MEDICAMENTOS_BR_DISCLAIMER}
        </p>
      )}
    </div>
  );
}
