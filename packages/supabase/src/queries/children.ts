import type {
  Child,
  ChildGrowthMeasurement,
  ChildMilestone,
  ChildMilestoneCatalog,
  ChildVaccineSchedule,
  WhoGrowthStandard,
  Vaccination,
  ChildSex,
  AuditAction,
  InsertRow,
} from '@hubpatients/core';
import { diaLocal } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

/** Registra (na trilha de auditoria) uma leitura/ação sobre dados da criança. */
export async function logChildAccess(
  client: HubPatientsClient,
  childId: string,
  action: AuditAction = 'read',
): Promise<void> {
  // Best-effort: não quebra a UI se o log falhar.
  await client.rpc('log_child_access', { p_child: childId, p_action: action });
}

export async function listChildren(client: HubPatientsClient): Promise<Child[]> {
  const { data, error } = await client
    .from('children')
    .select('*')
    .order('birth_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getChild(client: HubPatientsClient, childId: string): Promise<Child | null> {
  const { data, error } = await client.from('children').select('*').eq('id', childId).maybeSingle();
  if (error) throw error;
  if (data) await logChildAccess(client, childId, 'read');
  return data ?? null;
}

export async function addChild(
  client: HubPatientsClient,
  parentId: string,
  input: {
    fullName: string;
    birthDate: string; // YYYY-MM-DD
    sex: ChildSex;
    birthWeightG?: number;
    birthLengthCm?: number;
    birthHeadCircumferenceCm?: number;
    gestationalAgeWeeksAtBirth?: number;
    deliveryType?: 'vaginal' | 'cesarean';
    bloodType?: string;
  },
): Promise<Child> {
  const row: InsertRow<'children'> = {
    parent_profile_id: parentId,
    full_name: input.fullName,
    birth_date: input.birthDate,
    sex: input.sex,
    birth_weight_g: input.birthWeightG ?? null,
    birth_length_cm: input.birthLengthCm ?? null,
    birth_head_circumference_cm: input.birthHeadCircumferenceCm ?? null,
    gestational_age_weeks_at_birth: input.gestationalAgeWeeksAtBirth ?? null,
    delivery_type: input.deliveryType ?? null,
    // bloodType vem do enum blood_type; default no banco é 'unknown'
    ...(input.bloodType ? { blood_type: input.bloodType as Child['blood_type'] } : {}),
  };
  const { data, error } = await client.from('children').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function listGrowth(
  client: HubPatientsClient,
  childId: string,
): Promise<ChildGrowthMeasurement[]> {
  const { data, error } = await client
    .from('child_growth_measurements')
    .select('*')
    .eq('child_id', childId)
    .order('age_months_at_measurement', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addMeasurement(
  client: HubPatientsClient,
  childId: string,
  ageMonths: number,
  input: {
    measuredAt?: string;
    weightKg?: number;
    lengthOrHeightCm?: number;
    headCircumferenceCm?: number;
    notes?: string;
  },
): Promise<void> {
  const { error } = await client.from('child_growth_measurements').insert({
    child_id: childId,
    age_months_at_measurement: ageMonths,
    // `diaLocal()`, nunca `toISOString().slice(0,10)`: a segunda joga para UTC
    // e, depois das 21h no Brasil, a medida de HOJE entra com a data de AMANHÃ.
    // Em curva de crescimento infantil isso desloca o ponto no gráfico.
    measured_at: input.measuredAt ?? diaLocal(),
    weight_kg: input.weightKg ?? null,
    length_or_height_cm: input.lengthOrHeightCm ?? null,
    head_circumference_cm: input.headCircumferenceCm ?? null,
    notes: input.notes ?? null,
  });
  if (error) throw error;
}

export async function listChildMilestones(
  client: HubPatientsClient,
  childId: string,
): Promise<ChildMilestone[]> {
  const { data, error } = await client
    .from('child_milestones')
    .select('*')
    .eq('child_id', childId);
  if (error) throw error;
  return data ?? [];
}

export async function markMilestone(
  client: HubPatientsClient,
  childId: string,
  code: string,
  achievedAt: string | null,
): Promise<void> {
  const { error } = await client
    .from('child_milestones')
    .upsert(
      { child_id: childId, milestone_code: code, achieved_at: achievedAt },
      { onConflict: 'child_id,milestone_code' },
    );
  if (error) throw error;
}

export async function listChildVaccinations(
  client: HubPatientsClient,
  childId: string,
): Promise<Vaccination[]> {
  const { data, error } = await client
    .from('vaccinations')
    .select('*')
    .eq('child_id', childId)
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function recordVaccine(
  client: HubPatientsClient,
  childId: string,
  parentId: string,
  input: {
    vaccineName: string;
    doseLabel?: string;
    appliedAt?: string;
    lot?: string;
    manufacturer?: string;
    location?: string;
  },
): Promise<void> {
  const { error } = await client.from('vaccinations').insert({
    patient_id: parentId, // patient_id é NOT NULL; responsável é o "dono"
    child_id: childId,
    vaccine_name: input.vaccineName,
    dose_label: input.doseLabel ?? null,
    applied_at: input.appliedAt ?? null,
    lot: input.lot ?? null,
    manufacturer: input.manufacturer ?? null,
    location: input.location ?? null,
  });
  if (error) throw error;
}

// ── Catálogos / curvas (referência) ──────────────────────────────────────────

export async function getMilestoneCatalog(client: HubPatientsClient): Promise<ChildMilestoneCatalog[]> {
  const { data, error } = await client
    .from('child_milestone_catalog')
    .select('*')
    .order('typical_age_months_min', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getVaccineSchedule(client: HubPatientsClient): Promise<ChildVaccineSchedule[]> {
  const { data, error } = await client
    .from('child_vaccine_schedule')
    .select('*')
    .order('recommended_age_months', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getWhoStandard(
  client: HubPatientsClient,
  indicator: string,
  sex: ChildSex,
): Promise<WhoGrowthStandard[]> {
  const { data, error } = await client
    .from('who_growth_standards')
    .select('*')
    .eq('indicator', indicator)
    .eq('sex', sex)
    .order('x', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
