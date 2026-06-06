import type {
  CareRelationship,
  CaregiverInvite,
  CaregiverInviteRole,
  CareRelationshipKind,
  Json,
} from '@vidalog/core';
import type { VidaLogClient } from '../types';

export interface RelationshipView {
  relationship: CareRelationship;
  /** 'i_care_for' = sou cuidador da pessoa; 'cares_for_me' = a pessoa cuida de mim. */
  direction: 'i_care_for' | 'cares_for_me';
  other: { id: string; full_name: string };
}

async function profileNames(client: VidaLogClient, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data } = await client.from('profiles').select('id, full_name').in('id', ids);
  (data ?? []).forEach((p) => map.set(p.id, p.full_name));
  return map;
}

export async function listRelationships(
  client: VidaLogClient,
  userId: string,
): Promise<RelationshipView[]> {
  const { data, error } = await client
    .from('care_relationships')
    .select('*')
    .or(`patient_id.eq.${userId},caregiver_id.eq.${userId}`)
    .neq('status', 'revoked');
  if (error) throw error;
  const rels = data ?? [];
  const otherIds = rels.map((r) => (r.caregiver_id === userId ? r.patient_id : r.caregiver_id));
  const names = await profileNames(client, [...new Set(otherIds)]);
  return rels.map((relationship) => {
    const iAmCaregiver = relationship.caregiver_id === userId;
    const otherId = iAmCaregiver ? relationship.patient_id : relationship.caregiver_id;
    return {
      relationship,
      direction: iAmCaregiver ? 'i_care_for' : 'cares_for_me',
      other: { id: otherId, full_name: names.get(otherId) ?? 'Usuário' },
    };
  });
}

/** Perfis que posso visualizar (eu + dependentes onde sou cuidador aceito). */
export async function listAccessibleProfiles(
  client: VidaLogClient,
  userId: string,
  selfName: string,
): Promise<{ id: string; name: string; isSelf: boolean }[]> {
  const { data } = await client
    .from('care_relationships')
    .select('patient_id')
    .eq('caregiver_id', userId)
    .eq('status', 'accepted');
  const ids = (data ?? []).map((r) => r.patient_id);
  const names = await profileNames(client, ids);
  const dependents = ids.map((id) => ({ id, name: names.get(id) ?? 'Dependente', isSelf: false }));
  return [{ id: userId, name: selfName, isSelf: true }, ...dependents];
}

export async function createInvite(
  client: VidaLogClient,
  args: {
    inviterId: string;
    inviterName: string;
    email: string;
    role: CaregiverInviteRole;
    kind: CareRelationshipKind;
    permissions: Json;
  },
): Promise<CaregiverInvite> {
  const token =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const { data, error } = await client
    .from('caregiver_invites')
    .insert({
      inviter_id: args.inviterId,
      inviter_name: args.inviterName,
      invitee_email: args.email,
      role: args.role,
      kind: args.kind,
      permissions: args.permissions,
      token,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listSentInvites(client: VidaLogClient, inviterId: string): Promise<CaregiverInvite[]> {
  const { data, error } = await client
    .from('caregiver_invites')
    .select('*')
    .eq('inviter_id', inviterId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listInvitesForMe(client: VidaLogClient): Promise<CaregiverInvite[]> {
  // RLS restringe ao e-mail do usuário; filtra pendentes não expirados.
  const { data, error } = await client
    .from('caregiver_invites')
    .select('*')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function acceptInvite(client: VidaLogClient, token: string): Promise<void> {
  const { error } = await client.rpc('accept_caregiver_invite', { invite_token: token });
  if (error) throw error;
}

export async function revokeRelationship(client: VidaLogClient, id: string): Promise<void> {
  const { error } = await client
    .from('care_relationships')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateRelationshipPermissions(
  client: VidaLogClient,
  id: string,
  permissions: Json,
): Promise<void> {
  const { error } = await client.from('care_relationships').update({ permissions }).eq('id', id);
  if (error) throw error;
}
