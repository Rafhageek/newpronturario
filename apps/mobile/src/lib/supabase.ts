import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { createSupabaseNativeClient, type NativeStorageAdapter } from '@vidalog/supabase/clients/native';

/**
 * Adaptador de armazenamento seguro (expo-secure-store) no formato esperado
 * pelo client nativo. Tokens de sessão ficam no keychain/keystore do device.
 */
const secureStorage: NativeStorageAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseAnonKey?: string }
  | undefined;

const supabaseUrl = extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Não loga valores — apenas alerta de configuração.
  console.warn(
    'VidaLog: defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY em apps/mobile/.env',
  );
}

export const supabase = createSupabaseNativeClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  secureStorage,
);
