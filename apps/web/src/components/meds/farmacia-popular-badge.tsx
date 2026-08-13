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
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LEGIBILIDADE 50+ (correção 2026-08) — dívida da rodada anterior
 * ════════════════════════════════════════════════════════════════════════════
 * O cartão do remédio e a barra de adesão subiram para o piso de 15px na semana
 * passada; este vizinho ficou para trás e virou o texto MAIS apagado da tela de
 * Medicamentos — que é justamente a tela da queixa do idealizador (54 anos).
 *
 * O agravante aqui é O QUE o texto diz. A nota do Farmácia Popular informa que o
 * remédio pode sair de graça, e a redação é cuidadosa de propósito ("consta no
 * elenco", nunca "você tem direito"). Uma ressalva escrita a 11px que ninguém lê
 * não protege ninguém: ela some, e sobra só a promessa implícita do selo verde.
 * Texto que existe para RESSALVAR precisa ser legível, senão ele só decora.
 *
 * O que estava aqui: pílula e linha do princípio ativo a 11px, nota a 12px e a
 * linha de apresentações a 11px em `--muted`. Tudo abaixo do piso de 13px do
 * projeto, e a pílula — que é um BOTÃO — tinha ~25px de alvo de toque.
 *
 * CONTRASTES MEDIDOS (fórmula WCAG 2.x, compostos sobre o fundo REAL: esta
 * etiqueta mora sobre `--bg` da página, não sobre o branco do cartão):
 *
 *   pílula   status-ok-ink sobre emerald/10+bg   claro  5,19:1 · escuro  7,55:1
 *   item     fg            sobre emerald/06+bg   claro 15,14:1 · escuro 15,18:1
 *   nota     fg-soft       sobre emerald/06+bg   claro  9,17:1 · escuro 12,28:1
 *   (antes)  muted a 11px  sobre emerald/06+bg   claro  5,21:1 · escuro  7,99:1
 *
 * A tinta do texto era ACEITÁVEL; o tamanho é que não era. Ainda assim o verde
 * cru do Tailwind (`emerald-700`, 4,68:1 na pílula) deu lugar ao token medido
 * `status-ok-ink`, que é o valor auditado do projeto e acompanha os modos de
 * alto contraste e Sênior — o hex solto não acompanhava.
 *
 * Nota de regra de cor: verde aqui é fato ADMINISTRATIVO (o princípio ativo está
 * numa lista pública do Ministério da Saúde), não leitura do corpo de ninguém.
 * Não é semáforo clínico e por isso não abre exceção de cor de sistema.
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
      {/*
       * A pílula é um botão de revelar/ocultar, então cai em duas regras ao
       * mesmo tempo: alvo de toque ≥44px (`min-h-11`, que CRESCE no Modo Sênior
       * em vez de cortar o rótulo) e SC 1.4.11, que pede 3:1 no contorno de um
       * controle. A borda era `emerald-500/30` = 1,31:1 sobre o fundo da página
       * (claro) e 1,68:1 (escuro): invisível. Passa a ser o próprio
       * `status-ok-ink` — 5,66:1 no claro, 8,50:1 no escuro.
       *
       * `leading-none` saiu junto: entrelinha zerada é o oposto do que o público
       * 50+ precisa, e com 15px ela apertava as maiúsculas contra a borda.
       */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={noteId}
        title={FARMACIA_POPULAR_NOTE}
        className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-status-ok-ink bg-emerald-500/10 px-3.5 text-body-sm font-semibold text-status-ok-ink transition hover:bg-emerald-500/20"
      >
        <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{FARMACIA_POPULAR_LABEL}</span>
        <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>

      <div id={noteId} role="note" hidden={!open}>
        {/* A borda deste painel segue tênue de propósito: aqui ela é decoração
            de agrupamento, não o contorno de um controle — a informação inteira
            está no texto, que é quem foi medido. */}
        <div className="mt-2 max-w-xl rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
          {item && (
            // Princípio ativo e categoria são informação do MEDICAMENTO: vão na
            // tinta cheia (`fg`, 15,14:1), não no verde decorativo do selo.
            <p className="text-body-sm font-semibold text-fg">
              {item.activeIngredient} · {farmaciaPopularCategoryLabel(item)}
            </p>
          )}
          <p className="mt-1 text-body-sm leading-relaxed text-fg-soft">{FARMACIA_POPULAR_NOTE}</p>
          {item?.note && (
            <p className="mt-1.5 text-body-sm leading-relaxed text-fg-soft">
              Apresentações no elenco: {item.note}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
