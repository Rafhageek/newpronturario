'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import {
  logBodyComposition,
  listBodyComposition,
  logBodyMeasurement,
  listBodyMeasurements,
  type BodyCompositionInput,
  type BodyMeasurementInput,
} from '../queries/body';

/** Histórico de composição corporal (mais recente primeiro). */
export function useBodyComposition(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: ['body-composition', userId ?? ''],
    queryFn: () => listBodyComposition(client, userId as string),
    enabled: Boolean(userId),
  });
}

/** Registra uma medição de composição corporal. */
export function useLogBodyComposition(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BodyCompositionInput) => logBodyComposition(client, userId as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['body-composition', userId ?? ''] }),
  });
}

/** Histórico de circunferências (mais recente primeiro). */
export function useBodyMeasurements(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: ['body-measurements', userId ?? ''],
    queryFn: () => listBodyMeasurements(client, userId as string),
    enabled: Boolean(userId),
  });
}

/** Registra uma medição de circunferências. */
export function useLogBodyMeasurement(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BodyMeasurementInput) => logBodyMeasurement(client, userId as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['body-measurements', userId ?? ''] }),
  });
}
