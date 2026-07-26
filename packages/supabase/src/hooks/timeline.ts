'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { getClinicalTimelinePage, type ClinicalTimelineCursor } from '../queries/timeline';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';

export function useClinicalTimeline(patientId: string | undefined, limit = 25) {
  const client = useHubPatientsClient();
  return useInfiniteQuery({
    queryKey: queryKeys.clinicalTimeline(patientId ?? ''),
    queryFn: ({ pageParam }) =>
      getClinicalTimelinePage(
        client,
        patientId as string,
        pageParam as ClinicalTimelineCursor | undefined,
        limit,
      ),
    initialPageParam: undefined as ClinicalTimelineCursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(patientId),
  });
}

