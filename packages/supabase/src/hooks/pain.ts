'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  listPainPoints,
  listPainHistory,
  addPainPoints,
  deletePainPoint,
  type NewPainPoint,
} from '../queries/pain';

export function usePainPoints(diaryEntryId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.painPoints(diaryEntryId ?? ''),
    queryFn: () => listPainPoints(client, diaryEntryId as string),
    enabled: Boolean(diaryEntryId),
  });
}

export function usePainHistory(userId: string | undefined, sinceDate?: string) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.painHistory(userId ?? ''),
    queryFn: () => listPainHistory(client, userId as string, sinceDate),
    enabled: Boolean(userId),
  });
}

export function useAddPainPoints(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ diaryEntryId, points }: { diaryEntryId: string; points: NewPainPoint[] }) =>
      addPainPoints(client, diaryEntryId, userId, points),
    onSuccess: (_d, { diaryEntryId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.painPoints(diaryEntryId) });
      qc.invalidateQueries({ queryKey: queryKeys.painHistory(userId) });
    },
  });
}

export function useDeletePainPoint(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePainPoint(client, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.painHistory(userId) }),
  });
}
