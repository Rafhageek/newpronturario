'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { getGoals, setGoal, type GoalType } from '../queries/goals';

/** Metas do usuário (peso/passos/água). */
export function useGoals(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: ['user-goals', userId ?? ''],
    queryFn: () => getGoals(client, userId as string),
    enabled: Boolean(userId),
  });
}

/** Define/atualiza uma meta. */
export function useSetGoal(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goalType, target }: { goalType: GoalType; target: number }) =>
      setGoal(client, userId as string, goalType, target),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-goals', userId ?? ''] }),
  });
}
