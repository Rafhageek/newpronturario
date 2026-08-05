'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PROGRESSO DO DIÁRIO ALIMENTAR — sem cor de julgamento
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O mockup aprovado trazia anel e barras VERDES. Verde em caloria é o pior caso
 * da regra de cor clínica do projeto (`packages/core/src/utils/regra-cor-clinica.test.ts`):
 * verde afirma "você está indo bem" sobre o que a pessoa comeu, e quem julga
 * alimentação de paciente crônico ou de criança não é o aplicativo.
 *
 * COMO A LEGIBILIDADE FOI MANTIDA SEM O SEMÁFORO
 *
 *  1. COMPRIMENTO — o canal principal. O arco e a barra crescem; é o que o olho
 *     lê primeiro, e funciona com daltonismo, no sol e impresso (WCAG SC 1.4.1).
 *  2. NÚMERO SEMPRE VISÍVEL — "1.250 de 2.000 kcal" e "63%" ficam escritos, não
 *     escondidos num tooltip. Nenhuma informação depende de perceber a cor.
 *  3. MARCA DA META — um traço no ponto dos 100%. É ele que substitui a
 *     mudança-de-cor-ao-atingir-a-meta: a referência fica visível o tempo todo,
 *     inclusive quando a barra está curta.
 *  4. EXCEDENTE POR CONTINUAÇÃO — passar da meta estende a barra além do traço,
 *     no mesmo matiz. A barra nunca é repintada de vermelho, que seria o gesto
 *     de reprovação que estamos evitando.
 *
 * A tinta vem de `var(--primary)` e `var(--status-neutro-*)`: um matiz só, que
 * acompanha o modo escuro e o contraste alto.
 */

import { useId } from 'react';
import type { ProgressoNutriente } from '@hubpatients/core';

/* ──────────────────────────────── Anel ──────────────────────────────── */

/**
 * Escala do desenho: a barra e o anel representam `max(1, fração)`, de modo que
 * um dia acima da meta ainda caiba na figura. O traço da meta anda junto, e é
 * por isso que ele é a referência confiável e não a borda direita.
 */
function escalaDe(p: ProgressoNutriente): number {
  const total = p.fracao + p.excedente;
  return Math.max(1, total);
}

export function AnelDeProgresso({
  progresso,
  unidade,
  tamanho = 176,
}: {
  progresso: ProgressoNutriente;
  unidade: string;
  tamanho?: number;
}) {
  const id = useId();
  const raio = 78;
  const circ = 2 * Math.PI * raio;
  const escala = escalaDe(progresso);
  const preenchido = (progresso.fracao + progresso.excedente) / escala;
  const semMeta = progresso.meta == null;

  // O traço da meta: onde os 100% caem depois da escala. Sem meta ele não
  // existe — o app não desenha um alvo que a pessoa não pediu.
  const anguloMeta = (1 / escala) * 360 - 90;

  const descricao = semMeta
    ? `${progresso.texto} registradas hoje. Nenhuma meta definida.`
    : `${progresso.texto}. ${progresso.porcentagem}% da meta que você definiu.`;

  return (
    <div
      className="relative shrink-0"
      style={{ width: tamanho, height: tamanho }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={progresso.meta ?? undefined}
      aria-valuenow={Math.round(progresso.valor)}
      aria-valuetext={descricao}
      aria-labelledby={`${id}-rotulo`}
    >
      <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90" aria-hidden="true">
        {/* Trilho */}
        <circle
          cx="90"
          cy="90"
          r={raio}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="13"
        />
        {/* Preenchimento — um matiz só, do começo ao fim */}
        {progresso.valor > 0 && (
          <circle
            cx="90"
            cy="90"
            r={raio}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - Math.min(1, preenchido))}
            style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)' }}
          />
        )}
        {/* Marca da meta: onde estão os 100%. Some quando não há meta. */}
        {!semMeta && (
          <line
            x1={90 + (raio - 9) * Math.cos((anguloMeta * Math.PI) / 180)}
            y1={90 + (raio - 9) * Math.sin((anguloMeta * Math.PI) / 180)}
            x2={90 + (raio + 9) * Math.cos((anguloMeta * Math.PI) / 180)}
            y2={90 + (raio + 9) * Math.sin((anguloMeta * Math.PI) / 180)}
            stroke="var(--fg)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <span className="hp-num text-4xl font-bold leading-none text-fg">
          {progresso.texto.split(' de ')[0] ?? '0'}
        </span>
        <span className="mt-1.5 text-xs leading-tight text-muted" id={`${id}-rotulo`}>
          {semMeta ? `${unidade} registradas` : `de ${progresso.texto.split(' de ')[1] ?? ''}`}
        </span>
      </div>
    </div>
  );
}

/* ──────────────────────────────── Barra ──────────────────────────────── */

export function BarraDeNutriente({
  rotulo,
  progresso,
}: {
  rotulo: string;
  progresso: ProgressoNutriente;
}) {
  const id = useId();
  const escala = escalaDe(progresso);
  const largura = ((progresso.fracao + progresso.excedente) / escala) * 100;
  const posMeta = (1 / escala) * 100;
  const semMeta = progresso.meta == null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-fg-soft" id={`${id}-rotulo`}>
          {rotulo}
        </span>
        <span className="hp-num shrink-0 text-sm text-muted">
          {progresso.texto}
          {progresso.porcentagem != null && (
            <span className="ml-2 text-fg-soft">{progresso.porcentagem}%</span>
          )}
        </span>
      </div>

      <div
        className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-labelledby={`${id}-rotulo`}
        aria-valuemin={0}
        aria-valuemax={progresso.meta ?? undefined}
        aria-valuenow={Math.round(progresso.valor)}
        aria-valuetext={progresso.texto}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${largura}%` }}
        />
        {/* Traço da meta. Fica por cima do preenchimento de propósito: é a
            referência, e precisa continuar visível quando a barra passa dele. */}
        {!semMeta && posMeta < 100 && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 w-0.5 bg-fg/70"
            style={{ left: `${posMeta}%` }}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Visão da semana ─────────────────────────── */

/**
 * Conta REGISTRO, não aderência: dia cheio = "tem anotação", dia vazio = "não
 * tem". Nada aqui diz se a pessoa comeu bem — nem por cor, nem por texto. Não
 * existe sequência nem recorde de propósito (ver `resumoDaSemana` no core).
 */
export function VisaoDaSemana({
  dias,
  texto,
  iniciais,
  diaAtual,
  hoje,
  onEscolherDia,
}: {
  dias: { dia: string; registrado: boolean }[];
  texto: string;
  iniciais: readonly string[];
  diaAtual: string;
  hoje: string;
  onEscolherDia: (dia: string) => void;
}) {
  return (
    <div>
      <div className="flex justify-between gap-1">
        {dias.map((d, i) => {
          const selecionado = d.dia === diaAtual;
          const futuro = d.dia > hoje;
          return (
            <button
              key={d.dia}
              type="button"
              onClick={() => onEscolherDia(d.dia)}
              disabled={futuro}
              aria-current={selecionado ? 'date' : undefined}
              aria-label={`${iniciais[i]}, ${d.registrado ? 'com registro' : 'sem registro'}`}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg py-1.5 transition disabled:opacity-35 ${
                selecionado ? 'bg-surface-2' : 'hover:bg-surface-2'
              }`}
            >
              <span className="text-[11px] font-medium text-muted">{iniciais[i]}</span>
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  d.registrado
                    ? 'border-primary bg-primary text-white'
                    : 'border-dashed border-line-strong text-faint'
                }`}
              >
                {/* O glifo é redundante com o preenchimento: quem não distingue
                    a cor ainda lê o traço. */}
                {d.registrado ? '•' : '–'}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-muted">{texto}</p>
    </div>
  );
}
