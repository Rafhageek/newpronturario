'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  listHealthPlaces,
  createHealthPlace,
  updateHealthPlace,
  deleteHealthPlace,
  type HealthPlaceInput,
  type PlaceType,
} from '../queries/health-places';

export function useHealthPlaces(type: PlaceType, opts?: { includeInactive?: boolean }) {
  const client = useHubPatientsClient();
  const includeInactive = opts?.includeInactive ?? false;
  return useQuery({
    queryKey: queryKeys.healthPlaces(type, includeInactive),
    queryFn: () => listHealthPlaces(client, type, { includeInactive }),
  });
}

export function useCreateHealthPlace() {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HealthPlaceInput) => createHealthPlace(client, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-places'] }),
  });
}

export function useUpdateHealthPlace() {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<HealthPlaceInput> }) =>
      updateHealthPlace(client, id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-places'] }),
  });
}

export function useDeleteHealthPlace() {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHealthPlace(client, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-places'] }),
  });
}
