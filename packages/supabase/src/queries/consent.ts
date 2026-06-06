import type { AuditLogEntry, Consent, ConsentPurpose, Json } from '@vidalog/core';
import type { VidaLogClient } from '../types';

export async function listConsents(client: VidaLogClient, patientId: string): Promise<Consent[]> {
  const { data, error } = await client.from('consents').select('*').eq('patient_id', patientId);
  if (error) throw error;
  return data ?? [];
}

/** Grava (ou atualiza) um consentimento e registra a mudança no audit_log. */
export async function setConsent(
  client: VidaLogClient,
  patientId: string,
  purpose: ConsentPurpose,
  granted: boolean,
  scope: Json,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data: existing } = await client
    .from('consents')
    .select('id')
    .eq('patient_id', patientId)
    .eq('purpose', purpose)
    .maybeSingle();

  if (existing) {
    const { error } = await client
      .from('consents')
      .update({ granted, scope, granted_at: granted ? nowIso : null, revoked_at: granted ? null : nowIso })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await client
      .from('consents')
      .insert({ patient_id: patientId, purpose, granted, scope, granted_at: granted ? nowIso : null });
    if (error) throw error;
  }

  // Registro de auditoria (append-only).
  await client.from('audit_log').insert({
    actor_id: patientId,
    patient_id: patientId,
    action: granted ? 'share' : 'update',
    resource_type: 'consent',
    metadata: { purpose, granted },
  });
}

export interface AuditPage {
  entries: AuditLogEntry[];
  total: number;
}

export async function listAuditLog(
  client: VidaLogClient,
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
