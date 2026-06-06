import type { DrugInteraction } from '@vidalog/core';
import type { VidaLogClient } from '../types';

/** Base de interações medicamentosas (dado de referência). */
export async function getAllInteractions(client: VidaLogClient): Promise<DrugInteraction[]> {
  const { data, error } = await client.from('drug_interactions').select('*');
  if (error) throw error;
  return data ?? [];
}
