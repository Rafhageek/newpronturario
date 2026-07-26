'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { chart, status } from '@hubpatients/ui-tokens';

/**
 * Tema e movimento dos gráficos (Recharts) — ponto único.
 *
 * Por que as cores vêm do JS e não de CSS var: o Recharts pinta `fill`/`stroke`
 * como ATRIBUTO de SVG. `fill="var(--x)"` tem suporte irregular entre motores,
 * então resolvemos a paleta aqui, a partir dos tokens, e passamos hex literal.
 * Em HTML comum (legenda, tooltip nosso) continuamos usando as CSS vars.
 *
 * A paleta é NEUTRA-CLÍNICA: sem verde e sem vermelho. Semáforo em série de
 * dado do paciente é diagnóstico disfarçado — o app exibe e organiza, quem
 * interpreta é o médico.
 */

export interface ChartPalette {
  /**
   * Exatamente 4 séries — e a tupla é fechada de propósito: nenhuma paleta de
   * 4+ cores em sRGB consegue 3:1 entre si E 3:1 contra o fundo. Precisou de
   * uma 5ª série? O gráfico é que está errado (divida em dois).
   */
  series: readonly [string, string, string, string];
  /** `strokeDasharray` por série — distingue as linhas sem depender de cor. */
  dash: readonly (string | undefined)[];
  grid: string;
  /** Ticks e rótulos dos eixos. */
  axis: string;
  /** Traço/hachura da faixa de referência (≥3:1). */
  band: string;
  /** Texto dentro do gráfico sobre o fundo do card (≥4,5:1). */
  bandInk: string;
}

const DASH: readonly (string | undefined)[] = chart.dash.map((d) =>
  d ? d.join(' ') : undefined,
);

const LIGHT: ChartPalette = {
  series: chart.light,
  dash: DASH,
  grid: 'rgba(27,26,24,0.10)',
  axis: '#555149', // --muted claro: 6,39:1 (o #64748B antigo dava 3,9:1)
  band: status.light.neutro.mark, // #768498 — 3,1:1
  bandInk: status.light.neutro.ink, // #475262 — 7,9:1
};

const DARK: ChartPalette = {
  series: chart.dark,
  dash: DASH,
  grid: 'rgba(255,255,255,0.10)',
  axis: '#a7acb2',
  band: status.dark.neutro.mark,
  bandInk: status.dark.neutro.ink,
};

/**
 * Estilo do tooltip padrão do Recharts.
 *
 * O tooltip é HTML (não SVG), então aqui a CSS var funciona e o tema troca sem
 * JS. Corrige um bug real: o `contentStyle` anterior era `#0d1a2b` fixo — um
 * azul-marinho escuro desenhado para o tema escuro, que ficava aplicado também
 * no tema claro, com texto do tema claro por cima.
 */
export const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line-strong)',
  borderRadius: 12,
  padding: '8px 10px',
  fontSize: 'var(--text-caption, 0.8125rem)',
  color: 'var(--fg)',
  boxShadow: 'var(--shadow-paper-lg, 0 14px 32px -10px rgba(27,26,24,0.14))',
} as const;

export const tooltipLabelStyle = { color: 'var(--muted)', fontWeight: 600 } as const;

export const tooltipItemStyle = { color: 'var(--fg)' } as const;

/** Tick dos eixos: 12px (o 11px anterior fica abaixo do nosso piso de leitura). */
export const AXIS_TICK_SIZE = 12;

/** `true` só depois de montar — no servidor não existe tema resolvido. */
function useIsDark(): boolean {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && resolvedTheme === 'dark';
}

export function useChartPalette(): ChartPalette {
  return useIsDark() ? DARK : LIGHT;
}

/** Atalho para `referenceBandElements(band, uid, { colors: bandColors(p) })`. */
export function bandColors(p: ChartPalette): { band: string; ink: string } {
  return { band: p.band, ink: p.bandInk };
}

/**
 * Props de animação para `<Line>`, `<Area>`, `<Bar>` etc.
 *
 * `FATO`: o Recharts **2.15 não respeita** `prefers-reduced-motion` — o
 * `isAnimationActive: 'auto'` só existe na linha 3.x. E o padrão da 2.15 é
 * 1500 ms com 400 ms de atraso: o usuário encara um gráfico vazio por quase
 * meio segundo e depois espera um segundo e meio de desenho.
 *
 * Aqui: 600 ms, sem atraso, e desligado por completo quando o sistema pede
 * menos movimento (o dado aparece já pronto — nada se move durante a leitura
 * de valor clínico).
 */
export function useChartMotion() {
  const prefersReducedMotion = useReducedMotion();
  return {
    isAnimationActive: !prefersReducedMotion,
    animationDuration: 600,
    animationBegin: 0,
  } as const;
}
