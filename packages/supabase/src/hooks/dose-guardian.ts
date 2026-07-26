'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import {
  getDoseGuardianSettings,
  saveDoseGuardianSettings,
  disableDoseGuardian,
  listMedicationsWithCriticality,
  setMedicationCritical,
  listDoseGuardianActivePatients,
  defaultDoseGuardianSettings,
  type DoseGuardianSettings,
  type DoseGuardianSettingsInput,
} from '../queries/dose-guardian';

/** Chaves locais (o barril de keys é atualizado separadamente). */
const doseGuardianKeys = {
  settings: (userId: string) => ['dose-guardian', 'settings', userId] as const,
  medications: (userId: string) => ['dose-guardian', 'medications', userId] as const,
  activePatients: () => ['dose-guardian', 'active-patients'] as const,
};

/**
 * Preferência do Guardião de Dose do próprio usuário. Sem linha no banco =
 * recurso desligado (opt-in explícito exigido pela LGPD para dado sensível).
 */
export function useDoseGuardianSettings(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery<DoseGuardianSettings>({
    queryKey: doseGuardianKeys.settings(userId ?? ''),
    queryFn: async () => {
      const id = userId as string;
      const found = await getDoseGuardianSettings(client, id);
      return found ?? defaultDoseGuardianSettings(id);
    },
    enabled: Boolean(userId),
  });
}

/** Liga/desliga o Guardião e ajusta o prazo de tolerância. */
export function useSaveDoseGuardianSettings(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DoseGuardianSettingsInput) =>
      saveDoseGuardianSettings(client, userId as string, input),
    onSuccess: (saved) => {
      qc.setQueryData(doseGuardianKeys.settings(userId ?? ''), saved);
      void qc.invalidateQueries({ queryKey: doseGuardianKeys.settings(userId ?? '') });
    },
  });
}

/** Revogação em um toque — precisa ser tão simples quanto ativar. */
export function useDisableDoseGuardian(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => disableDoseGuardian(client, userId as string),
    onSuccess: (saved) => {
      qc.setQueryData(doseGuardianKeys.settings(userId ?? ''), saved);
      void qc.invalidateQueries({ queryKey: doseGuardianKeys.settings(userId ?? '') });
    },
  });
}

/** Medicamentos ativos do paciente com o flag de dose crítica. */
export function useMedicationsCriticality(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: doseGuardianKeys.medications(userId ?? ''),
    queryFn: () => listMedicationsWithCriticality(client, userId as string),
    enabled: Boolean(userId),
  });
}

/** Marca/desmarca um medicamento como dose crítica (consentimento granular). */
export function useSetMedicationCritical(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { medicationId: string; isCritical: boolean }) =>
      setMedicationCritical(client, vars.medicationId, vars.isCritical),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: doseGuardianKeys.medications(userId ?? '') });
      void qc.invalidateQueries({ queryKey: ['medications'] });
    },
  });
}

/**
 * Lado do cuidador: pessoas que eu cuido e que mantêm o Guardião ativo.
 * Serve para a UI mostrar que o recurso existe — nada de vigilância oculta.
 */
export function useDoseGuardianActivePatients(enabled = true) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: doseGuardianKeys.activePatients(),
    queryFn: () => listDoseGuardianActivePatients(client),
    enabled,
  });
}
