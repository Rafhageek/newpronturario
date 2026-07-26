import type { AuditLogEntry, Consent, ConsentPurpose, Json } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

export async function listConsents(client: HubPatientsClient, patientId: string): Promise<Consent[]> {
  const { data, error } = await client.from('consents').select('*').eq('patient_id', patientId);
  if (error) throw error;
  return data ?? [];
}

/**
 * Grava consentimento e auditoria atomicamente pelo RPC owner-only.
 *
 * `version` identifica QUAL texto o titular leu ao decidir. Não é enfeite: o
 * ônus de provar o consentimento é do controlador (LGPD art. 8º, §1º), e sem a
 * versão não há como demonstrar depois o que foi informado. O RPC grava a
 * versão na linha e também no `audit_log`, formando o histórico de
 * concessão/revogação. Quem chama deve passar `CONSENT_TEXT_VERSION`.
 */
export async function setConsent(
  client: HubPatientsClient,
  patientId: string,
  purpose: ConsentPurpose,
  granted: boolean,
  scope: Json,
  version = 'v1',
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user || user.id !== patientId) {
    throw new Error('Consentimento só pode ser alterado pelo titular autenticado.');
  }

  const { error } = await client.rpc('set_patient_consent', {
    p_purpose: purpose,
    p_granted: granted,
    p_scope: scope,
    p_version: version,
  });
  if (error) throw error;
}

export interface AuditPage {
  entries: AuditLogEntry[];
  total: number;
}

export async function listAuditLog(
  client: HubPatientsClient,
  patientId: string,
  page = 0,
  pageSize = 20,
): Promise<AuditPage> {
  const from = page * pageSize;
  const { data, error, count } = await client
    .from('audit_log')
    .select('*', { count: 'exact' })
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { entries: data ?? [], total: count ?? 0 };
}
