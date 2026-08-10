import type {
  Allergy,
  Appointment,
  Condition,
  FamilyHistory,
  InsertRow,
  InsurancePlan,
  Surgery,
  UpdateRow,
} from '@hubpatients/core';
import { safeExamFileName, validateSurgeryReportUpload } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

// ── Consultas (appointments) ────────────────────────────────────────────────
export async function listAppointments(
  client: HubPatientsClient,
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
  client: HubPatientsClient,
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
  client: HubPatientsClient,
  row: InsertRow<'appointments'>,
): Promise<Appointment> {
  const { data, error } = await client.from('appointments').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateAppointment(
  client: HubPatientsClient,
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
  client: HubPatientsClient,
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
export async function createCondition(client: HubPatientsClient, row: InsertRow<'conditions'>) {
  const { data, error } = await client.from('conditions').insert(row).select('*').single();
  if (error) throw error;
  return data;
}
export async function updateCondition(client: HubPatientsClient, id: string, patch: UpdateRow<'conditions'>) {
  const { data, error } = await client.from('conditions').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}
export async function deleteCondition(client: HubPatientsClient, id: string) {
  const { error } = await client.from('conditions').delete().eq('id', id);
  if (error) throw error;
}

// ── Alergias (allergies) ────────────────────────────────────────────────────
export async function listAllergies(client: HubPatientsClient, patientId: string): Promise<Allergy[]> {
  const { data, error } = await client
    .from('allergies')
    .select('*')
    .eq('patient_id', patientId)
    .order('severity', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function createAllergy(client: HubPatientsClient, row: InsertRow<'allergies'>) {
  const { data, error } = await client.from('allergies').insert(row).select('*').single();
  if (error) throw error;
  return data;
}
export async function deleteAllergy(client: HubPatientsClient, id: string) {
  const { error } = await client.from('allergies').delete().eq('id', id);
  if (error) throw error;
}

// ── Cirurgias (surgeries) ───────────────────────────────────────────────────
export async function listSurgeries(client: HubPatientsClient, patientId: string): Promise<Surgery[]> {
  const { data, error } = await client
    .from('surgeries')
    .select('*')
    .eq('patient_id', patientId)
    .order('performed_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}
export async function createSurgery(client: HubPatientsClient, row: InsertRow<'surgeries'>) {
  const { data, error } = await client.from('surgeries').insert(row).select('*').single();
  if (error) throw error;
  return data;
}
export async function deleteSurgery(client: HubPatientsClient, id: string) {
  // Lê o anexo antes de apagar a linha: o arquivo no storage não some em cascata.
  const { data: existing } = await client.from('surgeries').select('report_path').eq('id', id).maybeSingle();
  const { error } = await client.from('surgeries').delete().eq('id', id);
  if (error) throw error;
  if (existing?.report_path) {
    try {
      await client.storage.from('exams').remove([existing.report_path]);
    } catch {
      // Órfão no storage é aceitável; a linha já saiu do prontuário.
    }
  }
}

// ── Laudo (PDF) da cirurgia — arquivo no bucket 'exams', sob <dono>/cirurgias/ ──

/** Web passa o File; mobile passa os bytes já lidos + metadados. */
export type SurgeryReportSource =
  | File
  | { name: string; type: string; size: number; data: Uint8Array };

export async function uploadSurgeryReportFile(
  client: HubPatientsClient,
  patientId: string,
  file: SurgeryReportSource,
): Promise<string> {
  const validation = validateSurgeryReportUpload(file);
  if (!validation.valid) throw new Error(validation.message);
  const path = `${patientId}/cirurgias/${Date.now()}_${safeExamFileName(file.name)}`;
  const body = 'data' in file ? file.data : file;
  const { error } = await client.storage.from('exams').upload(path, body, {
    contentType: validation.mime,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function setSurgeryReport(
  client: HubPatientsClient,
  surgeryId: string,
  reportPath: string | null,
): Promise<Surgery> {
  const { data, error } = await client
    .from('surgeries')
    .update({ report_path: reportPath })
    .eq('id', surgeryId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeSurgeryReportFile(client: HubPatientsClient, storagePath: string) {
  const { error } = await client.storage.from('exams').remove([storagePath]);
  if (error) throw error;
}

export async function getSurgeryReportSignedUrl(
  client: HubPatientsClient,
  storagePath: string,
  expiresIn = 60,
): Promise<string | null> {
  const { data, error } = await client.storage.from('exams').createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

// ── Antecedentes familiares (family_history) ────────────────────────────────
export async function listFamilyHistory(
  client: HubPatientsClient,
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
export async function createFamilyHistory(client: HubPatientsClient, row: InsertRow<'family_history'>) {
  const { data, error } = await client.from('family_history').insert(row).select('*').single();
  if (error) throw error;
  return data;
}
export async function deleteFamilyHistory(client: HubPatientsClient, id: string) {
  const { error } = await client.from('family_history').delete().eq('id', id);
  if (error) throw error;
}

// ── Convênio (insurance_plans) ──────────────────────────────────────────────
export async function getPrimaryInsurance(
  client: HubPatientsClient,
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
  client: HubPatientsClient,
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
