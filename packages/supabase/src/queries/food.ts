import type { HubPatientsClient } from '../types';
import type { MealType } from '@hubpatients/core';

/** Diário alimentar completo (tabela food_entries). Owner-only. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(client: HubPatientsClient): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from('food_entries');
}

export type FoodEntry = {
  id: string;
  logged_at: string;
  meal_type: MealType;
  food_name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type FoodEntryInput = {
  meal_type: MealType;
  food_name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_at?: string;
};

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function logFoodEntry(
  client: HubPatientsClient,
  userId: string,
  input: FoodEntryInput,
): Promise<void> {
  const { error } = await table(client).insert({ user_id: userId, ...input });
  if (error) throw error;
}

/** Itens de hoje (do início do dia local até agora), mais antigos primeiro. */
export async function listTodayFoodEntries(
  client: HubPatientsClient,
  userId: string,
): Promise<FoodEntry[]> {
  const { data, error } = await table(client)
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', startOfTodayIso())
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FoodEntry[];
}

export async function deleteFoodEntry(client: HubPatientsClient, id: string): Promise<void> {
  const { error } = await table(client).delete().eq('id', id);
  if (error) throw error;
}
