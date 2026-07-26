import type { Profile, UpdateRow } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

export async function getProfile(client: HubPatientsClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client.rpc('get_accessible_profile', { p_profile_id: userId });
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function updateProfile(
  client: HubPatientsClient,
  userId: string,
  patch: UpdateRow<'profiles'>,
): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
