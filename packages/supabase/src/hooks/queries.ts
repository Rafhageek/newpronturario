'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type InsertRow, type VitalType, daysRemainingForMed } from '@hubpatients/core';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import { getProfile } from '../queries/profile';
import { getDashboardSummary } from '../queries/dashboard';
import { listVitals, createVital } from '../queries/vitals';
import {
  listMedications,
  registerIntake,
  updateStock,
  markRefill,
  type StockPatch,
} from '../queries/medications';
import { listDiaryEntries, createDiaryEntry } from '../queries/diary';

export function useProfile(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.profile(userId ?? ''),
    queryFn: () => getProfile(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useDashboard(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.dashboard(patientId ?? ''),
    queryFn: () => getDashboardSummary(client, patientId as string),
    enabled: Boolean(patientId),
  });
}

export function useVitals(patientId: string | undefined, type?: VitalType) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.vitals(patientId ?? '', type),
    queryFn: () => listVitals(client, patientId as string, { type }),
    enabled: Boolean(patientId),
  });
}

export function useCreateVital(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vital: InsertRow<'vitals'>) => createVital(client, vital),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vitals(patientId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard(patientId) });
    },
  });
}

export function useMedications(patientId: string | undefined, activeOnly = false) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.medications(patientId ?? ''),
    queryFn: () => listMedications(client, patientId as string, { activeOnly }),
    enabled: Boolean(patientId),
  });
}

export function useRegisterIntake(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (intake: InsertRow<'medication_intakes'>) => registerIntake(client, intake),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.intakes(patientId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard(patientId) });
      // o trigger de estoque alterou medications → atualiza a lista
      qc.invalidateQueries({ queryKey: queryKeys.medications(patientId) });
    },
  });
}

/** Edita os campos de estoque (toggle/ajuste manual). */
export function useUpdateStock(patientId: string, medicationId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: StockPatch) => updateStock(client, medicationId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.medications(patientId) }),
  });
}

/** "Comprei mais!" — soma unidades ao estoque. */
export function useMarkRefill(patientId: string, medicationId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unitsToAdd: number) => markRefill(client, medicationId, unitsToAdd),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.medications(patientId) }),
  });
}

/** Medicamentos ativos com estoque rastreado, ordenados por urgência (menos dias primeiro). */
export function useStockSummary(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: [...queryKeys.medications(patientId ?? ''), 'stock-summary'],
    queryFn: async () => {
      const meds = await listMedications(client, patientId as string, { activeOnly: true });
      return meds
        .filter((m) => m.stock_count != null)
        .map((m) => ({ medication: m, daysRemaining: daysRemainingForMed(m) }))
        .sort((a, b) => (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity));
    },
    enabled: Boolean(patientId),
  });
}

export function useDiaryEntries(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.diary(patientId ?? ''),
    queryFn: () => listDiaryEntries(client, patientId as string),
    enabled: Boolean(patientId),
  });
}

export function useCreateDiaryEntry(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: InsertRow<'diary_entries'>) => createDiaryEntry(client, entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.diary(patientId) }),
  });
}
