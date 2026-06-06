import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@vidalog/supabase/clients/server';
import { getSupabaseEnv } from '../env';

/**
 * Client para Server Components / Route Handlers (Next 15 — cookies() é async).
 * RLS faz a autorização; este client usa a anon key.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseServerClient(url, anonKey, {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // Chamado a partir de um Server Component — ignorado: o middleware
        // já cuida de refrescar a sessão.
      }
    },
  });
}
