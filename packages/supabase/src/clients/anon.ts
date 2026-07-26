import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@hubpatients/core';

/**
 * Client anônimo SEM sessão (sem cookies/storage). Usado em endpoints de servidor
 * que autenticam por token próprio (ex.: /api/v1/me), chamando RPCs SECURITY
 * DEFINER gateadas pelo hash do token. Nunca usa service_role.
 */
export function createSupabaseAnonClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) as unknown as SupabaseClient<Database>;
}
