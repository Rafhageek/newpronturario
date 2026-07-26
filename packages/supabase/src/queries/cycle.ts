import type { MenstrualCycleSettings, MenstrualCycleLog, InsertRow } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

export async function getCycleSettings(
  client: HubPatientsClient,
  userId: string,
): Promise<MenstrualCycleSettings | null> {
  const { data, error } = await client
    .from('menstrual_cycle_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export interface CycleSettingsPatch {
  trackingEnabled?: boolean;
  averageCycleDays?: number;
  averagePeriodDays?: number;
  contraceptiveMethod?: string | null;
  shareWithCaregiver?: boolean;
  shareWithDoctor?: boolean;
  shareWithResearch?: boolean;
}

export async function upsertCycleSettings(
  client: HubPatientsClient,
  userId: string,
  patch: CycleSettingsPatch,
): Promise<void> {
  const row: InsertRow<'menstrual_cycle_settings'> = { user_id: userId };
  if (patch.trackingEnabled !== undefined) row.tracking_enabled = patch.trackingEnabled;
  if (patch.averageCycleDays !== undefined) row.average_cycle_days = patch.averageCycleDays;
  if (patch.averagePeriodDays !== undefined) row.average_period_days = patch.averagePeriodDays;
  if (patch.contraceptiveMethod !== undefined) row.contraceptive_method = patch.contraceptiveMethod;
  if (patch.shareWithCaregiver !== undefined) row.share_with_caregiver = patch.shareWithCaregiver;
  if (patch.shareWithDoctor !== undefined) row.share_with_doctor = patch.shareWithDoctor;
  if (patch.shareWithResearch !== undefined) row.share_with_research = patch.shareWithResearch;
  const { error } = await client
    .from('menstrual_cycle_settings')
    .upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function listCycleLogs(
  client: HubPatientsClient,
  userId: string,
  sinceDate?: string,
): Promise<MenstrualCycleLog[]> {
  let q = client.from('menstrual_cycle_logs').select('*').eq('user_id', userId);
  if (sinceDate) q = q.gte('log_date', sinceDate);
  const { data, error } = await q.order('log_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertCycleLog(
  client: HubPatientsClient,
  userId: string,
  logDate: string,
  input: { flowLevel: number; symptoms: string[]; mood: string[]; notes?: string },
): Promise<void> {
  const { error } = await client.from('menstrual_cycle_logs').upsert(
    {
      user_id: userId,
      log_date: logDate,
      flow_level: input.flowLevel,
      symptoms: input.symptoms,
      mood: input.mood,
      notes: input.notes ?? null,
    },
    { onConflict: 'user_id,log_date' },
  );
  if (error) throw error;
}

/** Apaga TODO o histórico de ciclo do usuário (ação irreversível). */
export async function deleteAllCycleLogs(client: HubPatientsClient, userId: string): Promise<void> {
  const { error } = await client.from('menstrual_cycle_logs').delete().eq('user_id', userId);
  if (error) throw error;
}
