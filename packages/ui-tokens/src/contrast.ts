/**
 * Contraste WCAG 2.x — cálculo, não estimativa.
 *
 * Existe porque "cinza-claro sobre branco" é o erro clássico do estilo visual
 * que o Painel adota, e olho humano é péssimo juiz: o `--hint` do
 * `hp-clinical-shell` (#67748a) parecia bem e entregava 4,40:1 sobre o próprio
 * canvas — reprovava AA por pouco, em produção, sem ninguém notar.
 *
 * Fórmula: WCAG 2.2, Relative Luminance + Contrast Ratio.
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 * https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 *
 * Sem dependências e sem DOM de propósito: roda igual em teste (node), na web e
 * no Hermes. Nada aqui usa `Intl`.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Aceita `#rgb`, `#rrggbb` (com ou sem `#`). Lança em entrada inválida. */
export function hexToRgb(hex: string): Rgb {
  const limpo = hex.trim().replace(/^#/, '');
  const cheio =
    limpo.length === 3
      ? limpo
          .split('')
          .map((c) => c + c)
          .join('')
      : limpo;
  if (!/^[0-9a-fA-F]{6}$/.test(cheio)) {
    throw new Error(`cor hex inválida: ${hex}`);
  }
  return {
    r: Number.parseInt(cheio.slice(0, 2), 16),
    g: Number.parseInt(cheio.slice(2, 4), 16),
    b: Number.parseInt(cheio.slice(4, 6), 16),
  };
}

function canalLinear(valor8bits: number): number {
  const s = valor8bits / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminância relativa (0 = preto, 1 = branco). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * canalLinear(r) + 0.7152 * canalLinear(g) + 0.0722 * canalLinear(b);
}

/**
 * Razão de contraste entre duas cores OPACAS, de 1:1 a 21:1.
 *
 * Truncada (não arredondada) em 2 casas: 4,499 tem que reprovar em AA, e
 * arredondar para 4,50 mentiria a favor do design.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return Math.floor(((claro + 0.05) / (escuro + 0.05)) * 100) / 100;
}

/**
 * Achata uma cor semitransparente sobre um fundo opaco e devolve o hex
 * resultante. Contraste só se calcula entre cores OPACAS — uma borda
 * `rgba(255,255,255,0.10)` não tem contraste próprio, tem o da composição.
 */
export function flatten(corHex: string, alpha: number, fundoHex: string): string {
  const f = hexToRgb(corHex);
  const b = hexToRgb(fundoHex);
  const a = Math.min(Math.max(alpha, 0), 1);
  const mix = (x: number, y: number) => Math.round(x * a + y * (1 - a));
  const hex2 = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex2(mix(f.r, b.r))}${hex2(mix(f.g, b.g))}${hex2(mix(f.b, b.b))}`;
}

/** HSL em graus/0-1. Usado para provar que uma cor NÃO é semáforo. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === R) h = 60 * (((G - B) / d) % 6);
  else if (max === G) h = 60 * ((B - R) / d + 2);
  else h = 60 * ((R - G) / d + 4);
  if (h < 0) h += 360;
  return { h, s, l };
}

/**
 * Faixa de matiz permitida para COR DE CATEGORIA (chip de ícone, série de
 * gráfico, rampa de dado autorrelatado).
 *
 * De 165° a 320° cobre turquesa → azul → índigo → violeta → ameixa e exclui,
 * por construção, tudo que o olho lê como semáforo: verde (~90-160°), amarelo
 * (~55-65°), âmbar/laranja (~25-50°), vermelho (~0-15°) e rosa (~340-355°).
 * Cinza quase puro (saturação < 0,10) passa em qualquer matiz — cinza não é
 * semáforo.
 */
export const CATEGORY_HUE_RANGE = { min: 165, max: 320, grayMaxSaturation: 0.1 } as const;

/** `true` se a cor pode ser usada como cor de CATEGORIA (não lê como semáforo). */
export function isCategoryHue(hex: string): boolean {
  const { h, s } = hexToHsl(hex);
  if (s < CATEGORY_HUE_RANGE.grayMaxSaturation) return true;
  return h >= CATEGORY_HUE_RANGE.min && h <= CATEGORY_HUE_RANGE.max;
}
