'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { logMeal, listMeals, deleteMeal, type MealInput } from '../queries/meals';

const key = (userId: string | undefined) => ['meals', userId ?? ''];

/** Refeições registradas (mais recentes primeiro). */
export function useMeals(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: key(userId),
    queryFn: () => listMeals(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useLogMeal(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MealInput) => logMeal(client, userId as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(userId) }),
  });
}

export function useDeleteMeal(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMeal(client, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(userId) }),
  });
}
