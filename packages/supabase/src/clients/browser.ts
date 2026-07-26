import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@hubpatients/core';

/**
 * Client para componentes de navegador (Next.js client components).
 * Usa a anon key — RLS faz a autorização. NUNCA passe a service role aqui.
 *
 * O cast normaliza a divergência de aridade de generics entre @supabase/ssr
 * (3 generics) e @supabase/supabase-js (5 generics); o runtime é idêntico.
 */
export function createSupabaseBrowserClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
): SupabaseClient<Database> {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey) as unknown as SupabaseClient<Database>;
}
