import { REPUTATION_LEVELS } from '../constants/community';

export interface ReputationLevel {
  /** Índice do nível (0 = Novato). */
  index: number;
  label: string;
  /** Pontuação mínima deste nível. */
  min: number;
  /** Pontuação mínima do próximo nível, ou null no topo. */
  next: number | null;
  /** Pontos faltando para o próximo nível (0 no topo). */
  toNext: number;
}

/**
 * Deriva o nível de reputação a partir dos pontos. Pontos negativos
 * (conteúdo removido por moderação) caem em "Novato". Calculado, nunca
 * armazenado — o saldo vive em community_members.reputation_points.
 */
export function reputationLevel(points: number): ReputationLevel {
  const p = Math.max(0, Math.floor(points || 0));
  let index = 0;
  let matched: { min: number; label: string } = { min: 0, label: 'Novato' };
  REPUTATION_LEVELS.forEach((lvl, i) => {
    if (p >= lvl.min) {
      matched = lvl;
      index = i;
    }
  });
  const nextLevel = REPUTATION_LEVELS[index + 1] ?? null;
  return {
    index,
    label: matched.label,
    min: matched.min,
    next: nextLevel ? nextLevel.min : null,
    toNext: nextLevel ? nextLevel.min - p : 0,
  };
}
