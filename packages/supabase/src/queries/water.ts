import type { HubPatientsClient } from '../types';

/**
 * Hidratação (tabela water_logs). Registro simples de ingestão de água do dia.
 * Feature de bem-estar. A tabela é nova e ainda não está nos tipos gerados do
 * Supabase, então o acesso é feito via cast controlado até regenerar.
 */

// Acesso à tabela ainda não tipada nos Database types gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(client: HubPatientsClient): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from('water_logs');
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Registra ingestão de água (ml) para o usuário atual. */
export async function logWater(client: HubPatientsClient, userId: string, ml: number): Promise<void> {
  const { error } = await table(client).insert({ user_id: userId, ml });
  if (error) throw error;
}

/** Total de água (ml) ingerida hoje pelo usuário. */
export async function getTodayWaterMl(client: HubPatientsClient, userId: string): Promise<number> {
  const { data, error } = await table(client)
    .select('ml')
    .eq('user_id', userId)
    .gte('logged_at', startOfTodayIso());
  if (error) throw error;
  return ((data ?? []) as { ml: number }[]).reduce((sum, r) => sum + (r.ml ?? 0), 0);
}
