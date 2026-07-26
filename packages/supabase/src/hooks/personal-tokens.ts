'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  listMyTokens,
  createToken,
  revokeToken,
  hasAiAssistant,
  type NewAccessToken,
} from '../queries/personal-tokens';

export function useMyTokens(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.personalTokens(userId ?? ''),
    queryFn: () => listMyTokens(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useCreateToken(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewAccessToken) => createToken(client, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.personalTokens(userId) }),
  });
}

export function useRevokeToken(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeToken(client, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.personalTokens(userId) }),
  });
}

/** Elegibilidade do assistente de IA (Plus OU consentimento de compartilhamento). */
export function useHasAiAssistant(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.hasAiAssistant(userId ?? ''),
    queryFn: () => hasAiAssistant(client),
    enabled: Boolean(userId),
  });
}
