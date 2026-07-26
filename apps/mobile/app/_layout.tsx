import 'react-native-url-polyfill/auto';
import '../global.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, LogBox, PanResponder, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenCapture from 'expo-screen-capture';
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
// Atkinson Hyperlegible — desenhada pelo Braille Institute para baixa visão.
// Distingue explicitamente 1/I/l e 0/O: em dose de medicamento isso é
// SEGURANÇA, não estética. A Mono garante largura fixa nos valores clínicos.
import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_500Medium,
  AtkinsonHyperlegibleNext_600SemiBold,
  AtkinsonHyperlegibleNext_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import {
  AtkinsonHyperlegibleMono_500Medium,
  AtkinsonHyperlegibleMono_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible-mono';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { useColorScheme } from 'nativewind';
import { HubPatientsClientProvider } from '@hubpatients/supabase';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ActiveProfileProvider } from '@/lib/active-profile';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/theme';
import { loadThemePref, applyThemePref } from '@/lib/theme-pref';
import { loadBiometricPref, isBiometricSupported } from '@/lib/biometric';
import { configureNotificationHandler } from '@/lib/notifications';
import { WelcomeOverlay } from '@/components/welcome-overlay';
import { LockScreen } from '@/components/lock-screen';
import { ErrorFallback } from '@/components/error-fallback';
import { ToastHost } from '@/components/toast';
import { CelebrationHost } from '@/components/celebration';
import { OfflineBanner } from '@/components/offline-banner';

// Avisos esperados só no Expo Go (push remoto saiu do Expo Go no SDK 53) — não
// são bugs e somem no APK/dev build. Silenciados p/ não poluir a tela em teste.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'No "projectId" found',
]);

// React Query sabe quando há rede (refetch automático ao reconectar).
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))),
);

/** Fallback global do expo-router: um erro de render mostra tela amigável (não branca). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorFallback error={error} retry={retry} />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados de saúde mudam devagar: cache mais longo deixa a navegação fluida.
      staleTime: 2 * 60_000,
      gcTime: 10 * 60_000,
      // Repete falhas de rede/5xx com backoff; NÃO repete 4xx (erro do cliente/RLS).
      retry: (failureCount, error) => {
        const status = (error as { status?: number; code?: number } | null)?.status;
        if (typeof status === 'number' && status >= 400 && status < 500) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
    },
    mutations: { retry: 0 },
  },
});

const INACTIVITY_MS = 5 * 60_000; // 5 min sem toque → re-trava (quando a biometria está ligada)

function RootNavigator() {
  const { session, loading, mfaLoading, mfaRequired, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colors = useColors();
  const [welcome, setWelcome] = useState(false);
  const prevUid = useRef<string | null | undefined>(undefined);
  const inAuthGroup = segments[0] === '(auth)';
  const authRoute = segments[1] as string | undefined;
  const inPasswordRecovery = inAuthGroup && authRoute === 'redefinir-senha';
  const inMfaChallenge = inAuthGroup && authRoute === 'mfa';

  // ── Bloqueio por biometria (Face ID / digital) ──────────────────────────
  const [bioOn, setBioOn] = useState<boolean | null>(null); // null = ainda checando
  const [locked, setLocked] = useState(false);
  const lockEvaluated = useRef(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const [pref, supported] = await Promise.all([loadBiometricPref(), isBiometricSupported()]);
      if (mounted) setBioOn(pref && supported);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Trava na abertura (cold start) se há sessão e biometria ligada.
  useEffect(() => {
    if (loading || bioOn === null || lockEvaluated.current) return;
    lockEvaluated.current = true;
    if (session && bioOn) setLocked(true);
  }, [loading, bioOn, session]);

  // Re-trava ao voltar do segundo plano (privacidade do prontuário).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev === 'background' && next === 'active' && bioOn && session) setLocked(true);
    });
    return () => sub.remove();
  }, [bioOn, session]);

  // ── Timeout por inatividade — re-trava após X min sem toque (só se a biometria
  // está ligada; reusa o LockScreen). Evita prontuário aberto em aparelho esquecido.
  const bioOnRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const lockedRef = useRef(false);
  bioOnRef.current = bioOn === true;
  sessionActiveRef.current = !!session;
  lockedRef.current = locked;
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpActivity = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (bioOnRef.current && sessionActiveRef.current && !lockedRef.current) {
      inactivityTimer.current = setTimeout(() => setLocked(true), INACTIVITY_MS);
    }
  }, []);
  useEffect(() => {
    bumpActivity();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [bumpActivity, bioOn, session, locked]);
  const inactivityResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        bumpActivity();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        bumpActivity();
        return false;
      },
    }),
  ).current;

  // Configura o handler de notificações locais uma vez.
  useEffect(() => {
    void configureNotificationHandler();
  }, []);

  // LGPD: bloqueia print/gravação em TODO o app autenticado (Android: FLAG_SECURE
  // — também oculta no app switcher). Cobre Home, Configurações (segredo 2FA),
  // medicamentos etc. de uma vez, sem depender de guard tela-a-tela.
  useEffect(() => {
    if (!session) return;
    void ScreenCapture.preventScreenCaptureAsync('hubpatients.auth').catch(() => undefined);
    return () => {
      void ScreenCapture.allowScreenCaptureAsync('hubpatients.auth').catch(() => undefined);
    };
  }, [session]);

  useEffect(() => {
    if (loading || mfaLoading) return;
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && mfaRequired && !inPasswordRecovery && !inMfaChallenge) {
      router.replace('/(auth)/mfa' as never);
    } else if (session && !mfaRequired && inAuthGroup && !inPasswordRecovery) {
      router.replace('/(tabs)');
    }
  }, [inAuthGroup, inMfaChallenge, inPasswordRecovery, loading, mfaLoading, mfaRequired, router, session]);

  // Splash de boas-vindas só na transição de login (não na restauração de sessão ao abrir).
  useEffect(() => {
    if (loading) return;
    const uid = session?.user?.id ?? null;
    if (prevUid.current === undefined) {
      prevUid.current = uid;
      return;
    }
    if (prevUid.current === null && uid != null) {
      setWelcome(true);
      const t = setTimeout(() => setWelcome(false), 2000);
      prevUid.current = uid;
      return () => clearTimeout(t);
    }
    prevUid.current = uid;
  }, [session, loading]);

  // Splash enquanto restaura a sessão — evita flash de tela errada.
  // Também segura a renderização até DECIDIR o bloqueio biométrico: com sessão e
  // biometria, não pinta as telas (PHI) antes do lock cobrir — fecha o flash do
  // dashboard no cold start (bioOn===null = ainda checando; bioOn && !locked &&
  // ainda não avaliado = lock prestes a ativar).
  const lockUndecided =
    session != null && (bioOn === null || (bioOn === true && !locked && !lockEvaluated.current));
  // Enquanto redireciona uma sessão AAL1 para o challenge, não monta nenhuma tab
  // com PHI nem por um único frame.
  const routingToMfa = Boolean(session && mfaRequired && !inPasswordRecovery && !inMfaChallenge);
  if (loading || mfaLoading || lockUndecided || routingToMfa) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} {...inactivityResponder.panHandlers}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <ToastHost />
      <CelebrationHost />
      <OfflineBanner />
      {welcome ? <WelcomeOverlay /> : null}
      {session && locked ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 10000 }]}>
          <LockScreen
            onUnlock={() => setLocked(false)}
            onUsePassword={() => {
              setLocked(false);
              void signOut();
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Inter fica carregada nesta versão como rede de segurança: se sobrou algum
    // `fontFamily: 'Inter_...'` hardcoded fora do theme, ele não vira quadrado
    // preto. Remover num release seguinte, após um grep limpo por "Inter_".
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_500Medium,
    AtkinsonHyperlegibleNext_600SemiBold,
    AtkinsonHyperlegibleNext_700Bold,
    AtkinsonHyperlegibleMono_500Medium,
    AtkinsonHyperlegibleMono_700Bold,
  });
  const { colorScheme } = useColorScheme();
  const colors = useColors();

  // Aplica a preferência de tema salva (claro/escuro/sistema) ao abrir.
  useEffect(() => {
    void loadThemePref().then(applyThemePref);
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <HubPatientsClientProvider client={supabase}>
            <AuthProvider>
              <ActiveProfileProvider>
                <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                <RootNavigator />
              </ActiveProfileProvider>
            </AuthProvider>
          </HubPatientsClientProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
