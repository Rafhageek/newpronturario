'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ESCALA DE HUMOR — web
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O mockup pedia cinco carinhas de VERMELHA TRISTE a VERDE SORRIDENTE. Não foi
 * reproduzido, e não é preciosismo: é semáforo em dado autorrelatado. Quem teve
 * um dia ruim toca no botão e recebe um carimbo vermelho do próprio aplicativo
 * de saúde. Fora que 8% dos homens não distinguem esse vermelho desse verde —
 * para eles a escala inteira era cinco círculos iguais.
 *
 * O QUE FOI PRESERVADO DO DESENHO: cinco opções, ordenadas, tocáveis de uma vez,
 * com carinha. A escala não encolheu nem virou um slider.
 *
 * O QUE MUDOU: a ordem saiu da cor e foi para canais que ninguém perde —
 *   · a CURVA DA BOCA, contínua, de -3,4 a +3,4 passando por reta;
 *   · a INCLINAÇÃO DOS OLHOS, de +22° (aflito) a -14° com arco (riso);
 *   · o RÓTULO EM TEXTO embaixo de cada carinha, sempre visível;
 *   · a POSIÇÃO, 1ª a 5ª, sempre igual.
 * A geometria vem de `MOOD_SCALE` (@hubpatients/core), a mesma que o mobile
 * desenha — uma conta só, duas plataformas.
 *
 * A cor entra apenas como ESTADO (escolhida / não escolhida), num matiz só, e
 * nunca como posição na escala: a 1ª e a 5ª opção têm exatamente a mesma cor.
 */

import { MOOD_SCALE, MOOD_QUESTION, MOOD_FACE_VIEWBOX, MOOD_FACE_RADIUS, moodFacePaths } from '@hubpatients/core';
import { useId } from 'react';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * A carinha de um degrau, desenhada só com traço em `currentColor`.
 *
 * Herda a cor de quem a contém de propósito: assim ela nunca "tem" uma cor
 * própria e não há como um degrau ficar vermelho por descuido.
 */
export function MoodFace({
  value,
  className,
  strokeWidth = 1.6,
}: {
  value: number;
  className?: string;
  strokeWidth?: number;
}) {
  const { boca, olhoEsquerdo, olhoDireito } = moodFacePaths(value);
  const meio = MOOD_FACE_VIEWBOX / 2;
  return (
    <svg
      viewBox={`0 0 ${MOOD_FACE_VIEWBOX} ${MOOD_FACE_VIEWBOX}`}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx={meio} cy={meio} r={MOOD_FACE_RADIUS} />
      <path d={olhoEsquerdo} />
      <path d={olhoDireito} />
      <path d={boca} />
    </svg>
  );
}

export interface MoodScaleProps {
  /** Degrau escolhido (1–5) ou `null` quando ainda não há resposta. */
  value: number | null;
  onChange: (value: number) => void;
  /** Pergunta visível. Padrão: "Como você está se sentindo hoje?". */
  question?: string;
  /** `name` do grupo de rádio — obrigatório se houver duas escalas na página. */
  name?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Seletor de humor.
 *
 * Construído com `<input type="radio">` de verdade (visualmente escondidos):
 * dá navegação por setas, `Home`/`End`, leitura correta de "opção 3 de 5" e
 * envio por formulário sem uma linha de JavaScript de acessibilidade.
 *
 * Alvo de toque: `min-h-11` em rem — 44px no padrão, ~57px no Modo Sênior, sem
 * exceção nem `data-tap-exempt`.
 */
export function MoodScale({
  value,
  onChange,
  question = MOOD_QUESTION,
  name,
  disabled,
  className,
}: MoodScaleProps) {
  const autoName = useId();
  const grupo = name ?? autoName;

  return (
    <fieldset className={cx('min-w-0', className)} disabled={disabled}>
      <legend className="text-label font-semibold text-fg">{question}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {MOOD_SCALE.map((opcao) => {
          const escolhida = value === opcao.valor;
          return (
            <label
              key={opcao.valor}
              className={cx(
                'group relative flex min-h-11 flex-1 basis-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border px-2 py-3 text-center transition-colors',
                // COR = ESTADO, nunca posição na escala. O 1º e o 5º degrau
                // usam exatamente as mesmas duas cores.
                escolhida
                  ? 'border-primary bg-nav-active-tint text-mood-ink'
                  : 'border-line bg-surface text-fg-soft hover:border-line-strong',
              )}
            >
              <input
                type="radio"
                name={grupo}
                value={opcao.valor}
                checked={escolhida}
                onChange={() => onChange(opcao.valor)}
                className="peer sr-only"
              />
              {/* O input está fora da tela (`sr-only`), então o anel de foco
                  precisa de um alvo visível. Camada irmã + `peer-focus-visible`
                  em vez de `:has()`: o indicador de foco é caminho de teclado
                  crítico e não pode depender de suporte a seletor novo. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-card peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
              />
              <MoodFace
                value={opcao.valor}
                // A carinha escolhida engrossa o traço: mais um canal de forma,
                // legível em preto e branco e para quem não enxerga a cor.
                strokeWidth={escolhida ? 2.1 : 1.6}
                className="h-9 w-9"
              />
              <span
                className={cx(
                  'text-caption leading-tight',
                  escolhida ? 'font-semibold' : 'font-medium text-muted',
                )}
              >
                {opcao.rotulo}
              </span>
              {/* O leitor de tela recebe "Bem — 4 de 5": rótulo E posição. */}
              <span className="sr-only">{opcao.descricao}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Marcador compacto de um humor já registrado (linha do tempo, resumo).
 * Carinha + rótulo — nunca a cor sozinha (SC 1.4.1).
 */
export function MoodMark({ value, className }: { value: number; className?: string }) {
  const opcao = MOOD_SCALE.find((o) => o.valor === Math.round(value)) ?? MOOD_SCALE[2];
  if (!opcao) return null;
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-mood-ink', className)}>
      <MoodFace value={opcao.valor} className="h-5 w-5" />
      <span className="text-caption font-medium text-fg-soft">{opcao.rotulo}</span>
    </span>
  );
}
