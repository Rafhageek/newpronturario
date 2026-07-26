import type { UserSettings, UpdateRow } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

export async function getSettings(client: HubPatientsClient, userId: string): Promise<UserSettings | null> {
  const { data, error } = await client.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertSettings(
  client: HubPatientsClient,
  userId: string,
  patch: UpdateRow<'user_settings'>,
): Promise<UserSettings> {
  const { data, error } = await client
    .from('user_settings')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
