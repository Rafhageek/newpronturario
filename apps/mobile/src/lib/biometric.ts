import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Desbloqueio por biometria (Face ID / Touch ID / digital). NÃO substitui o
 * login: a sessão do Supabase já fica no SecureStore; a biometria apenas
 * destrava o acesso a ela na abertura do app (e ao voltar do segundo plano).
 * Quem não tiver biometria cadastrada cai no PIN do aparelho (fallback do SO)
 * ou em "Entrar com senha" (sai e refaz o login).
 */

const KEY = 'hubpatients.biometric';

/** Hardware presente E ao menos uma biometria cadastrada no aparelho. */
export async function isBiometricSupported(): Promise<boolean> {
  try {
    const [hw, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hw && enrolled;
  } catch {
    return false;
  }
}

/** Rótulo amigável conforme o tipo disponível (Face ID, digital, etc.). */
export async function getBiometricLabel(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Reconhecimento facial';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Impressão digital';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Íris';
  } catch {
    // ignore
  }
  return 'Biometria';
}

/** Dispara o prompt do SO. Retorna true se autenticou. */
export async function authenticateBiometric(promptMessage = 'Desbloqueie o HubPatients'): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancelar',
      // Permite o PIN/senha do aparelho como alternativa (acessível p/ idosos).
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}

export async function loadBiometricPref(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setBiometricPref(on: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, on ? '1' : '0');
  } catch {
    // preferência não-crítica
  }
}
