import type { DrugInteraction } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

/** Base de interações medicamentosas (dado de referência). */
export async function getAllInteractions(client: HubPatientsClient): Promise<DrugInteraction[]> {
  const { data, error } = await client.from('drug_interactions').select('*');
  if (error) throw error;
  return data ?? [];
}
