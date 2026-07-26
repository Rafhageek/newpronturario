import type { MilestoneCategory, DeliveryType } from '../types/db';

/** Disclaimer permanente das telas da criança. */
export const CHILD_DISCLAIMER =
  'Cada criança tem seu ritmo. Estas informações são educativas — em caso de dúvida sobre o crescimento ou o desenvolvimento, converse com o pediatra.';

export const CHILD_MILESTONE_CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  motor: 'Motor',
  language: 'Linguagem',
  social: 'Social',
  cognitive: 'Cognitivo',
};

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  vaginal: 'Parto normal',
  cesarean: 'Cesárea',
};

/** Indicadores de crescimento da OMS exibidos no app. */
export interface GrowthIndicatorMeta {
  key: string; // casa com who_growth_standards.indicator
  label: string;
  shortLabel: string;
  unit: string;
  /** Eixo X da curva: idade (meses) ou comprimento/altura (cm). */
  xAxis: 'age_months' | 'length_cm';
  /** Faixa etária aplicável (meses). */
  ageRange: [number, number];
}

export const GROWTH_INDICATORS: GrowthIndicatorMeta[] = [
  { key: 'wfa', label: 'Peso por idade', shortLabel: 'Peso', unit: 'kg', xAxis: 'age_months', ageRange: [0, 60] },
  { key: 'lhfa', label: 'Comprimento/altura por idade', shortLabel: 'Altura', unit: 'cm', xAxis: 'age_months', ageRange: [0, 60] },
  { key: 'bfa', label: 'IMC por idade', shortLabel: 'IMC', unit: 'kg/m²', xAxis: 'age_months', ageRange: [0, 60] },
  { key: 'hcfa', label: 'Perímetro cefálico por idade', shortLabel: 'P. cefálico', unit: 'cm', xAxis: 'age_months', ageRange: [0, 60] },
];

/** Linhas de percentil oficiais plotadas nos gráficos. */
export const PERCENTILE_LINES = [3, 15, 50, 85, 97] as const;

/** Tooltip explicativo (sem julgamento). */
export const PERCENTILE_HINT =
  'P50 = mediana da OMS. Os percentis mostram a posição em relação a crianças da mesma idade e sexo — não são nota nem diagnóstico.';
