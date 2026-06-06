import type { Medication, MedicationIntake, Vital } from '@vidalog/core';
import type { VidaLogClient } from '../types';
import { getLatestVital } from './vitals';

export interface DashboardSummary {
  latestBloodPressure: Vital | null;
  activeMedications: Medication[];
  /** Próximas tomadas pendentes (lembrete básico — feature de segurança). */
  upcomingIntakes: MedicationIntake[];
}

/** Dados resumidos da tela Início (próxima medicação, última PA, alertas). */
export async function getDashboardSummary(
  client: VidaLogClient,
  patientId: string,
): Promise<DashboardSummary> {
  const [latestBloodPressure, medsResult, intakesResult] = await Promise.all([
    getLatestVital(client, patientId, 'blood_pressure'),
    client
      .from('medications')
      .select('*')
      .eq('patient_id', patientId)
      .eq('active', true)
      .order('name', { ascending: true }),
    client
      .from('medication_intakes')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  if (medsResult.error) throw medsResult.error;
  if (intakesResult.error) throw intakesResult.error;

  return {
    latestBloodPressure,
    activeMedications: medsResult.data ?? [],
    upcomingIntakes: intakesResult.data ?? [],
  };
}
