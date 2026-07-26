import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@hubpatients/core';

/**
 * Client para Server Components / Route Handlers / middleware do Next.js.
 * O adaptador de cookies é injetado pelo app (cookies() do next/headers),
 * mantendo este pacote agnóstico de framework.
 *
 * O cast normaliza a divergência de aridade de generics entre @supabase/ssr
 * e @supabase/supabase-js; o runtime é idêntico.
 */
export function createSupabaseServerClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  cookies: CookieMethodsServer,
): SupabaseClient<Database> {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies,
  }) as unknown as SupabaseClient<Database>;
}
