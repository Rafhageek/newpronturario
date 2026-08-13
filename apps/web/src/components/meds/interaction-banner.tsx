'use client';

import { AlertTriangle, Info } from 'lucide-react';
import type { DrugInteraction } from '@hubpatients/core';
import { INTERACTION_SEVERITY } from '@hubpatients/core';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * AVISO DE INTERAÇÃO ENTRE MEDICAMENTOS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * LEGIBILIDADE 50+ (correção 2026-08) — dívida da rodada anterior, e a mais
 * grave das quatro: este é o texto de MAIOR consequência clínica da tela de
 * Medicamentos, e a descrição da interação estava a 12px, com a ressalva
 * ("converse com seu médico") a 11px em `--muted`. Ou seja: quanto mais
 * importante a frase, menor ela ficava. Quem mais precisa desse aviso — pessoa
 * de 50+ tomando cinco remédios, que é o perfil que gera interação — era
 * exatamente quem não conseguia lê-lo.
 *
 * Piso aplicado, o mesmo de `medication-card.tsx` e `adherence-bar.tsx`:
 * nada abaixo de `text-body-sm` (15px em `rem`, ~19,5px no Modo Sênior) e tinta
 * mínima `fg-soft`. Os nomes dos remédios sobem para `text-body` (17px), porque
 * é por eles que a pessoa identifica de qual par estamos falando.
 *
 * ── A COR SAIU DO TEXTO E FICOU NO CONTÊINER ──────────────────────────────
 * Os títulos eram `text-amber-700` / `text-rose-700`. Medido sobre o tinto real
 * de cada faixa (composto sobre `--bg` da página, que é onde este banner mora):
 *
 *   ANTES  amber-700 sobre amber/08+bg   claro 4,43:1  ← REPROVA em AA (<4,5)
 *          rose-700  sobre rose/15+bg    claro 4,83:1
 *   DEPOIS text-fg   sobre amber/08+bg   claro 15,13:1 · escuro 14,47:1
 *          text-fg   sobre rose/15+bg    claro 13,18:1 · escuro 14,00:1
 *
 * O título com o nome dos dois remédios passou a `text-fg` — o texto vai ao
 * contraste máximo e a GRAVIDADE continua dita por três canais que não dependem
 * de enxergar cor: o ícone, a palavra (`meta.label`) e o tinto do contêiner.
 * Cor deixando de carregar significado sozinha é também SC 1.4.1.
 *
 * Descrição e ressalva, medidas sobre o pior fundo (o tinto de alerta):
 *   fg-soft sobre rose/15+bg   claro 7,99:1 · escuro 11,32:1
 *   (antes) muted a 11px        claro 4,53:1 · escuro  7,37:1
 *
 * ── CONTORNO (SC 1.4.11) ──────────────────────────────────────────────────
 * `border-rose-500/40` dava 1,69:1 contra o fundo da página e `border-amber-
 * 500/30` dava 1,24:1 — a caixa não tinha limite visível, só uma mancha. As
 * bordas passam às tintas medidas: alert-ink 5,47:1 (claro) / 8,52:1 (escuro);
 * attention-ink 5,50:1 / 8,29:1.
 *
 * ── REGRA DE COR CLÍNICA ──────────────────────────────────────────────────
 * Âmbar e vermelho aqui são legítimos: interação medicamentosa é um alerta do
 * SISTEMA sobre a COMBINAÇÃO de dois cadastros, não uma leitura do corpo do
 * paciente nem um juízo sobre um exame dele. Esta pasta (`components/meds`) não
 * está na varredura de `regra-cor-clinica.test.ts`, então NENHUMA região de
 * exceção foi aberta aqui — o contador `EXCECOES_ESPERADAS = 4` segue intacto.
 * Se um dia a pasta entrar na varredura, a exceção precisa ser declarada e o
 * contador ajustado no MESMO commit.
 *
 * E o que o banner não faz continua não fazendo: ele não diz para parar o
 * remédio, não classifica risco pessoal e não substitui médico ou farmacêutico.
 * Ele REGISTRA que a base encontrou uma correspondência entre dois nomes.
 */
export function InteractionBanner({
  interactions,
  isLoading,
  isError,
}: {
  interactions: DrugInteraction[];
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4">
        <Info className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        {/* fg-soft sobre surface-2: 9,80:1 (claro) / 10,82:1 (escuro) */}
        <p className="text-body-sm text-fg-soft">Verificando possíveis interações na base disponível…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-2xl border border-status-attention-ink bg-amber-500/[0.08] p-4"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-attention-ink" aria-hidden="true" />
        <p className="text-body-sm text-fg">
          Não foi possível verificar possíveis interações agora. Confira os princípios ativos e consulte um médico ou farmacêutico antes de tomar qualquer decisão.
        </p>
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        {/*
          VERACIDADE — a frase diz que a BASE não achou correspondência, não que
          não existe interação. A ressalva só cumpre esse papel se for lida, e a
          15px ela agora tem o mesmo peso da afirmação que ela limita.
        */}
        <p className="text-body-sm text-fg-soft">
          A base atual não encontrou correspondências entre os nomes cadastrados. A verificação não é
          completa e não substitui a avaliação de um médico ou farmacêutico. Confira os princípios ativos e as bulas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {interactions.map((i) => {
        const meta = INTERACTION_SEVERITY[i.severity];
        const alert = meta.tone === 'alert';
        return (
          <div
            key={i.id}
            role={alert ? 'alert' : undefined}
            aria-live={alert ? 'assertive' : undefined}
            className={`flex items-start gap-3 rounded-2xl border p-4 ${
              alert
                ? 'border-status-alert-ink bg-rose-500/15'
                : 'border-status-attention-ink bg-amber-500/[0.08]'
            }`}
          >
            {/* O ícone é o canal de cor: 4,50:1 (alerta) e 5,20:1 (atenção) no
                claro, 7,39:1 e 7,43:1 no escuro — acima dos 3:1 de SC 1.4.11. */}
            <AlertTriangle
              className={`mt-0.5 h-5 w-5 shrink-0 ${alert ? 'text-status-alert-ink' : 'text-status-attention-ink'}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-body font-semibold text-fg">
                {i.drug_a} + {i.drug_b} · {meta.label}
              </p>
              <p className="mt-1 text-body-sm text-fg-soft">{i.description}</p>
              <p className="mt-1.5 text-body-sm text-fg-soft">
                Converse com seu médico. O HubPatients não substitui avaliação profissional.
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
