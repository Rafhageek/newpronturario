'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PregnancyRisk } from '@hubpatients/core';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  getActivePregnancy,
  startPregnancy,
  getPregnancyTimeline,
  setMilestoneCompleted,
  listWeightLog,
  logWeight,
  listFetalMovements,
  logFetalMovement,
  type StartPregnancyArgs,
} from '../queries/pregnancy';

export function useActivePregnancy(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.activePregnancy(userId ?? ''),
    queryFn: () => getActivePregnancy(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useStartPregnancy(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: StartPregnancyArgs) => startPregnancy(client, args),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.activePregnancy(userId ?? '') }),
  });
}

export function usePregnancyTimeline(journeyId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.pregnancyTimeline(journeyId ?? ''),
    queryFn: () => getPregnancyTimeline(client, journeyId as string),
    enabled: Boolean(journeyId),
  });
}

export function useSetMilestoneCompleted(journeyId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, completedAt }: { milestoneId: string; completedAt: string | null }) =>
      setMilestoneCompleted(client, milestoneId, completedAt),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pregnancyTimeline(journeyId) }),
  });
}

export function useWeightLog(journeyId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.pregnancyWeight(journeyId ?? ''),
    queryFn: () => listWeightLog(client, journeyId as string),
    enabled: Boolean(journeyId),
  });
}

export function useLogWeight(journeyId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ week, weightKg }: { week: number; weightKg: number }) =>
      logWeight(client, journeyId, week, weightKg),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pregnancyWeight(journeyId) }),
  });
}

export function useFetalMovements(journeyId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.pregnancyMovements(journeyId ?? ''),
    queryFn: () => listFetalMovements(client, journeyId as string),
    enabled: Boolean(journeyId),
  });
}

export function useLogFetalMovement(journeyId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { durationMinutes?: number; movementsCount?: number; notes?: string }) =>
      logFetalMovement(client, journeyId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pregnancyMovements(journeyId) }),
  });
}

export type { PregnancyRisk };
