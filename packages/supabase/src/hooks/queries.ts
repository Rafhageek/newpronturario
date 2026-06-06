'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InsertRow, VitalType } from '@vidalog/core';
import { useVidaLogClient } from './context';
import { queryKeys } from './keys';
import { getProfile } from '../queries/profile';
import { getDashboardSummary } from '../queries/dashboard';
import { listVitals, createVital } from '../queries/vitals';
import { listMedications, registerIntake } from '../queries/medications';
import { listDiaryEntries, createDiaryEntry } from '../queries/diary';

export function useProfile(userId: string | undefined) {
  const client = useVidaLogClient();
  return useQuery({
    queryKey: queryKeys.profile(userId ?? ''),
    queryFn: () => getProfile(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useDashboard(patientId: string | undefined) {
  const client = useVidaLogClient();
  return useQuery({
    queryKey: queryKeys.dashboard(patientId ?? ''),
    queryFn: () => getDashboardSummary(client, patientId as string),
    enabled: Boolean(patientId),
  });
}

export function useVitals(patientId: string | undefined, type?: VitalType) {
  const client = useVidaLogClient();
  return useQuery({
    queryKey: queryKeys.vitals(patientId ?? '', type),
    queryFn: () => listVitals(client, patientId as string, { type }),
    enabled: Boolean(patientId),
  });
}

export function useCreateVital(patientId: string) {
  const client = useVidaLogClient();
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
  const client = useVidaLogClient();
  return useQuery({
    queryKey: queryKeys.medications(patientId ?? ''),
    queryFn: () => listMedications(client, patientId as string, { activeOnly }),
    enabled: Boolean(patientId),
  });
}

export function useRegisterIntake(patientId: string) {
  const client = useVidaLogClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (intake: InsertRow<'medication_intakes'>) => registerIntake(client, intake),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.intakes(patientId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard(patientId) });
    },
  });
}

export function useDiaryEntries(patientId: string | undefined) {
  const client = useVidaLogClient();
  return useQuery({
    queryKey: queryKeys.diary(patientId ?? ''),
    queryFn: () => listDiaryEntries(client, patientId as string),
    enabled: Boolean(patientId),
  });
}

export function useCreateDiaryEntry(patientId: string) {
  const client = useVidaLogClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: InsertRow<'diary_entries'>) => createDiaryEntry(client, entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.diary(patientId) }),
  });
}
