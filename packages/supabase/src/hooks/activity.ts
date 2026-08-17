'use client';

import type { ActivitySessionInput, ActivitySessionUpdateInput } from '@hubpatients/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createActivitySession,
  deleteActivitySession,
  listActivitySessions,
  listActivitySessionsSince,
  updateActivitySession,
} from '../queries/activity';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';

/**
 * Hooks da tela de Atividade física (/atividade-fisica).
 *
 * `enabled: Boolean(patientId)` é o de sempre, e é o que faz a tela precisar de
 * `estadoSecao` para se expressar: com a consulta desligada, `isLoading` e
 * `isError` são AMBOS `false`, e uma lista `undefined` não autoriza escrever
 * "nenhuma atividade registrada". Quem monta a tela deve passar
 * `sujeitoConhecido: Boolean(patientId)` para `estadoSecao` — ver o painel em
 * `apps/web/src/app/(app)/dashboard/page.tsx` (linhas ~213-262).
 *
 * Erro NÃO é silenciado em lugar nenhum aqui. Se a tabela da 0050 ainda não
 * existir, a consulta falha e a tela pergunta a
 * `isActivityModuleUnavailable(query.error)` se o caso é "recurso ainda não
 * liberado" — em vez de mostrar uma lista vazia que mentiria.
 */
export function useActivitySessions(patientId: string | undefined, limit = 200) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.activitySessions(patientId ?? ''),
    queryFn: () => listActivitySessions(client, patientId as string, limit),
    enabled: Boolean(patientId),
  });
}

/**
 * Janela de tempo para o total factual da semana. O texto ("120 minutos
 * registrados nesta semana") sai de `resumoSemanaAtividade`, em
 * `@hubpatients/core` — nenhuma conta de exibição mora no hook.
 */
export function useActivitySessionsSince(patientId: string | undefined, sinceIso: string) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.activitySessionsSince(patientId ?? '', sinceIso),
    queryFn: () => listActivitySessionsSince(client, patientId as string, sinceIso),
    enabled: Boolean(patientId) && Boolean(sinceIso),
  });
}

/**
 * As três escritas num objeto só, para a tela não precisar de três imports.
 *
 * Cada uma é um `UseMutationResult` completo do React Query — quem chama usa
 * `criar.mutate(...)`, `criar.isPending`, `criar.error`, como em qualquer outra
 * mutação do app.
 */
export function useActivityMutations(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: queryKeys.activitySessions(patientId) });
    qc.invalidateQueries({ queryKey: ['activity-sessions-since', patientId] });
  };

  const criar = useMutation({
    mutationFn: (input: ActivitySessionInput) => createActivitySession(client, patientId, input),
    onSuccess: invalidar,
  });

  const atualizar = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ActivitySessionUpdateInput }) =>
      updateActivitySession(client, id, input),
    onSuccess: invalidar,
  });

  const excluir = useMutation({
    mutationFn: (id: string) => deleteActivitySession(client, id),
    onSuccess: invalidar,
  });

  return { criar, atualizar, excluir };
}
