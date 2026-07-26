import { TACO_FOODS, type TacoFood } from '../data/taco';

export { TACO_FOODS };
export type { TacoFood };

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Índice normalizado (construído sob demanda) para busca sem acento.
let INDEX: { food: TacoFood; n: string }[] | null = null;
function index() {
  if (!INDEX) INDEX = TACO_FOODS.map((food) => ({ food, n: norm(food.name) }));
  return INDEX;
}

/**
 * Busca alimentos da TACO por nome (sem acento; exige todas as palavras).
 * Prioriza quem começa com o termo. Retorna no máx. `limit`.
 */
export function searchFoods(query: string, limit = 30): TacoFood[] {
  const q = norm(query).trim();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const matches: { food: TacoFood; n: string }[] = [];
  for (const item of index()) {
    if (terms.every((t) => item.n.includes(t))) matches.push(item);
  }
  matches.sort((a, b) => {
    const sa = a.n.startsWith(q) ? 0 : 1;
    const sb = b.n.startsWith(q) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.n.length - b.n.length;
  });
  return matches.slice(0, limit).map((m) => m.food);
}

export type NutritionValues = { kcal: number; protein: number; carbs: number; fat: number };

/** Escala a composição (que na TACO é por 100 g) para `grams` gramas. */
export function nutritionForGrams(food: TacoFood, grams: number): NutritionValues {
  const r = (Number.isFinite(grams) && grams > 0 ? grams : 0) / 100;
  return {
    kcal: Math.round(food.kcal * r),
    protein: Math.round(food.protein * r * 10) / 10,
    carbs: Math.round(food.carbs * r * 10) / 10,
    fat: Math.round(food.fat * r * 10) / 10,
  };
}

export const NUTRITION_DISCLAIMER =
  'Valores da Tabela TACO (UNICAMP), por estimativa. É um registro pessoal, não uma dieta nem recomendação — confirme metas de energia com sua equipe de saúde.';
