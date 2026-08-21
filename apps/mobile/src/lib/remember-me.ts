import * as SecureStore from 'expo-secure-store';

/**
 * "Lembrar-me" do login por e-mail/senha — guarda a credencial no Keystore
 * (Android) / Keychain (iOS) via SecureStore, criptografado pelo próprio
 * aparelho. NÃO é a sessão (isso o Supabase já persiste sozinho) nem o
 * desbloqueio por biometria (isso é outra preferência, em Configurações →
 * Segurança — tranca o app depois de já logado). Isto aqui só evita digitar
 * de novo se a sessão precisar ser refeita (ex.: token expirou de tanto
 * tempo sem abrir o app, ou o usuário saiu de propósito).
 */

const KEY = 'hubpatients.remember-me';

export type RememberedCredentials = { email: string; password: string };

export async function loadRememberedCredentials(): Promise<RememberedCredentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.email === 'string' && typeof parsed?.password === 'string') {
      return { email: parsed.email, password: parsed.password };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveRememberedCredentials(email: string, password: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify({ email, password }));
  } catch {
    // preferência não-crítica — login continua funcionando sem ela
  }
}

export async function clearRememberedCredentials(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // preferência não-crítica
  }
}
