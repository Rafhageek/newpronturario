/**
 * ════════════════════════════════════════════════════════════════════════════
 * ESCALA DE HUMOR — ordem por FORMA e por PALAVRA, num matiz só
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O mockup do painel trazia "Como você está se sentindo hoje?" com cinco
 * carinhas indo de VERMELHA TRISTE a VERDE SORRIDENTE. Isso é semáforo em dado
 * autorrelatado: quem teve um dia ruim toca no botão e recebe um vermelho de
 * volta — o app julgando o que a pessoa sente. É exatamente o que a regra do
 * projeto veda (`status` em @hubpatients/ui-tokens) e o que
 * `utils/regra-cor-clinica.test.ts` reprova.
 *
 * O que sai: o juízo de valor colorido.
 * O que fica: a escala. Ela continua ordenada, contínua e legível — só que a
 * ordem passa a estar em canais que ninguém perde:
 *
 *   1. FORMA DA BOCA   — curvatura contínua de -3,4 (bem para baixo) a +3,4
 *                        (bem para cima), passando por reta no meio.
 *   2. INCLINAÇÃO DOS OLHOS — de +22° (extremidade interna para cima, aflito)
 *                        a -14° com arco para cima (olho de riso).
 *   3. RÓTULO EM TEXTO — sempre visível, nunca só no `aria-label`
 *                        (`MOOD_LABELS`: Muito mal · Mal · Neutro · Bem · Muito bem).
 *   4. POSIÇÃO         — 1º ao 5º, sempre na mesma ordem.
 *
 * A cor entra só como intensidade de UM matiz (azul, 217°–221°), a mesma
 * decisão de `painIntensityColor` no mapa de dor e da paleta `chart` — que já
 * resolviam isso antes de existir carinha nenhuma.
 *
 * GANHO CONCRETO: hoje 8% dos homens (deuteranopia/protanopia) não conseguem
 * ler a diferença entre a carinha 1 e a 5 de um semáforo vermelho→verde. Com
 * forma + palavra, conseguem. Quem imprime o prontuário em preto e branco,
 * também.
 *
 * A geometria é devolvida como `d` de <path> num viewBox 24×24 para que a web
 * (<svg>) e o mobile (react-native-svg) desenhem EXATAMENTE a mesma carinha, a
 * partir de um cálculo só.
 */

import { MOOD_LABELS } from '../constants/health';

/** A escala vai de 1 a 5 — é a que o diário já grava (`schemas/diary`). */
export const MOOD_MIN = 1;
export const MOOD_MAX = 5;

export type MoodValue = 1 | 2 | 3 | 4 | 5;

export const MOOD_VALUES: readonly MoodValue[] = [1, 2, 3, 4, 5];

/**
 * Rampa de UM matiz (azul 217°–221°), do claro ao escuro conforme o valor sobe.
 *
 * Não é "pior → melhor": é "1º degrau → 5º degrau", do mesmo jeito que a rampa
 * de dor é "0 → 10". Nenhum degrau é verde nem vermelho, então nenhum degrau
 * elogia ou repreende.
 *
 * Contraste medido entre degraus vizinhos: 1,35 · 1,60 · 1,93 · 2,18. É pouco
 * para o olho separar sozinho — de propósito: a cor aqui é REFORÇO, e todo uso
 * desta rampa exige rótulo por perto (SC 1.4.1).
 */
export const MOOD_RAMP: Record<MoodValue, string> = {
  1: '#cfdcf3',
  2: '#a5bfea',
  3: '#7096d2',
  4: '#45659f',
  5: '#1b3160',
};

/**
 * Tinta legível SOBRE cada degrau da rampa. Fixa (não segue o tema), porque o
 * preenchimento também é fixo. Mínimo medido: 5,78:1.
 */
const MOOD_RAMP_INK: Record<MoodValue, string> = {
  1: '#1b1a18', // 12,57:1
  2: '#1b1a18', // 9,30:1
  3: '#1b1a18', // 5,78:1
  4: '#ffffff', // 5,80:1
  5: '#ffffff', // 12,69:1
};

function clampMood(valor: number): MoodValue {
  const v = Math.round(valor);
  if (v <= MOOD_MIN) return MOOD_MIN;
  if (v >= MOOD_MAX) return MOOD_MAX;
  return v as MoodValue;
}

/** Cor do degrau (rampa de um matiz). */
export function moodRampColor(valor: number): string {
  return MOOD_RAMP[clampMood(valor)];
}

/** Tinta de texto/ícone sobre `moodRampColor(valor)`. */
export function moodRampInk(valor: number): string {
  return MOOD_RAMP_INK[clampMood(valor)];
}

/* ═══════════════════════ Geometria da carinha ═══════════════════════ */

/**
 * Parâmetros de FORMA por degrau. É aqui que mora a diferença entre as cinco
 * opções — trocar qualquer um destes números muda a escala inteira, nas 96
 * telas, sem editar tela nenhuma.
 */
export interface MoodShape {
  /** Curvatura da boca: negativo = para baixo · 0 = reta · positivo = para cima. */
  boca: number;
  /** Inclinação do olho em graus; positivo = extremidade INTERNA para cima. */
  olhoInclinacao: number;
  /** Arqueamento do olho; positivo = arco para cima (olho de riso). */
  olhoArco: number;
}

export const MOOD_SHAPES: Record<MoodValue, MoodShape> = {
  1: { boca: -3.4, olhoInclinacao: 22, olhoArco: -0.55 },
  2: { boca: -1.7, olhoInclinacao: 11, olhoArco: -0.25 },
  3: { boca: 0, olhoInclinacao: 0, olhoArco: 0 },
  4: { boca: 1.7, olhoInclinacao: -7, olhoArco: 0.45 },
  5: { boca: 3.4, olhoInclinacao: -14, olhoArco: 1.15 },
};

/** Grade de desenho. Mesmos números na web e no mobile. */
export const MOOD_FACE_VIEWBOX = 24;
const CENTRO = 12;
const OLHO_Y = 9.9;
const OLHO_X = 8.9;
const OLHO_META = 1.4;
const BOCA_X0 = 7.8;
const BOCA_X1 = 16.2;
const BOCA_Y = 15.6;
/** Raio do contorno da carinha (traço de 1,6 cabe dentro do viewBox). */
export const MOOD_FACE_RADIUS = 9.2;

/** 2 casas, sem "-0" (que alguns parsers de SVG do Android estranham). */
function n(valor: number): string {
  const arredondado = Math.round(valor * 100) / 100;
  return Object.is(arredondado, -0) ? '0' : String(arredondado);
}

function rotacionar(dx: number, dy: number, graus: number): [number, number] {
  const rad = (graus * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);
  return [dx * cos - dy * sen, dx * sen + dy * cos];
}

function olhoPath(cx: number, forma: MoodShape, espelhar: boolean): string {
  // Em SVG o Y cresce para BAIXO: para a extremidade interna subir, o ângulo
  // aplicado precisa ser o negativo da inclinação declarada.
  const ang = -forma.olhoInclinacao;
  const [p0x, p0y] = rotacionar(-OLHO_META, 0, ang);
  const [p1x, p1y] = rotacionar(OLHO_META, 0, ang);
  const [ccx, ccy] = rotacionar(0, -forma.olhoArco, ang);
  const x = (dx: number) => (espelhar ? CENTRO * 2 - (cx + dx) : cx + dx);
  return `M ${n(x(p0x))} ${n(OLHO_Y + p0y)} Q ${n(x(ccx))} ${n(OLHO_Y + ccy)} ${n(x(p1x))} ${n(
    OLHO_Y + p1y,
  )}`;
}

export interface MoodFacePaths {
  /** `d` da boca. */
  boca: string;
  /** `d` do olho esquerdo. */
  olhoEsquerdo: string;
  /** `d` do olho direito (espelho exato do esquerdo). */
  olhoDireito: string;
}

/**
 * Caminhos SVG da carinha do degrau — mesma saída na web e no mobile.
 * Desenhar com `stroke`, `fill="none"`, `stroke-linecap="round"`.
 */
export function moodFacePaths(valor: number): MoodFacePaths {
  const forma = MOOD_SHAPES[clampMood(valor)];
  const k = forma.boca;
  const y0 = BOCA_Y - k / 2;
  const cy = y0 + 2 * k;
  return {
    boca: `M ${n(BOCA_X0)} ${n(y0)} Q ${n(CENTRO)} ${n(cy)} ${n(BOCA_X1)} ${n(y0)}`,
    olhoEsquerdo: olhoPath(OLHO_X, forma, false),
    olhoDireito: olhoPath(OLHO_X, forma, true),
  };
}

/* ═══════════════════════ A escala pronta para a tela ═══════════════════════ */

export interface MoodOption {
  valor: MoodValue;
  /** Rótulo VISÍVEL. Não é `aria-label`: fica escrito embaixo da carinha. */
  rotulo: string;
  /** Texto do leitor de tela: rótulo + posição na escala. */
  descricao: string;
  forma: MoodShape;
  caminhos: MoodFacePaths;
  /** Degrau da rampa de um matiz — reforço, nunca o único canal. */
  cor: string;
  /** Tinta legível sobre `cor`. */
  tinta: string;
}

/**
 * A escala inteira, pronta para as primitivas de web e mobile consumirem.
 *
 * O rótulo sai de `MOOD_LABELS` (constants/health) — que é o mesmo texto que o
 * diário já usa no slider e no resumo. Uma escala, um vocabulário.
 */
export const MOOD_SCALE: readonly MoodOption[] = MOOD_VALUES.map((valor) => ({
  valor,
  rotulo: MOOD_LABELS[valor] ?? String(valor),
  descricao: `${MOOD_LABELS[valor] ?? valor} — ${valor} de ${MOOD_MAX}`,
  forma: MOOD_SHAPES[valor],
  caminhos: moodFacePaths(valor),
  cor: MOOD_RAMP[valor],
  tinta: MOOD_RAMP_INK[valor],
}));

/** Pergunta padrão do seletor — mesma frase nas duas plataformas. */
export const MOOD_QUESTION = 'Como você está se sentindo hoje?';

/**
 * Legenda obrigatória onde a rampa aparecer sem rótulo em cada célula (mapa do
 * ano, gráfico). Cor sozinha nunca basta (SC 1.4.1).
 */
export const MOOD_LEGEND = 'Do 1º ao 5º degrau da escala — nenhum degrau é bom ou ruim.';
