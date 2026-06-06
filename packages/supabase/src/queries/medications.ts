import type { Medication, MedicationIntake, InsertRow } from '@vidalog/core';
import type { VidaLogClient } from '../types';

export async function listMedications(
  client: VidaLogClient,
  patientId: string,
  options: { activeOnly?: boolean } = {},
): Promise<Medication[]> {
  let query = client
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .order('name', { ascending: true });
  if (options.activeOnly) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createMedication(
  client: VidaLogClient,
  medication: InsertRow<'medications'>,
): Promise<Medication> {
  const { data, error } = await client
    .from('medications')
    .insert(medication)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Registra a tomada de um medicamento (feature de segurança gratuita). */
export async function registerIntake(
  client: VidaLogClient,
  intake: InsertRow<'medication_intakes'>,
): Promise<MedicationIntake> {
  const { data, error } = await client
    .from('medication_intakes')
    .insert(intake)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listRecentIntakes(
  client: VidaLogClient,
  patientId: string,
  limit = 20,
): Promise<MedicationIntake[]> {
  const { data, error } = await client
    .from('medication_intakes')
    .select('*')
    .eq('patient_id', patientId)
    .order('scheduled_for', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
