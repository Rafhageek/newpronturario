// Diário alimentar — registro simples (WebDiet-like), NUNCA prescreve dieta.

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Café da manhã',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche',
};

/** Emoji do humor pós-refeição (1–5). Índice 0 não usado. */
export const FEELING_EMOJI = ['', '😖', '🙁', '😐', '🙂', '😀'] as const;

export function feelingEmoji(feeling: number | null | undefined): string {
  if (feeling == null || feeling < 1 || feeling > 5) return '';
  return FEELING_EMOJI[Math.round(feeling)] ?? '';
}
