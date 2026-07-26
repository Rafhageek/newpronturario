import type { ModerationAction, Post, UserReport } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

/**
 * Painel de moderação (staff-only). As listas dependem das policies SELECT de
 * staff de 0024; as ações de escrita passam por RPCs SECURITY DEFINER que se
 * auto-gateiam com is_staff — nunca por UPDATE direto do cliente.
 */

/** Denúncia com o trecho do post denunciado (join leve via PostgREST). */
export interface ReportWithPost extends UserReport {
  post: { id: string; content: string; hidden: boolean; needs_review: boolean } | null;
}

/** Fila de denúncias (mais recentes primeiro). */
export async function listReports(
  client: HubPatientsClient,
  limit = 100,
): Promise<ReportWithPost[]> {
  const { data, error } = await client
    .from('user_reports')
    .select('*, post:posts(id, content, hidden, needs_review)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ReportWithPost[];
}

/**
 * Tópicos sinalizados para revisão (needs_review = true). Consulta a tabela base
 * `posts` (não a view feed_posts, que não expõe needs_review); o staff alcança
 * estes registros pela policy SELECT de staff de 0024.
 */
export async function listFlagged(client: HubPatientsClient, limit = 100): Promise<Post[]> {
  const { data, error } = await client
    .from('posts')
    .select('*')
    .eq('needs_review', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Histórico de ações de moderação (auditoria), mais recentes primeiro. */
export async function listModerationActions(
  client: HubPatientsClient,
  limit = 100,
): Promise<ModerationAction[]> {
  const { data, error } = await client
    .from('moderation_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ── Wrappers RPC (escrita privilegiada via funções SECURITY DEFINER) ──────────

export async function hidePost(
  client: HubPatientsClient,
  postId: string,
  reason: string,
): Promise<void> {
  const { error } = await client.rpc('mod_hide_post', { p_post_id: postId, p_reason: reason });
  if (error) throw error;
}

export async function unhidePost(client: HubPatientsClient, postId: string): Promise<void> {
  const { error } = await client.rpc('mod_unhide_post', { p_post_id: postId });
  if (error) throw error;
}

export async function setPinned(
  client: HubPatientsClient,
  postId: string,
  pinned: boolean,
): Promise<void> {
  const { error } = await client.rpc('mod_set_pinned', { p_post_id: postId, p_pinned: pinned });
  if (error) throw error;
}

export async function setLocked(
  client: HubPatientsClient,
  postId: string,
  locked: boolean,
): Promise<void> {
  const { error } = await client.rpc('mod_set_locked', { p_post_id: postId, p_locked: locked });
  if (error) throw error;
}

export async function moveTopic(
  client: HubPatientsClient,
  postId: string,
  categoryId: string,
): Promise<void> {
  const { error } = await client.rpc('mod_move_topic', {
    p_post_id: postId,
    p_category_id: categoryId,
  });
  if (error) throw error;
}

export async function addStrike(
  client: HubPatientsClient,
  userId: string,
  reason: string,
  postId?: string,
): Promise<void> {
  const { error } = await client.rpc('mod_add_strike', {
    p_user_id: userId,
    p_reason: reason,
    p_post_id: postId ?? null,
  });
  if (error) throw error;
}
