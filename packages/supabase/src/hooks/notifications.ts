'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../queries/notifications';

/** Lista as notificações do usuário; revalida ao focar a aba e a cada 60s. */
export function useNotifications(userId: string | undefined, limit = 20) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.notifications(userId ?? ''),
    queryFn: () => listNotifications(client, userId as string, limit),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(client, id, new Date().toISOString()),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications(userId) }),
  });
}

export function useMarkAllNotificationsRead(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(client, userId, new Date().toISOString()),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications(userId) }),
  });
}
