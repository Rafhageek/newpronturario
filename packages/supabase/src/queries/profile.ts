import type { Profile, UpdateRow } from '@vidalog/core';
import type { VidaLogClient } from '../types';

export async function getProfile(client: VidaLogClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  client: VidaLogClient,
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
