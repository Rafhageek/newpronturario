import type { HubPatientsClient } from '../types';

/**
 * Acompanhamento corporal (tabelas body_composition / body_measurements).
 * Owner-only. Tabelas novas ainda não tipadas nos Database types → cast controlado.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(client: HubPatientsClient, name: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(name);
}

export type BodyComposition = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  muscle_mass_pct: number | null;
  visceral_fat: number | null;
  body_water_pct: number | null;
  bone_mass_kg: number | null;
  bmr_kcal: number | null;
};

export type BodyCompositionInput = {
  measured_at?: string;
  weight_kg?: number | null;
  bmi?: number | null;
  body_fat_pct?: number | null;
  muscle_mass_pct?: number | null;
  visceral_fat?: number | null;
  body_water_pct?: number | null;
  bone_mass_kg?: number | null;
  bmr_kcal?: number | null;
};

export async function logBodyComposition(
  client: HubPatientsClient,
  userId: string,
  input: BodyCompositionInput,
): Promise<void> {
  const { error } = await table(client, 'body_composition').insert({ user_id: userId, ...input });
  if (error) throw error;
}

export async function listBodyComposition(
  client: HubPatientsClient,
  userId: string,
  limit = 60,
): Promise<BodyComposition[]> {
  const { data, error } = await table(client, 'body_composition')
    .select('*')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BodyComposition[];
}

// ---- Circunferências (body_measurements) ----------------------------------

export type BodyMeasurement = {
  id: string;
  measured_at: string;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  calf_cm: number | null;
  neck_cm: number | null;
  chest_cm: number | null;
};

export type BodyMeasurementInput = {
  measured_at?: string;
  waist_cm?: number | null;
  hip_cm?: number | null;
  arm_cm?: number | null;
  thigh_cm?: number | null;
  calf_cm?: number | null;
  neck_cm?: number | null;
  chest_cm?: number | null;
};

export async function logBodyMeasurement(
  client: HubPatientsClient,
  userId: string,
  input: BodyMeasurementInput,
): Promise<void> {
  const { error } = await table(client, 'body_measurements').insert({ user_id: userId, ...input });
  if (error) throw error;
}

export async function listBodyMeasurements(
  client: HubPatientsClient,
  userId: string,
  limit = 60,
): Promise<BodyMeasurement[]> {
  const { data, error } = await table(client, 'body_measurements')
    .select('*')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BodyMeasurement[];
}
