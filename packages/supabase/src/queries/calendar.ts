import type { HubPatientsClient } from '../types';

export interface CalendarSettings {
  token: string;
  enabled: boolean;
  rotatedAt: string | null;
}

export async function getCalendarSettings(
  client: HubPatientsClient,
  userId: string,
): Promise<CalendarSettings | null> {
  const { data, error } = await client
    .from('profiles')
    .select('calendar_token, calendar_enabled, calendar_token_rotated_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    token: data.calendar_token,
    enabled: data.calendar_enabled,
    rotatedAt: data.calendar_token_rotated_at,
  };
}

export async function setCalendarEnabled(
  client: HubPatientsClient,
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await client
    .from('profiles')
    .update({ calendar_enabled: enabled })
    .eq('id', userId);
  if (error) throw error;
}

/** Rotaciona o token (invalida a URL antiga). Retorna o novo token. */
export async function rotateCalendarToken(client: HubPatientsClient, userId: string): Promise<string> {
  const next = crypto.randomUUID();
  const { error } = await client
    .from('profiles')
    .update({ calendar_token: next, calendar_token_rotated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
  return next;
}
