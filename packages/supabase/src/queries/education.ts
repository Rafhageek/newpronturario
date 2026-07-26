import type { HealthContent } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

export async function listHealthContent(client: HubPatientsClient): Promise<HealthContent[]> {
  const { data, error } = await client
    .from('health_content')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listReadingList(client: HubPatientsClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from('reading_list').select('content_id').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.content_id);
}

export async function addToReadingList(client: HubPatientsClient, userId: string, contentId: string): Promise<void> {
  const { error } = await client.from('reading_list').insert({ user_id: userId, content_id: contentId });
  if (error) throw error;
}

export async function removeFromReadingList(client: HubPatientsClient, userId: string, contentId: string): Promise<void> {
  const { error } = await client
    .from('reading_list')
    .delete()
    .eq('user_id', userId)
    .eq('content_id', contentId);
  if (error) throw error;
}
