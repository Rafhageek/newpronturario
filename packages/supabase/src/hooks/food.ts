'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import {
  logFoodEntry,
  listTodayFoodEntries,
  deleteFoodEntry,
  type FoodEntryInput,
} from '../queries/food';

function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const key = (userId: string | undefined) => ['food-entries', userId ?? '', localDay()];

/** Itens alimentares de hoje. */
export function useTodayFoodEntries(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: key(userId),
    queryFn: () => listTodayFoodEntries(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useLogFoodEntry(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodEntryInput) => logFoodEntry(client, userId as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-entries', userId ?? ''] }),
  });
}

export function useDeleteFoodEntry(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFoodEntry(client, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-entries', userId ?? ''] }),
  });
}
