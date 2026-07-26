import type { HubPatientsClient } from '../types';

/** Metas do usuário (peso, passos, água). Owner-only. Tabela user_goals. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(client: HubPatientsClient): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from('user_goals');
}

export type GoalType = 'weight' | 'steps' | 'water' | 'calories';
export type Goals = Partial<Record<GoalType, number>>;

export async function getGoals(client: HubPatientsClient, userId: string): Promise<Goals> {
  const { data, error } = await table(client).select('goal_type, target_value').eq('user_id', userId);
  if (error) throw error;
  const out: Goals = {};
  for (const row of (data ?? []) as { goal_type: GoalType; target_value: number }[]) {
    out[row.goal_type] = Number(row.target_value);
  }
  return out;
}

export async function setGoal(
  client: HubPatientsClient,
  userId: string,
  goalType: GoalType,
  target: number,
): Promise<void> {
  const { error } = await table(client).upsert(
    { user_id: userId, goal_type: goalType, target_value: target, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,goal_type' },
  );
  if (error) throw error;
}
