'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import {
  recordDoseEvent,
  recordDoseEvents,
  listDoseEvents,
  getDoseAdherence,
  type DoseEventFilter,
  type DoseEventInput,
} from '../queries/doses';

/**
 * Hooks de eventos de dose (adesão terapêutica). Owner-only: sempre o
 * usuário LOGADO (`ownId`), nunca um perfil dependente — a RLS da 0040 é
 * `user_id = auth.uid()`.
 */

/** Eventos de dose do período (padrão: últimos 30 dias). */
export function useDoseEvents(userId: string | undefined, filter: DoseEventFilter = {}) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: [
      'dose-events',
      userId ?? '',
      filter.since ?? '30d',
      filter.medicationId ?? 'all',
    ],
    queryFn: () => listDoseEvents(client, userId as string, filter),
    enabled: Boolean(userId),
  });
}

/** Agregado de adesão do período (contagens + eventos crus). */
export function useDoseAdherence(
  userId: string | undefined,
  days = 30,
  medicationId?: string,
) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: ['dose-adherence', userId ?? '', days, medicationId ?? 'all'],
    queryFn: () => getDoseAdherence(client, userId as string, days, medicationId),
    enabled: Boolean(userId),
  });
}

/** Registra um evento de dose (idempotente pela chave da migração 0040). */
export function useRecordDoseEvent(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DoseEventInput) => recordDoseEvent(client, userId as string, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dose-events', userId ?? ''] });
      void qc.invalidateQueries({ queryKey: ['dose-adherence', userId ?? ''] });
    },
  });
}

/** Envia um lote de eventos (esvaziar a fila offline quando a rede volta). */
export function useRecordDoseEvents(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inputs: DoseEventInput[]) => recordDoseEvents(client, userId as string, inputs),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dose-events', userId ?? ''] });
      void qc.invalidateQueries({ queryKey: ['dose-adherence', userId ?? ''] });
    },
  });
}
