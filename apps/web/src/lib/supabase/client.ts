'use client';

import { createSupabaseBrowserClient } from '@vidalog/supabase/clients/browser';
import { getSupabaseEnv } from '../env';

/** Client de navegador (singleton por aba). */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseBrowserClient(url, anonKey);
}
