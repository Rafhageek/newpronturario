// Acompanhamento corporal (composição + circunferências). Só REGISTRA o que a
// pessoa/balança informa — nunca diagnostica nem classifica como bom/ruim.

export type BodyField = { key: string; label: string; unit: string; decimals: number };

/** Campos de composição corporal (o que uma balança inteligente costuma reportar). */
export const BODY_COMPOSITION_FIELDS: BodyField[] = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg', decimals: 1 },
  { key: 'bmi', label: 'IMC', unit: '', decimals: 1 },
  { key: 'body_fat_pct', label: 'Gordura', unit: '%', decimals: 1 },
  { key: 'muscle_mass_pct', label: 'Massa muscular', unit: '%', decimals: 1 },
  { key: 'visceral_fat', label: 'Gordura visceral', unit: '', decimals: 0 },
  { key: 'body_water_pct', label: 'Água corporal', unit: '%', decimals: 1 },
  { key: 'bone_mass_kg', label: 'Massa óssea', unit: 'kg', decimals: 1 },
  { key: 'bmr_kcal', label: 'Metabolismo (TMB)', unit: 'kcal', decimals: 0 },
];

/** Campos de circunferências (fita métrica). */
export const BODY_MEASUREMENT_FIELDS: BodyField[] = [
  { key: 'waist_cm', label: 'Cintura', unit: 'cm', decimals: 1 },
  { key: 'hip_cm', label: 'Quadril', unit: 'cm', decimals: 1 },
  { key: 'arm_cm', label: 'Braço', unit: 'cm', decimals: 1 },
  { key: 'thigh_cm', label: 'Coxa', unit: 'cm', decimals: 1 },
  { key: 'calf_cm', label: 'Panturrilha', unit: 'cm', decimals: 1 },
  { key: 'neck_cm', label: 'Pescoço', unit: 'cm', decimals: 1 },
  { key: 'chest_cm', label: 'Tórax', unit: 'cm', decimals: 1 },
];

/** Relação cintura/quadril (fato, não diagnóstico). null se faltar dado. */
export function waistHipRatio(
  waistCm: number | null | undefined,
  hipCm: number | null | undefined,
): number | null {
  if (!waistCm || !hipCm || hipCm <= 0) return null;
  return Math.round((waistCm / hipCm) * 100) / 100;
}

/** Formata um valor de campo corporal para exibição pt-BR (vírgula decimal). */
export function formatBodyValue(value: number | null | undefined, field: BodyField): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const fixed = value.toFixed(field.decimals).replace('.', ',');
  return field.unit ? `${fixed} ${field.unit}` : fixed;
}

export const BODY_DISCLAIMER =
  'Estes números são um registro pessoal (o que sua balança/fita indica), não um diagnóstico. Converse com sua equipe de saúde sobre o que é ideal para você.';
