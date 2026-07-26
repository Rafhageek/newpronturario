import type {
  PregnancyJourney,
  PregnancyWeightLog,
  PregnancyFetalMovement,
  PregnancyMilestone,
  PregnancyMilestoneCatalog,
  PregnancyRisk,
} from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

/** Item da timeline = marco da gestação + sua definição no catálogo do MS. */
export interface TimelineItem {
  milestone: PregnancyMilestone;
  catalog: PregnancyMilestoneCatalog | null;
}

/** Gestação ativa da usuária (ou null se não houver). */
export async function getActivePregnancy(
  client: HubPatientsClient,
  userId: string,
): Promise<PregnancyJourney | null> {
  const { data, error } = await client
    .from('pregnancy_journeys')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export interface StartPregnancyArgs {
  dueDate?: Date | null;
  lmpDate?: Date | null;
  riskLevel?: PregnancyRisk;
  obstetricianName?: string;
  obstetricianCrm?: string;
  obstetricianPhone?: string;
  maternityReference?: string;
  maternityPhone?: string;
}

const toISODate = (d?: Date | null): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

/** Inicia a gestação e popula os marcos do catálogo (RPC atômica). */
export async function startPregnancy(
  client: HubPatientsClient,
  args: StartPregnancyArgs,
): Promise<string> {
  const { data, error } = await client.rpc('start_pregnancy', {
    p_due_date: toISODate(args.dueDate),
    p_lmp_date: toISODate(args.lmpDate),
    p_risk: args.riskLevel ?? null,
    p_obstetrician_name: args.obstetricianName ?? null,
    p_obstetrician_crm: args.obstetricianCrm ?? null,
    p_obstetrician_phone: args.obstetricianPhone ?? null,
    p_maternity_reference: args.maternityReference ?? null,
    p_maternity_phone: args.maternityPhone ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Marcos da gestação, ordenados pela semana do catálogo. */
export async function getPregnancyTimeline(
  client: HubPatientsClient,
  journeyId: string,
): Promise<TimelineItem[]> {
  const [{ data: milestones, error }, { data: catalog }] = await Promise.all([
    client.from('pregnancy_milestones').select('*').eq('journey_id', journeyId),
    client.from('pregnancy_milestone_catalog').select('*'),
  ]);
  if (error) throw error;
  const byCode = new Map((catalog ?? []).map((c) => [c.code, c]));
  return (milestones ?? [])
    .map((milestone) => ({ milestone, catalog: byCode.get(milestone.milestone_code) ?? null }))
    .sort((a, b) => (a.catalog?.week_min ?? 99) - (b.catalog?.week_min ?? 99));
}

/** Marca/desmarca um marco como concluído. */
export async function setMilestoneCompleted(
  client: HubPatientsClient,
  milestoneId: string,
  completedAt: string | null,
): Promise<void> {
  const { error } = await client
    .from('pregnancy_milestones')
    .update({ completed_at: completedAt })
    .eq('id', milestoneId);
  if (error) throw error;
}

export async function listWeightLog(
  client: HubPatientsClient,
  journeyId: string,
): Promise<PregnancyWeightLog[]> {
  const { data, error } = await client
    .from('pregnancy_weight_log')
    .select('*')
    .eq('journey_id', journeyId)
    .order('week', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function logWeight(
  client: HubPatientsClient,
  journeyId: string,
  week: number,
  weightKg: number,
): Promise<void> {
  const { error } = await client
    .from('pregnancy_weight_log')
    .insert({ journey_id: journeyId, week, weight_kg: weightKg });
  if (error) throw error;
}

export async function listFetalMovements(
  client: HubPatientsClient,
  journeyId: string,
): Promise<PregnancyFetalMovement[]> {
  const { data, error } = await client
    .from('pregnancy_fetal_movements')
    .select('*')
    .eq('journey_id', journeyId)
    .order('recorded_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function logFetalMovement(
  client: HubPatientsClient,
  journeyId: string,
  input: { durationMinutes?: number; movementsCount?: number; notes?: string },
): Promise<void> {
  const { error } = await client.from('pregnancy_fetal_movements').insert({
    journey_id: journeyId,
    duration_minutes: input.durationMinutes ?? null,
    movements_count: input.movementsCount ?? null,
    notes: input.notes ?? null,
  });
  if (error) throw error;
}
