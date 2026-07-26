'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  getCommunityMember,
  getMyVerification,
  submitProfessionalVerification,
  acceptCommunityRules,
  getPublicForumProfile,
  listCommunityDoctors,
  type ProfessionalVerificationInput,
} from '../queries/community-roles';

/** Badges/tier/reputação públicos de um usuário (qualquer um). */
export function useCommunityMember(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.communityMember(userId ?? ''),
    queryFn: () => getCommunityMember(client, userId as string),
    enabled: Boolean(userId),
  });
}

/** Status do meu pedido de verificação profissional. */
export function useMyVerification(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.myVerification(userId ?? ''),
    queryFn: () => getMyVerification(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useSubmitProfessionalVerification(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfessionalVerificationInput) =>
      submitProfessionalVerification(client, userId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myVerification(userId) }),
  });
}

export function useAcceptCommunityRules(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => acceptCommunityRules(client),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.communityMember(userId) }),
  });
}

/** Perfil público de fórum (badges, reputação, contagens — sem dado clínico). */
export function usePublicForumProfile(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.publicForumProfile(userId ?? ''),
    queryFn: () => getPublicForumProfile(client, userId as string),
    enabled: Boolean(userId),
  });
}

/** Vitrine de médicos verificados que optaram por aparecer publicamente. */
export function useCommunityDoctors() {
  const client = useHubPatientsClient();
  return useQuery({ queryKey: queryKeys.communityDoctors(), queryFn: () => listCommunityDoctors(client) });
}
