import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, registerAuthAutoRefresh } from './supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Enquanto verdadeiro, nenhuma tela com PHI deve ser renderizada. */
  mfaLoading: boolean;
  /** Sessão AAL1 com um fator TOTP verificado: exige challenge antes do app. */
  mfaRequired: boolean;
  mfaError: string | null;
  refreshMfaAssurance: () => Promise<void>;
  /** Erro do retorno do OAuth (deep link) — assíncrono, não volta pelo signInWithGoogle. */
  oauthError: string | null;
  clearOauthError: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const refreshMfaAssurance = useCallback(async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setMfaRequired(true);
      setMfaError('Não foi possível confirmar a proteção desta sessão. Tente novamente.');
      setMfaLoading(false);
      return;
    }
    if (!sessionData.session) {
      setMfaRequired(false);
      setMfaError(null);
      setMfaLoading(false);
      return;
    }

    setMfaLoading(true);
    const [factorsResult, assuranceResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    if (factorsResult.error || assuranceResult.error) {
      // Falha fechada: não libera PHI quando não conseguimos comprovar o AAL.
      setMfaRequired(true);
      setMfaError('Não foi possível confirmar a proteção desta sessão. Tente novamente.');
      setMfaLoading(false);
      return;
    }

    const hasVerifiedFactor = Boolean(
      factorsResult.data?.totp.some((factor) => factor.status === 'verified'),
    );
    const currentLevel = assuranceResult.data?.currentLevel;
    setMfaRequired(hasVerifiedFactor && currentLevel !== 'aal2');
    setMfaError(null);
    setMfaLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      // Fecha o gate antes que providers descendentes possam consultar PHI com
      // uma nova sessão cujo nível de garantia ainda não foi comprovado.
      setMfaLoading(Boolean(next));
      setSession(next);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Revalida o AAL a cada nova sessão/token. Até concluir, o navigator não pinta PHI.
  useEffect(() => {
    if (!session) {
      setMfaRequired(false);
      setMfaError(null);
      setMfaLoading(false);
      return;
    }
    void refreshMfaAssurance();
  }, [refreshMfaAssurance, session?.access_token]);

  // Renova o token em foreground; cleanup remove o listener (sem leak em Fast Refresh).
  useEffect(() => registerAuthAutoRefresh(), []);

  // Deep link de retorno do OAuth (hubpatients://auth/callback?code=...) → troca por sessão.
  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!url) return;
      const params = Linking.parse(url).queryParams ?? {};
      // Provedor devolveu erro (ex.: usuário cancelou/negou o consentimento).
      if (typeof params.error === 'string' || typeof params.error_description === 'string') {
        setOauthError('Login com Google cancelado ou negado. Tente novamente.');
        return;
      }
      const code = params.code;
      if (typeof code !== 'string') return;
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setOauthError('Não foi possível concluir o login com Google. Tente novamente.');
      } else {
        setOauthError(null);
      }
    }
    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => void handleUrl(url));
    return () => sub.remove();
  }, []);

  async function signIn(email: string, password: string) {
    setMfaLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMfaLoading(false);
    return { error: error ? 'E-mail ou senha incorretos.' : null };
  }

  async function signUp(fullName: string, email: string, password: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error ? 'Não foi possível criar a conta.' : null };
  }

  // Fluxo OAuth genérico (Google/Apple): abre o navegador do sistema; o retorno
  // chega pelo deep link hubpatients://auth/callback?code=... (tratado no useEffect acima).
  async function signInWithProvider(provider: 'google' | 'apple', label: string) {
    setOauthError(null);
    const redirectTo = Linking.createURL('auth/callback'); // hubpatients://auth/callback
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      return { error: `Não foi possível conectar com o ${label}.` };
    }
    await Linking.openURL(data.url);
    return { error: null };
  }

  const signInWithGoogle = () => signInWithProvider('google', 'Google');
  const signInWithApple = () => signInWithProvider('apple', 'Apple');

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        mfaLoading,
        mfaRequired,
        mfaError,
        refreshMfaAssurance,
        oauthError,
        clearOauthError: () => setOauthError(null),
        signIn,
        signUp,
        signInWithGoogle,
        signInWithApple,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}
