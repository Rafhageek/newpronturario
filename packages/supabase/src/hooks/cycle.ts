'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  getCycleSettings,
  upsertCycleSettings,
  listCycleLogs,
  upsertCycleLog,
  deleteAllCycleLogs,
  type CycleSettingsPatch,
} from '../queries/cycle';

export function useCycleSettings(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.cycleSettings(userId ?? ''),
    queryFn: () => getCycleSettings(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useUpdateCycleSettings(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: CycleSettingsPatch) => upsertCycleSettings(client, userId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cycleSettings(userId) }),
  });
}

export function useCycleLogs(userId: string | undefined, sinceDate?: string) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.cycleLogs(userId ?? ''),
    queryFn: () => listCycleLogs(client, userId as string, sinceDate),
    enabled: Boolean(userId),
  });
}

export function useAddCycleLog(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      logDate,
      input,
    }: {
      logDate: string;
      input: { flowLevel: number; symptoms: string[]; mood: string[]; notes?: string };
    }) => upsertCycleLog(client, userId, logDate, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cycleLogs(userId) }),
  });
}

export function useDeleteCycleHistory(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteAllCycleLogs(client, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cycleLogs(userId) }),
  });
}
