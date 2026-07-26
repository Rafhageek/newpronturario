import type { DiaryPainPoint } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

export interface NewPainPoint {
  bodyRegion: string;
  side?: 'left' | 'right' | 'center';
  intensity: number;
  type?: string;
  notes?: string;
}

/** Pontos de dor de uma entrada do diário. */
export async function listPainPoints(
  client: HubPatientsClient,
  diaryEntryId: string,
): Promise<DiaryPainPoint[]> {
  const { data, error } = await client
    .from('diary_pain_points')
    .select('*')
    .eq('diary_entry_id', diaryEntryId);
  if (error) throw error;
  return data ?? [];
}

/** Histórico de dor do usuário (para heatmap/ranking). */
export async function listPainHistory(
  client: HubPatientsClient,
  userId: string,
  sinceDate?: string,
): Promise<DiaryPainPoint[]> {
  let q = client.from('diary_pain_points').select('*').eq('user_id', userId);
  if (sinceDate) q = q.gte('created_at', sinceDate);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Insere vários pontos de dor de uma vez (vinculados a uma entrada). */
export async function addPainPoints(
  client: HubPatientsClient,
  diaryEntryId: string,
  userId: string,
  points: NewPainPoint[],
): Promise<void> {
  if (points.length === 0) return;
  const rows = points.map((p) => ({
    diary_entry_id: diaryEntryId,
    user_id: userId,
    body_region: p.bodyRegion,
    side: p.side ?? null,
    intensity: p.intensity,
    type: p.type ?? null,
    notes: p.notes ?? null,
  }));
  const { error } = await client.from('diary_pain_points').insert(rows);
  if (error) throw error;
}

export async function deletePainPoint(client: HubPatientsClient, id: string): Promise<void> {
  const { error } = await client.from('diary_pain_points').delete().eq('id', id);
  if (error) throw error;
}
