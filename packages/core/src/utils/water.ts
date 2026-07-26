// Hidratação — meta gentil e adaptada ao idoso/crônico. NUNCA empurra volume
// cegamente: cardiopata/renal tem teto e é sempre encaminhado à equipe.

export const GLASS_ML = 250;

/**
 * Meta diária de água (ml). Idoso (65+) = **25 ml/kg** (mais conservador que o
 * clássico 35, por risco cardio/renal); adulto = 35 ml/kg. Arredonda a 50 ml.
 */
export function waterGoalMl(weightKg: number | null | undefined, age: number | null | undefined): number {
  const w = weightKg && weightKg > 0 ? weightKg : 70;
  const perKg = age != null && age >= 65 ? 25 : 35;
  const raw = w * perKg;
  return Math.max(1000, Math.round(raw / 50) * 50);
}

/** Copos (250 ml) para atingir a meta. */
export function glassesForGoal(goalMl: number): number {
  return Math.max(1, Math.round(goalMl / GLASS_ML));
}

export const WATER_CAP_NOTE =
  'Se você tem insuficiência cardíaca ou renal, confirme seu limite de líquidos com sua equipe de saúde — a meta acima é uma estimativa geral.';
