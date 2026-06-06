import type { Vital, InsertRow, VitalType } from '@vidalog/core';
import type { VidaLogClient } from '../types';

export async function listVitals(
  client: VidaLogClient,
  patientId: string,
  options: { type?: VitalType; limit?: number } = {},
): Promise<Vital[]> {
  let query = client
    .from('vitals')
    .select('*')
    .eq('patient_id', patientId)
    .order('measured_at', { ascending: false })
    .limit(options.limit ?? 50);
  if (options.type) query = query.eq('type', options.type);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Última medição de um tipo (ex.: última PA para o dashboard). */
export async function getLatestVital(
  client: VidaLogClient,
  patientId: string,
  type: VitalType,
): Promise<Vital | null> {
  const { data, error } = await client
    .from('vitals')
    .select('*')
    .eq('patient_id', patientId)
    .eq('type', type)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Medições de um tipo a partir de uma data (ascendente — ideal para gráficos). */
export async function listVitalsSince(
  client: VidaLogClient,
  patientId: string,
  type: VitalType,
  sinceIso: string,
): Promise<Vital[]> {
  const { data, error } = await client
    .from('vitals')
    .select('*')
    .eq('patient_id', patientId)
    .eq('type', type)
    .gte('measured_at', sinceIso)
    .order('measured_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Todas as medições (qualquer tipo) a partir de uma data — para a timeline do diário. */
export async function listVitalsSinceAll(
  client: VidaLogClient,
  patientId: string,
  sinceIso: string,
): Promise<Vital[]> {
  const { data, error } = await client
    .from('vitals')
    .select('*')
    .eq('patient_id', patientId)
    .gte('measured_at', sinceIso)
    .order('measured_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createVital(
  client: VidaLogClient,
  vital: InsertRow<'vitals'>,
): Promise<Vital> {
  const { data, error } = await client.from('vitals').insert(vital).select('*').single();
  if (error) throw error;
  return data;
}
