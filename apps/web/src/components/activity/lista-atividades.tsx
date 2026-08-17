'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ATIVIDADES REGISTRADAS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * VERACIDADE (regra 3 do projeto). Esta lista só escreve "Nenhuma atividade
 * registrada" quando a consulta CONFIRMOU isso — `estadoSecao` decide, e não as
 * flags soltas do React Query. Com o `patientId` ainda vazio a consulta fica
 * `enabled: false` e `isLoading`/`isError` são AMBOS `false`: as duas travas
 * habituais caem juntas e a lista vazia se passa por resposta. Enquanto não há
 * resposta a tela mostra esqueleto; se falhou, mostra que falhou e como tentar
 * de novo. Mesmo padrão auditado em `(app)/medicamentos/page.tsx`.
 *
 * COR (regra 2). Nada aqui pinta esforço, duração ou frequência. O chip de cada
 * linha vem de `chipToneFor(kind)` — a paleta de CATEGORIA, cujos matizes ficam
 * entre 165° e 320° justamente para não existir semáforo a escolher por engano.
 * Duas caminhadas iguais têm a mesma cor; uma caminhada de 5 minutos e uma de
 * 90 também. A cor diz "que atividade é", nunca "quão bem você foi".
 *
 * SINTOMA aparece como TEXTO, na mesma tinta do resto da linha. Sem ícone de
 * perigo, sem destaque de gravidade, sem ordenação por risco — o app guarda o
 * sintoma junto do esforço em que ele aconteceu e não emite parecer sobre ele.
 * E "não respondeu" nunca vira "não sentiu nada": as duas frases saem de
 * `descreverSintomas`, no core.
 */

import { useState } from 'react';
import { Footprints, Trash2 } from 'lucide-react';
import {
  ACTIVITY_EFFORT_LABELS,
  ACTIVITY_EFFORT_OPTIONS,
  ACTIVITY_KIND_LABELS,
  dataEHoraLocal,
  descreverSintomas,
  formatarDuracao,
  podeAfirmarAusencia,
  rotuloDoDia,
  type ActivityKind,
  type EstadoSecao,
} from '@hubpatients/core';
import type { ActivitySession } from '@hubpatients/supabase';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { IconChip, MoodMark, PanelButton, chipToneFor } from '@/components/ui/painel';
import { confirmAction } from '@/lib/confirm';

/** Quantas linhas aparecem antes do "Mostrar mais". */
const PASSO = 10;

/**
 * A linha de data diz DUAS coisas diferentes, e nunca as confunde:
 *
 *  · a pessoa informou o dia → mostra esse dia, sem hora nenhuma, porque hora
 *    ela não digitou. `performed_at` é `date` (`AAAA-MM-DD`) e `rotuloDoDia`
 *    já resolve "Hoje, 17 de agosto" / "Ontem, 16 de agosto";
 *  · a pessoa não informou → mostra quando o registro foi ANOTADO, dizendo com
 *    todas as letras que é isso. Passar uma coisa pela outra num prontuário é o
 *    tipo de imprecisão que reaparece na consulta como fato.
 *
 * `occurred_at` NÃO entra aqui de propósito: ela existe só para ordenar (ver o
 * comentário em `queries/activity.ts`).
 */
function quandoFoi(s: ActivitySession): string {
  if (s.performed_at) return rotuloDoDia(s.performed_at);
  return `${dataEHoraLocal(s.created_at)} (data em que você anotou)`;
}

function descricaoDoEsforco(valor: string | null): string | null {
  if (!valor) return null;
  const opcao = ACTIVITY_EFFORT_OPTIONS.find((o) => o.valor === valor);
  if (!opcao) return null;
  // Rótulo + método, sempre juntos: "Moderado" sozinho não significa nada para
  // quem nunca mediu esforço com aparelho nenhum.
  return `${ACTIVITY_EFFORT_LABELS[opcao.valor]} — ${opcao.descricao.toLowerCase()}`;
}

export interface ListaAtividadesProps {
  estado: EstadoSecao;
  sessoes: readonly ActivitySession[];
  onExcluir: (sessao: ActivitySession) => void;
  onTentarDeNovo: () => void;
  /** `id` da sessão sendo apagada agora (desabilita o botão daquela linha). */
  excluindoId?: string | null;
}

export function ListaAtividades({
  estado,
  sessoes,
  onExcluir,
  onTentarDeNovo,
  excluindoId,
}: ListaAtividadesProps) {
  const [visiveis, setVisiveis] = useState(PASSO);

  if (estado === 'falhou') {
    return (
      <ErrorState
        message="Não foi possível carregar suas atividades agora. Esta tela não está dizendo que você não registrou nenhuma — ela só não conseguiu ler."
        onRetry={onTentarDeNovo}
      />
    );
  }

  if (!podeAfirmarAusencia(estado)) {
    return <ListSkeleton rows={3} />;
  }

  if (sessoes.length === 0) {
    return (
      <EmptyState
        icon={Footprints}
        title="Nenhuma atividade registrada"
        description="Quando você anotar a primeira, ela aparece aqui — com o que você sentiu durante, para levar à consulta."
      />
    );
  }

  const mostradas = sessoes.slice(0, visiveis);

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {mostradas.map((s) => {
          const rotuloKind = ACTIVITY_KIND_LABELS[s.kind as ActivityKind] ?? s.kind;
          const esforco = descricaoDoEsforco(s.effort);
          const apagando = excluindoId === s.id;
          return (
            <li
              key={s.id}
              className="flex items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
            >
              <IconChip icon={Footprints} tone={chipToneFor(s.kind)} size="md" />

              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold leading-snug text-fg [overflow-wrap:anywhere]">
                  {rotuloKind}
                  <span aria-hidden="true"> · </span>
                  <span className="hp-num font-semibold">{formatarDuracao(s.duration_min)}</span>
                </p>

                <p className="mt-0.5 text-body-sm leading-snug text-fg-soft">
                  {quandoFoi(s)}
                </p>

                {esforco ? (
                  <p className="mt-1 text-body-sm leading-snug text-fg-soft">
                    Respiração: {esforco}
                  </p>
                ) : null}

                {/* Sintoma é registro, não parecer. Mesma tinta do resto. */}
                <p className="mt-1 text-body-sm leading-snug text-fg-soft">
                  {descreverSintomas(s.symptoms)}
                </p>

                {s.feeling_after != null ? (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-body-sm text-fg-soft">
                    <span>Depois:</span>
                    <MoodMark value={s.feeling_after} />
                  </p>
                ) : null}

                {s.notes ? (
                  <p className="mt-1 text-body-sm leading-snug text-fg-soft [overflow-wrap:anywhere]">
                    {s.notes}
                  </p>
                ) : null}
              </div>

              {/* Apagar é do dono e é definitivo — por isso confirma antes. */}
              <button
                type="button"
                disabled={apagando}
                onClick={() => {
                  if (
                    confirmAction(
                      `Apagar o registro de ${rotuloKind} de ${dataEHoraLocal(s.occurred_at)}? Isso não pode ser desfeito.`,
                    )
                  ) {
                    onExcluir(s);
                  }
                }}
                aria-label={`Apagar registro de ${rotuloKind} de ${dataEHoraLocal(s.occurred_at)}`}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-chip text-fg-soft transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      {sessoes.length > visiveis ? (
        <div className="flex flex-wrap items-center gap-3">
          <PanelButton variant="secondary" size="sm" onClick={() => setVisiveis((n) => n + PASSO)}>
            Mostrar mais atividades
          </PanelButton>
          {/* Contagem escrita, não só implícita na altura da lista. */}
          <p className="hp-num text-body-sm text-fg-soft">
            {`Mostrando ${mostradas.length} de ${sessoes.length}.`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
