import type { HubPatientsClient } from '../types';
import type { MealType } from '@hubpatients/core';

/** Diário alimentar (tabela meal_logs). Owner-only. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(client: HubPatientsClient): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from('meal_logs');
}

export type MealLog = {
  id: string;
  logged_at: string;
  meal_type: MealType;
  description: string;
  feeling: number | null;
  photo_url: string | null;
};

export type MealInput = {
  meal_type: MealType;
  description: string;
  feeling?: number | null;
  logged_at?: string;
};

export async function logMeal(
  client: HubPatientsClient,
  userId: string,
  input: MealInput,
): Promise<void> {
  const { error } = await table(client).insert({ user_id: userId, ...input });
  if (error) throw error;
}

export async function listMeals(
  client: HubPatientsClient,
  userId: string,
  limit = 50,
): Promise<MealLog[]> {
  const { data, error } = await table(client)
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MealLog[];
}

export async function deleteMeal(client: HubPatientsClient, id: string): Promise<void> {
  const { error } = await table(client).delete().eq('id', id);
  if (error) throw error;
}
