'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import { getCalendarSettings, setCalendarEnabled, rotateCalendarToken } from '../queries/calendar';

/** Status do sync + URL do feed .ics (montada a partir do token e do SUPABASE_URL). */
export function useCalendarSubscription(userId: string | undefined, supabaseUrl: string) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.calendarSettings(userId ?? ''),
    queryFn: async () => {
      const s = await getCalendarSettings(client, userId as string);
      if (!s) return null;
      const feedUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/calendar-feed?token=${s.token}`;
      return { ...s, feedUrl };
    },
    enabled: Boolean(userId),
  });
}

export function useSetCalendarSync(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setCalendarEnabled(client, userId, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.calendarSettings(userId) }),
  });
}

export function useRotateCalendarToken(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rotateCalendarToken(client, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.calendarSettings(userId) }),
  });
}
