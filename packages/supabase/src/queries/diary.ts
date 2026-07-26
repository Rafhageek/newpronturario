import type { DiaryEntry, InsertRow } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

export async function listDiaryEntries(
  client: HubPatientsClient,
  patientId: string,
  limit = 30,
): Promise<DiaryEntry[]> {
  const { data, error } = await client
    .from('diary_entries')
    .select('*')
    .eq('patient_id', patientId)
    .order('entry_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function createDiaryEntry(
  client: HubPatientsClient,
  entry: InsertRow<'diary_entries'>,
): Promise<DiaryEntry> {
  const { data, error } = await client
    .from('diary_entries')
    .insert(entry)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
