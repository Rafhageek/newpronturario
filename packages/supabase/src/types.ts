import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@vidalog/core';

/**
 * Client Supabase tipado com o schema do VidaLog. Usado por todas as queries.
 * Baseado no tipo nativo do supabase-js (`Database` inclui `__InternalSupabase`,
 * necessário para a inferência de insert/update). Os clients criados via
 * `@supabase/ssr` têm o mesmo runtime e são compatibilizados por cast.
 */
export type VidaLogClient = SupabaseClient<Database>;
