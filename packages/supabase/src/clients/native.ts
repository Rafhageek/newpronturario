import { createClient } from '@supabase/supabase-js';
import type { Database } from '@hubpatients/core';

/**
 * Adaptador de armazenamento (ex.: expo-secure-store). Injetado pelo app mobile
 * para não acoplar este pacote a dependências de React Native.
 */
export interface NativeStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Client para o app Expo. Sessão persistida no storage seguro do dispositivo.
 * `detectSessionInUrl: false` porque RN não tem URL de navegador.
 */
export function createSupabaseNativeClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  storage: NativeStorageAdapter,
) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // PKCE: necessário para o login social via deep link (hubpatients://) no app.
      flowType: 'pkce',
    },
  });
}
