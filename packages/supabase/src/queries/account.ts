import type { VidaLogClient } from '../types';

/** Reúne os dados do usuário para exportação (LGPD Art. 18 — portabilidade). */
export async function exportUserData(
  client: VidaLogClient,
  patientId: string,
): Promise<Record<string, unknown>> {
  const patientTables = [
    'vitals',
    'medications',
    'medication_intakes',
    'diary_entries',
    'exams',
    'exam_metrics',
    'conditions',
    'allergies',
    'surgeries',
    'family_history',
    'vaccinations',
    'appointments',
    'insurance_plans',
    'consents',
  ] as const;

  const result: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    notice: 'Exportação de dados pessoais — VidaLog (LGPD Art. 18).',
  };

  const { data: profile } = await client.from('profiles').select('*').eq('id', patientId);
  result.profiles = profile ?? [];

  for (const table of patientTables) {
    const { data } = await client.from(table).select('*').eq('patient_id', patientId);
    result[table] = data ?? [];
  }
  return result;
}

/**
 * Soft-delete da conta com carência de 30 dias. Reautentica por senha antes
 * de marcar. A exclusão definitiva (purga) é um job agendado (Fase 4).
 */
export async function softDeleteAccount(
  client: VidaLogClient,
  email: string,
  password: string,
): Promise<void> {
  // Reautenticação (confirma a identidade).
  const { error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError) throw new Error('Senha incorreta.');

  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Sessão inválida.');

  const now = new Date();
  const scheduled = new Date(now);
  scheduled.setDate(scheduled.getDate() + 30);

  const { error } = await client
    .from('profiles')
    .update({ deleted_at: now.toISOString(), deletion_scheduled_at: scheduled.toISOString() })
    .eq('id', userId);
  if (error) throw error;

  await client.auth.signOut();
}
