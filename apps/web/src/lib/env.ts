/**
 * Lê as variáveis públicas do Supabase.
 *
 * Se faltarem, NÃO quebra a aplicação: usa placeholders e avisa no console.
 * Isso permite visualizar a UI antes de configurar o backend. O login/cadastro
 * só funcionam de verdade após preencher apps/web/.env.local (veja .env.example).
 */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

let warned = false;

export function getSupabaseEnv(): { url: string; anonKey: string; configured: boolean } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Fail-closed em produção: um deploy mal configurado deve quebrar alto,
    // nunca rodar com placeholders (evita servir o app sem backend/auth).
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Configuração ausente: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      );
    }
    if (!warned) {
      warned = true;
      console.warn(
        '[HubPatients] Supabase não configurado (dev). Defina NEXT_PUBLIC_SUPABASE_URL e ' +
          'NEXT_PUBLIC_SUPABASE_ANON_KEY em apps/web/.env.local para habilitar login e dados.',
      );
    }
    return { url: PLACEHOLDER_URL, anonKey: PLACEHOLDER_KEY, configured: false };
  }

  return { url, anonKey, configured: true };
}
