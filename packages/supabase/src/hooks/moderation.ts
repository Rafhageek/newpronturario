'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  addStrike,
  hidePost,
  listFlagged,
  listModerationActions,
  listReports,
  moveTopic,
  setLocked,
  setPinned,
  unhidePost,
} from '../queries/moderation';

/** Fila de denúncias (staff-only). */
export function useReports() {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.reports(),
    queryFn: () => listReports(client),
  });
}

/** Tópicos sinalizados para revisão (staff-only). */
export function useFlagged() {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.flagged(),
    queryFn: () => listFlagged(client),
  });
}

/** Histórico de ações de moderação (staff-only). */
export function useModerationActions() {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.moderationActions(),
    queryFn: () => listModerationActions(client),
  });
}

/**
 * Mutations de moderação. Cada uma invalida as listas do painel para refletir
 * o novo estado (item oculto sai da fila, ação aparece no histórico).
 */
export function useModerationMutations() {
  const client = useHubPatientsClient();
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.reports() });
    void qc.invalidateQueries({ queryKey: queryKeys.flagged() });
    void qc.invalidateQueries({ queryKey: queryKeys.moderationActions() });
  };

  const hide = useMutation({
    mutationFn: (vars: { postId: string; reason: string }) =>
      hidePost(client, vars.postId, vars.reason),
    onSuccess: invalidate,
  });
  const unhide = useMutation({
    mutationFn: (postId: string) => unhidePost(client, postId),
    onSuccess: invalidate,
  });
  const pin = useMutation({
    mutationFn: (vars: { postId: string; pinned: boolean }) =>
      setPinned(client, vars.postId, vars.pinned),
    onSuccess: invalidate,
  });
  const lock = useMutation({
    mutationFn: (vars: { postId: string; locked: boolean }) =>
      setLocked(client, vars.postId, vars.locked),
    onSuccess: invalidate,
  });
  const move = useMutation({
    mutationFn: (vars: { postId: string; categoryId: string }) =>
      moveTopic(client, vars.postId, vars.categoryId),
    onSuccess: invalidate,
  });
  const strike = useMutation({
    mutationFn: (vars: { userId: string; reason: string; postId?: string }) =>
      addStrike(client, vars.userId, vars.reason, vars.postId),
    onSuccess: invalidate,
  });

  return { hide, unhide, pin, lock, move, strike };
}
