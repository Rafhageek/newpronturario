/**
 * Sistema de movimento do HubPatients — fonte única para web e mobile.
 *
 * Princípios (docs/REDESIGN-2026-07.md §6):
 *  P1. Movimento confirma ação, nunca decora.
 *  P2. NADA se move durante a leitura de dado clínico. Um número que se mexe
 *      é um número em que não se confia.
 *  P3. Teto de 400 ms para tudo que responde a toque.
 *  P4. Sem overshoot perceptível (ζ ≥ 0,85). Alvo que ainda oscila é alvo que
 *      mão trêmula erra — e bounce forte infantiliza produto clínico.
 *  P5. Um elemento se move por vez (movimento periférico é gatilho vestibular:
 *      35,4% dos adultos 40+ têm disfunção vestibular — NHANES).
 *  P6. Nada em loop indefinido ao lado de conteúdo (WCAG SC 2.2.2).
 *  P7. "reduced motion" ≠ "sem animação": é "sem DESLOCAMENTO". Opacidade e
 *      cor continuam (comunicam estado com custo vestibular zero).
 *
 * Fontes: WCAG 2.3.3 https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions
 *         WCAG 2.2.2 https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
 *         NN/g       https://www.nngroup.com/articles/animation-duration/
 *         Material 3 https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
 */

/** Durações em ms. Faixa operacional de toque: 90–400 (NN/g). */
export const duration = {
  instant: 90, // press-in
  fast: 160, // press-out, troca de cor, backdrop saindo
  base: 240, // card, accordion, transição de tela
  calm: 320, // sheet, modal
  slow: 480, // count-up, barra de progresso
  draw: 700, // desenho de linha/gráfico (nunca bloqueia interação)
} as const;

/** Curvas. `signature` é a assinatura do produto (já usada em .vl-rise na web). */
export const easing = {
  signature: [0.22, 1, 0.36, 1],
  standard: [0.2, 0, 0, 1], // M3 standard
  enter: [0.05, 0.7, 0.1, 1], // M3 emphasized-decelerate
  exit: [0.3, 0, 1, 1], // M3 standard-accelerate
} as const;

/**
 * Springs na forma legível do Reanimated 4 / framer-motion.
 * ATENÇÃO (Reanimated): `duration` aqui é PERCEPTUAL — a real é 1,5× esse valor.
 */
export const spring = {
  responsive: { duration: 240, dampingRatio: 1.0 }, // indicador de aba, press
  calm: { duration: 320, dampingRatio: 1.0 }, // card, sheet, lista
  affirm: { duration: 420, dampingRatio: 0.72 }, // SÓ confirmação de ação
} as const;

/** Equivalentes físicos, quando a API pedir mass/damping/stiffness. */
export const springPhysics = {
  responsive: { damping: 26, stiffness: 260, mass: 0.65 }, // ζ=1,00
  calm: { damping: 24, stiffness: 180, mass: 0.8 }, // ζ=1,00
  affirm: { damping: 17, stiffness: 200, mass: 0.7 }, // ζ=0,72 (overshoot ~4%)
} as const;

/**
 * Entrada escalonada. O TETO não é opcional: sem ele, o 20º item de uma lista
 * entra 1,1 s depois do primeiro — além do limite de fluxo de 1 s (NN/g).
 */
export const stagger = { step: 45, cap: 6 } as const;

/** Atraso do i-ésimo item, já com teto aplicado. */
export function staggerDelay(index: number): number {
  return Math.min(index, stagger.cap) * stagger.step;
}

/**
 * Quantas repetições um pulse/shimmer pode ter. NUNCA -1/infinite ao lado de
 * conteúdo (SC 2.2.2) — depois disso o elemento fica estático.
 */
export const LOOP_LIMIT = 4;

export const motion = { duration, easing, spring, springPhysics, stagger, LOOP_LIMIT } as const;
export type Motion = typeof motion;
