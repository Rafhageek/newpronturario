import type { Medication, MedicationIntake, InsertRow, UpdateRow } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

export async function listMedications(
  client: HubPatientsClient,
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
  client: HubPatientsClient,
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
  client: HubPatientsClient,
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
  client: HubPatientsClient,
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

// ── Controle de estoque ──────────────────────────────────────────────────────

export interface StockPatch {
  stockCount?: number | null;
  stockUnit?: string;
  stockLowThresholdDays?: number;
  packageSize?: number | null;
}

/** Atualiza os campos de estoque do medicamento (toggle/edição manual). */
export async function updateStock(
  client: HubPatientsClient,
  medicationId: string,
  patch: StockPatch,
): Promise<void> {
  const row: UpdateRow<'medications'> = { stock_last_updated_at: new Date().toISOString() };
  if (patch.stockCount !== undefined) row.stock_count = patch.stockCount;
  if (patch.stockUnit !== undefined) row.stock_unit = patch.stockUnit;
  if (patch.stockLowThresholdDays !== undefined) row.stock_low_threshold_days = patch.stockLowThresholdDays;
  if (patch.packageSize !== undefined) row.package_size = patch.packageSize;
  const { error } = await client.from('medications').update(row).eq('id', medicationId);
  if (error) throw error;
}

/** "Comprei mais!" — soma atômica no banco; evita lost update concorrente. */
export async function markRefill(
  client: HubPatientsClient,
  medicationId: string,
  unitsToAdd: number,
): Promise<void> {
  // A assinatura será incorporada aos tipos gerados após a migration 0036.
  // O cast local evita editar manualmente os tipos compartilhados.
  const rpcClient = client as unknown as {
    rpc: (
      functionName: 'refill_medication_stock',
      args: { p_medication_id: string; p_units: number },
    ) => PromiseLike<{ error: unknown | null }>;
  };
  const { error } = await rpcClient.rpc('refill_medication_stock', {
    p_medication_id: medicationId,
    p_units: unitsToAdd,
  });
  if (error) throw error;
}
