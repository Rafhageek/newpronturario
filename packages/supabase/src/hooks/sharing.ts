'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  listAccessTokens,
  issueAccessToken,
  revokeAccessToken,
  type IssueAccessTokenInput,
  type IssuedAccess,
} from '../queries/sharing';

/** Chave local — `keys.ts` é compartilhado e não foi tocado nesta rodada. */
const sharingKey = (userId: string) => ['sharing-access-tokens', userId] as const;

/** Acessos do Modo Consulta (ativos e passados), mais recentes primeiro. */
export function useAccessTokens(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: sharingKey(userId ?? ''),
    queryFn: () => listAccessTokens(client, userId as string),
    enabled: Boolean(userId),
    // A contagem regressiva é local; ainda assim, dados de acesso não devem
    // envelhecer muito na tela.
    staleTime: 30_000,
  });
}

/**
 * Emite um acesso temporário. O segredo volta APENAS nesta resposta —
 * guarde-o em estado local e mostre uma única vez.
 */
export function useIssueAccessToken(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation<IssuedAccess, Error, IssueAccessTokenInput>({
    mutationFn: (input: IssueAccessTokenInput) => issueAccessToken(client, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sharingKey(userId ?? '') });
      // Mesma tabela da tela de acesso de IA.
      void qc.invalidateQueries({ queryKey: queryKeys.personalTokens(userId ?? '') });
    },
  });
}

/** Encerra um acesso imediatamente (grava `revoked_at` no banco). */
export function useRevokeAccessToken(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => revokeAccessToken(client, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sharingKey(userId ?? '') });
      void qc.invalidateQueries({ queryKey: queryKeys.personalTokens(userId ?? '') });
    },
  });
}
