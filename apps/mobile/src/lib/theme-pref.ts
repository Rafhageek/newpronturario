import * as SecureStore from 'expo-secure-store';
import { colorScheme } from 'nativewind';

/**
 * Preferência de tema do app: 'system' (segue o aparelho), 'light' ou 'dark'.
 * Aplica via nativewind colorScheme.set() e persiste no SecureStore (já é dep).
 */
export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'hubpatients.theme';

export function applyThemePref(pref: ThemePref): void {
  colorScheme.set(pref);
}

export async function loadThemePref(): Promise<ThemePref> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignore — cai no padrão
  }
  return 'system';
}

export async function saveThemePref(pref: ThemePref): Promise<void> {
  applyThemePref(pref);
  try {
    await SecureStore.setItemAsync(KEY, pref);
  } catch {
    // preferência é não-crítica; ignora falha de escrita
  }
}
