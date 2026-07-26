import type { NotificationQueueItem, NotificationDraft } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

/**
 * Notificações do usuário (low-stock, lembretes, etc.) gravadas em
 * `notification_queue`. RLS garante `user_id = auth.uid()`, então listamos
 * apenas as do próprio usuário autenticado.
 */
export async function listNotifications(
  client: HubPatientsClient,
  userId: string,
  limit = 20,
): Promise<NotificationQueueItem[]> {
  const { data, error } = await client
    .from('notification_queue')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Marca uma notificação como lida (carimba `read_at`). */
export async function markNotificationRead(
  client: HubPatientsClient,
  id: string,
  readAt: string,
): Promise<void> {
  const { error } = await client
    .from('notification_queue')
    .update({ read_at: readAt })
    .eq('id', id);
  if (error) throw error;
}

/** Marca todas as não lidas do usuário como lidas. */
export async function markAllNotificationsRead(
  client: HubPatientsClient,
  userId: string,
  readAt: string,
): Promise<void> {
  const { error } = await client
    .from('notification_queue')
    .update({ read_at: readAt })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

/**
 * Cria uma notificação in-app para o usuário atual (alimenta o feed do sino).
 * Best-effort: descobre o uid pela sessão local e NUNCA lança — o feed é
 * secundário à ação principal, então uma falha aqui não quebra o fluxo.
 */
export async function enqueueNotification(
  client: HubPatientsClient,
  draft: NotificationDraft,
): Promise<void> {
  try {
    const { data } = await client.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return;
    await client.from('notification_queue').insert({
      user_id: uid,
      type: draft.type,
      title: draft.title,
      body: draft.body,
      channel: 'in_app',
      resource_type: draft.resourceType ?? null,
      resource_id: draft.resourceId ?? null,
    });
  } catch {
    // silencioso — best-effort
  }
}
