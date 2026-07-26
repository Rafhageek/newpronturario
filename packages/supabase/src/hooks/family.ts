'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CareRelationshipKind, CaregiverInviteRole, Json } from '@hubpatients/core';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  listRelationships,
  listAccessibleProfiles,
  createInvite,
  listSentInvites,
  listInvitesForMe,
  acceptInvite,
  revokeRelationship,
  updateRelationshipPermissions,
} from '../queries/family';

export function useRelationships(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.relationships(userId ?? ''),
    queryFn: () => listRelationships(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useAccessibleProfiles(userId: string | undefined, selfName: string) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.accessibleProfiles(userId ?? ''),
    queryFn: () => listAccessibleProfiles(client, userId as string, selfName),
    enabled: Boolean(userId),
  });
}

export function useSentInvites(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.sentInvites(userId ?? ''),
    queryFn: () => listSentInvites(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useInvitesForMe(enabled: boolean) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.invitesForMe(),
    queryFn: () => listInvitesForMe(client),
    enabled,
  });
}

export function useFamilyMutations(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.relationships(userId) });
    qc.invalidateQueries({ queryKey: queryKeys.sentInvites(userId) });
    qc.invalidateQueries({ queryKey: queryKeys.accessibleProfiles(userId) });
    qc.invalidateQueries({ queryKey: queryKeys.invitesForMe() });
  };
  return {
    invite: useMutation({
      mutationFn: (args: {
        inviterName: string;
        email: string;
        role: CaregiverInviteRole;
        kind: CareRelationshipKind;
        permissions: Json;
      }) => createInvite(client, { inviterId: userId, ...args }),
      onSuccess: invalidate,
    }),
    accept: useMutation({ mutationFn: (token: string) => acceptInvite(client, token), onSuccess: invalidate }),
    revoke: useMutation({ mutationFn: (id: string) => revokeRelationship(client, id), onSuccess: invalidate }),
    updatePermissions: useMutation({
      mutationFn: ({ id, permissions }: { id: string; permissions: Json }) =>
        updateRelationshipPermissions(client, id, permissions),
      onSuccess: invalidate,
    }),
  };
}
