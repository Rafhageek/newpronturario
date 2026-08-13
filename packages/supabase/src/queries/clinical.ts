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

// ── "Sem alergia conhecida" — declaração ATIVA do paciente (migration 0049) ──
//
// Lista vazia é ambígua: pode ser "não tem" ou "ninguém preencheu". A coluna
// `profiles.sem_alergia_conhecida_em` guarda O INSTANTE em que o paciente
// afirmou não ter alergia — null continua significando "não declarou", e
// nenhuma tela pode ler isso como "não tem".

/** Erro do PostgREST/Postgres em formato utilizável (nem todo erro traz `code`). */
function erroDoBanco(error: unknown): { code: string; message: string } {
  const e = error as { code?: unknown; message?: unknown } | null;
  return {
    code: typeof e?.code === 'string' ? e.code : '',
    message: typeof e?.message === 'string' ? e.message : '',
  };
}

/**
 * O banco ainda não tem a coluna da 0049?
 *
 * Acontece de verdade na janela entre o deploy do código e a aplicação da
 * migration (ou o contrário). Duas formas possíveis:
 *  · `42703` — undefined_column, quando o Postgres responde direto;
 *  · `PGRST204` — o PostgREST não achou a coluna no cache de schema.
 * A tela usa isto para dizer "recurso ainda não disponível" em vez de despejar
 * um erro técnico em cima de quem só queria dizer que não tem alergia.
 */
export function isNoKnownAllergyUnavailable(error: unknown): boolean {
  const { code, message } = erroDoBanco(error);
  if (code === '42703' || code === 'PGRST204') return true;
  return (
    message.includes('sem_alergia_conhecida_em') &&
    /does not exist|schema cache/i.test(message)
  );
}

/**
 * A declaração foi recusada porque existe alergia registrada.
 *
 * A regra é do BANCO (trigger `profiles_no_known_allergy_coherence`, 0049), não
 * da tela: o app não é a única porta do prontuário. `check_violation` = 23514.
 */
export function isNoKnownAllergyConflict(error: unknown): boolean {
  const { code, message } = erroDoBanco(error);
  return code === '23514' && /sem alergia conhecida/i.test(message);
}

/**
 * Registra que o paciente DECLAROU não ter alergia conhecida.
 * Devolve o instante gravado — é ele que a tela mostra ("declarado em …").
 */
export async function declareNoKnownAllergy(
  client: HubPatientsClient,
  patientId: string,
  quandoIso: string = new Date().toISOString(),
): Promise<string> {
  const { data, error } = await client
    .from('profiles')
    .update({ sem_alergia_conhecida_em: quandoIso })
    .eq('id', patientId)
    .select('sem_alergia_conhecida_em')
    .maybeSingle();
  if (error) throw error;
  // Sem linha = a política não deixou escrever (não é o dono do prontuário).
  // Silenciar isso deixaria a tela afirmando um registro que não existe.
  if (!data) throw new Error('Não foi possível registrar a declaração neste prontuário.');
  return data.sem_alergia_conhecida_em ?? quandoIso;
}

/**
 * Desfaz a declaração — a operação mais importante das duas: alergia
 * descoberta depois não pode encontrar o prontuário afirmando o contrário.
 */
export async function undoNoKnownAllergy(
  client: HubPatientsClient,
  patientId: string,
): Promise<void> {
  const { data, error } = await client
    .from('profiles')
    .update({ sem_alergia_conhecida_em: null })
    .eq('id', patientId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Não foi possível desfazer a declaração neste prontuário.');
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
