import type { HubPatientsClient } from '../types';

/**
 * Guardião de Dose — leitura/escrita da preferência do paciente e da marcação
 * de medicamento crítico (migração 0041).
 *
 * LGPD: `dose_guardian_settings` é o CONSENTIMENTO do titular para que uma
 * falha de confirmação de dose seja comunicada a um terceiro (o cuidador).
 * Por isso tudo aqui é owner-only: só o próprio paciente lê e grava, e ele
 * pode revogar a qualquer momento apenas desligando `enabled`. O cuidador
 * nunca escreve — a policy do banco recusa (`user_id = auth.uid()`).
 *
 * Tabelas/colunas novas ainda não estão nos Database types → cast controlado,
 * mesmo padrão de `queries/body.ts`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(client: HubPatientsClient, name: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(name);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpc(client: HubPatientsClient, name: string, args?: Record<string, unknown>): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).rpc(name, args ?? {});
}

/** Limites aceitos pelo check do banco (`dose_guardian_delay_range`). */
export const DOSE_GUARDIAN_MIN_DELAY = 30;
export const DOSE_GUARDIAN_MAX_DELAY = 240;
export const DOSE_GUARDIAN_DEFAULT_DELAY = 90;

/** Opções de atraso oferecidas na UI (todas dentro do check do banco). */
export const DOSE_GUARDIAN_DELAY_OPTIONS: readonly number[] = [30, 60, 90, 120, 180, 240];

export type DoseGuardianSettings = {
  user_id: string;
  enabled: boolean;
  delay_minutes: number;
  updated_at: string;
};

export type DoseGuardianSettingsInput = {
  enabled?: boolean;
  delay_minutes?: number;
};

/** Paciente que ativou o Guardião e para quem eu sou cuidador autorizado. */
export type DoseGuardianActivePatient = {
  patient_id: string;
  delay_minutes: number;
};

/** Medicamento com a marcação de dose crítica. */
export type CriticalMedication = {
  id: string;
  name: string;
  dosage: string | null;
  active: boolean;
  is_critical: boolean;
};

/** Estado padrão quando o paciente nunca abriu a configuração (desligado). */
export function defaultDoseGuardianSettings(userId: string): DoseGuardianSettings {
  return {
    user_id: userId,
    enabled: false,
    delay_minutes: DOSE_GUARDIAN_DEFAULT_DELAY,
    updated_at: new Date(0).toISOString(),
  };
}

/**
 * Lê a preferência do próprio usuário. Retorna `null` quando ainda não existe
 * linha — o recurso nasce DESLIGADO (opt-in explícito, nunca opt-out).
 */
export async function getDoseGuardianSettings(
  client: HubPatientsClient,
  userId: string,
): Promise<DoseGuardianSettings | null> {
  const { data, error } = await table(client, 'dose_guardian_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as DoseGuardianSettings | null;
}

/**
 * Grava a preferência do paciente (upsert). Aplica o clamp do prazo no cliente
 * para dar erro amigável antes do check do banco recusar.
 */
export async function saveDoseGuardianSettings(
  client: HubPatientsClient,
  userId: string,
  input: DoseGuardianSettingsInput,
): Promise<DoseGuardianSettings> {
  const payload: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (input.enabled !== undefined) payload.enabled = input.enabled;
  if (input.delay_minutes !== undefined) {
    payload.delay_minutes = Math.min(
      DOSE_GUARDIAN_MAX_DELAY,
      Math.max(DOSE_GUARDIAN_MIN_DELAY, Math.round(input.delay_minutes)),
    );
  }

  const { data, error } = await table(client, 'dose_guardian_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as DoseGuardianSettings;
}

/**
 * Desliga o Guardião. Atalho explícito para a revogação do consentimento
 * (LGPD art. 8º, §5º): tem que ser tão fácil quanto ligar.
 */
export async function disableDoseGuardian(
  client: HubPatientsClient,
  userId: string,
): Promise<DoseGuardianSettings> {
  return saveDoseGuardianSettings(client, userId, { enabled: false });
}

/**
 * Medicamentos do paciente com o flag `is_critical`, para a tela escolher
 * quais doses entram no Guardião (consentimento granular, não global).
 */
export async function listMedicationsWithCriticality(
  client: HubPatientsClient,
  userId: string,
): Promise<CriticalMedication[]> {
  const { data, error } = await table(client, 'medications')
    .select('id, name, dosage, active, is_critical')
    .eq('patient_id', userId)
    .eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CriticalMedication[];
}

/**
 * Marca/desmarca um medicamento como dose crítica. A RLS `medications_modify`
 * já garante que só o próprio paciente consegue — o cuidador não.
 */
export async function setMedicationCritical(
  client: HubPatientsClient,
  medicationId: string,
  isCritical: boolean,
): Promise<void> {
  const { error } = await table(client, 'medications')
    .update({ is_critical: isCritical })
    .eq('id', medicationId);
  if (error) throw error;
}

/**
 * Do lado do CUIDADOR: quais das pessoas que eu cuido têm o Guardião ativo.
 * Transparência — o cuidador precisa saber que existe (e quando deixa de
 * existir, para não confiar numa cobertura que o paciente já revogou).
 */
export async function listDoseGuardianActivePatients(
  client: HubPatientsClient,
): Promise<DoseGuardianActivePatient[]> {
  const { data, error } = await rpc(client, 'dose_guardian_active_patients');
  if (error) throw error;
  return (data ?? []) as DoseGuardianActivePatient[];
}
