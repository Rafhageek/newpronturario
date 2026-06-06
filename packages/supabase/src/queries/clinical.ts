import type {
  Allergy,
  Appointment,
  Condition,
  FamilyHistory,
  InsertRow,
  InsurancePlan,
  Surgery,
  UpdateRow,
} from '@vidalog/core';
import type { VidaLogClient } from '../types';

// ── Consultas (appointments) ────────────────────────────────────────────────
export async function listAppointments(
  client: VidaLogClient,
  patientId: string,
): Promise<Appointment[]> {
  const { data, error } = await client
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Próxima consulta agendada (a partir de agora). */
export async function getNextAppointment(
  client: VidaLogClient,
  patientId: string,
  nowIso: string,
): Promise<Appointment | null> {
  const { data, error } = await client
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createAppointment(
  client: VidaLogClient,
  row: InsertRow<'appointments'>,
): Promise<Appointment> {
  const { data, error } = await client.from('appointments').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateAppointment(
  client: VidaLogClient,
  id: string,
  patch: UpdateRow<'appointments'>,
): Promise<Appointment> {
  const { data, error } = await client
    .from('appointments')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ── Condições (conditions) ──────────────────────────────────────────────────
export async function listConditions(
  client: VidaLogClient,
  patientId: string,
): Promise<Condition[]> {
  const { data, error } = await client
    .from('conditions')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function createCondition(client: VidaLogClient, row: InsertRow<'conditions'>) {
  const { data, error } = await client.from('conditions').insert(row).select('*').single();
  if (error) throw error;
  return data;
}
export async function updateCondition(client: VidaLogClient, id: string, patch: UpdateRow<'conditions'>) {
  const { data, error } = await client.from('conditions').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}
export async function deleteCondition(client: VidaLogClient, id: string) {
  const { error } = await client.from('conditions').delete().eq('id', id);
  if (error) throw error;
}

// ── Alergias (allergies) ────────────────────────────────────────────────────
export async function listAllergies(client: VidaLogClient, patientId: string): Promise<Allergy[]> {
  const { data, error } = await client
    .from('allergies')
    .select('*')
    .eq('patient_id', patientId)
    .order('severity', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function createAllergy(client: VidaLogClient, row: InsertRow<'allergies'>) {
  const { data, error } = await client.from('allergies').insert(row).select('*').single();
  if (error) throw error;
  return data;
}
export async function deleteAllergy(client: VidaLogClient, id: string) {
  const { error } = await client.from('allergies').delete().eq('id', id);
  if (error) throw error;
}

// ── Cirurgias (surgeries) ───────────────────────────────────────────────────
export async function listSurgeries(client: VidaLogClient, patientId: string): Promise<Surgery[]> {
  const { data, error } = await client
    .from('surgeries')
    .select('*')
    .eq('patient_id', patientId)
    .order('performed_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}
export async function createSurgery(client: VidaLogClient, row: InsertRow<'surgeries'>) {
  const { data, error } = await client.from('surgeries').insert(row).select('*').single();
  if (error) throw error;
  return data;
}
export async function deleteSurgery(client: VidaLogClient, id: string) {
  const { error } = await client.from('surgeries').delete().eq('id', id);
  if (error) throw error;
}

// ── Antecedentes familiares (family_history) ────────────────────────────────
export async function listFamilyHistory(
  client: VidaLogClient,
  patientId: string,
): Promise<FamilyHistory[]> {
  const { data, error } = await client
    .from('family_history')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function createFamilyHistory(client: VidaLogClient, row: InsertRow<'family_history'>) {
  const { data, error } = await client.from('family_history').insert(row).select('*').single();
  if (error) throw error;
  return data;
}
export async function deleteFamilyHistory(client: VidaLogClient, id: string) {
  const { error } = await client.from('family_history').delete().eq('id', id);
  if (error) throw error;
}

// ── Convênio (insurance_plans) ──────────────────────────────────────────────
export async function getPrimaryInsurance(
  client: VidaLogClient,
  patientId: string,
): Promise<InsurancePlan | null> {
  const { data, error } = await client
    .from('insurance_plans')
    .select('*')
    .eq('patient_id', patientId)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Cria ou atualiza o convênio primário do paciente. */
export async function upsertPrimaryInsurance(
  client: VidaLogClient,
  patientId: string,
  values: Omit<InsertRow<'insurance_plans'>, 'patient_id'>,
): Promise<InsurancePlan> {
  const existing = await getPrimaryInsurance(client, patientId);
  if (existing) {
    const { data, error } = await client
      .from('insurance_plans')
      .update(values)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client
    .from('insurance_plans')
    .insert({ ...values, patient_id: patientId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
