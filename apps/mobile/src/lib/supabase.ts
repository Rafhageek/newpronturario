import { AppState } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { createSupabaseNativeClient, type NativeStorageAdapter } from '@hubpatients/supabase/clients/native';

/**
 * Armazenamento seguro FRAGMENTADO (expo-secure-store).
 *
 * O SecureStore do Android tem limite ~2 KB por valor, mas a sessão do Supabase
 * (access + refresh token + objeto do usuário) costuma passar disso — gravar
 * tudo num valor só falha e o usuário "perde" a sessão ao reabrir o app.
 * Aqui quebramos o valor em pedaços seguros, guardados em `<key>__0..n`, com o
 * total em `<key>__n`. Tokens ficam no keychain/keystore do dispositivo.
 */
const CHUNK = 1800; // margem segura abaixo do limite de 2048 do Android

async function clearChunks(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${key}__n`);
  if (countStr) {
    const n = parseInt(countStr, 10);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}__${i}`);
    await SecureStore.deleteItemAsync(`${key}__n`);
  }
  await SecureStore.deleteItemAsync(key); // legado (valor único antigo)
}

const secureStorage: NativeStorageAdapter = {
  async getItem(key) {
    const countStr = await SecureStore.getItemAsync(`${key}__n`);
    if (!countStr) {
      // compatibilidade: valor gravado antes da fragmentação
      return SecureStore.getItemAsync(key);
    }
    const n = parseInt(countStr, 10);
    let out = '';
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(`${key}__${i}`);
      if (part == null) return null; // pedaço faltando → trata como sem sessão
      out += part;
    }
    return out;
  },
  async setItem(key, value) {
    await clearChunks(key);
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(`${key}__${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${key}__n`, String(n));
  },
  removeItem: (key) => clearChunks(key),
};

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseAnonKey?: string }
  | undefined;

const supabaseUrl = extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Não loga valores — apenas alerta de configuração.
  console.warn(
    'HubPatients: defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY em apps/mobile/.env',
  );
}

export const supabase = createSupabaseNativeClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  secureStorage,
);

/**
 * Renovação de token confiável em RN: o auto-refresh por timer não dispara bem
 * em background. Liga/desliga conforme o app entra/sai do primeiro plano.
 *
 * Registrado dentro de um useEffect com cleanup (ver AuthProvider) para não
 * vazar listeners em Fast Refresh — antes era um addEventListener solto no
 * escopo do módulo, sem como remover.
 */
export function registerAuthAutoRefresh(): () => void {
  // Se o app já está em primeiro plano ao montar, começa a renovar agora.
  if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
  return () => {
    sub.remove();
    supabase.auth.stopAutoRefresh();
  };
}
