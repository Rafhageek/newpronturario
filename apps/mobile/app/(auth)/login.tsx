import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { Link, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, LogIn, Apple } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { loginSchema } from '@hubpatients/core';
import { motion } from '@hubpatients/ui-tokens';
import { useAuth } from '@/lib/auth';
import { Button, Input } from '@/components/ui';
import { toast } from '@/components/toast';
import { fonts, gradients, useColors } from '@/theme';
import appIcon from '../../assets/icon.png';

const APPLE_SOON = 'Login com Apple chega em breve — estamos implementando! 🍎';

/** Meio ciclo do pulso do hero (decorativo, não responde a toque). */
const PULSE_MS = 800;

/**
 * Campo de senha com botão de olho — espelha o toggle de mostrar/ocultar da web
 * (Eye/EyeOff). Implementado localmente como wrapper do <Input/> compartilhado
 * (NÃO o edita): sobrepõe um Pressable absoluto à direita e reserva espaço com
 * paddingRight no próprio TextInput. O `style` explícito vence o className do kit.
 */
function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const c = useColors();
  const [show, setShow] = useState(false);
  return (
    <View style={{ position: 'relative' }}>
      <Input {...props} secureTextEntry={!show} style={{ paddingRight: 48 }} />
      <Pressable
        onPress={() => setShow((s) => !s)}
        accessibilityRole="button"
        accessibilityLabel={show ? 'Ocultar senha' : 'Mostrar senha'}
        hitSlop={8}
        style={{
          position: 'absolute',
          right: 4,
          bottom: 0,
          height: 48,
          width: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {show ? <EyeOff size={20} color={c.faint} /> : <Eye size={20} color={c.faint} />}
      </Pressable>
    </View>
  );
}

/** Botão "Continuar com Apple" — preto (diretrizes da Apple) com selo "em breve". */
function AppleButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Continuar com Apple — em breve"
      style={{ minHeight: 50, backgroundColor: '#000000' }}
      className="flex-row items-center justify-center gap-2 rounded-2xl px-4 active:opacity-80"
    >
      <Apple size={18} color="#ffffff" fill="#ffffff" />
      <Text style={{ fontFamily: fonts.semibold, color: '#ffffff' }} className="text-[15px]">
        Continuar com Apple
      </Text>
      <View className="rounded-full bg-white/20 px-2 py-0.5">
        <Text style={{ fontFamily: fonts.semibold, color: '#ffffff' }} className="text-[10px]">
          em breve
        </Text>
      </View>
    </Pressable>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle, oauthError, clearOauthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pulso do ícone no hero. Desligado se o sistema pede "reduzir movimento" e,
  // mesmo quando ligado, limitado a LOOP_LIMIT ciclos: WCAG SC 2.2.2 proíbe
  // loop indefinido ao lado de conteúdo — e aqui o conteúdo é o formulário de
  // login. Cada ciclo vai a 1,1 e volta a 1, então o repouso é sempre escala 1.
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withSequence(withTiming(1.1, { duration: PULSE_MS }), withTiming(1, { duration: PULSE_MS })),
      motion.LOOP_LIMIT,
      false,
    );
  }, [pulse, reduceMotion]);
  const pulseStyle = useAnimatedStyle(() => ({
    // "reduzir movimento" = sem deslocamento: a escala fica travada em 1.
    transform: [{ scale: reduceMotion ? 1 : pulse.value }],
  }));

  async function onGoogle() {
    setError(null);
    clearOauthError();
    const { error: gErr } = await signInWithGoogle();
    if (gErr) setError(gErr);
  }


  async function onSubmit() {
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    setLoading(false);
    if (signInError) setError(signInError);
  }

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero em gradiente */}
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 44,
            paddingBottom: 56,
            alignItems: 'center',
            borderBottomLeftRadius: 40,
            borderBottomRightRadius: 40,
            borderCurve: 'continuous',
          }}
        >
          <Animated.View
            entering={FadeIn.duration(500)}
            style={[
              pulseStyle,
              {
                height: 84,
                width: 84,
                borderRadius: 26,
                borderCurve: 'continuous',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                shadowColor: '#000000',
                shadowOpacity: 0.2,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
              },
            ]}
          >
            <Image source={appIcon} style={{ height: 84, width: 84, borderRadius: 26 }} resizeMode="contain" />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.delay(120).springify().damping(16)}
            style={{ fontFamily: fonts.displayX, fontSize: 32, color: '#fff', marginTop: 18, letterSpacing: 0.5 }}
          >
            HubPatients
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(240).springify().damping(16)}
            style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}
          >
            Sua saúde, seu controle, seus dados
          </Animated.Text>
        </LinearGradient>

        {/* Card de login (sobrepõe o gradiente) */}
        <Animated.View
          entering={FadeInDown.delay(320).springify().damping(18)}
          style={{ marginTop: -26, marginHorizontal: 20 }}
        >
          <View
            style={{
              borderRadius: 28,
              borderCurve: 'continuous',
              shadowColor: '#1b1a18',
              shadowOpacity: 0.1,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 10 },
              elevation: 4,
            }}
            className="gap-4 border border-line bg-surface p-5"
          >
            <Text style={{ fontFamily: fonts.display }} className="text-[19px] text-fg">
              Bem-vindo de volta
            </Text>
            <Input
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="voce@email.com"
            />
            <PasswordInput
              label="Senha"
              value={password}
              onChangeText={setPassword}
              autoComplete="current-password"
              textContentType="password"
              placeholder="••••••••"
            />
            <Link
              href={'/(auth)/recuperar-senha' as Href}
              style={{ fontFamily: fonts.semibold, alignSelf: 'flex-end' }}
              className="text-[13px] text-primary"
            >
              Esqueceu a senha?
            </Link>
            {error || oauthError ? (
              <Text
                accessibilityLiveRegion="assertive"
                accessibilityRole="alert"
                style={{ fontFamily: fonts.regular }}
                className="text-[13px] text-semaphore-alert"
              >
                {error ?? oauthError}
              </Text>
            ) : null}
            <Button label="Entrar" icon={LogIn} loading={loading} onPress={onSubmit} />

            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-line" />
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-faint">
                ou
              </Text>
              <View className="h-px flex-1 bg-line" />
            </View>

            <Button label="Continuar com Google" variant="outline" onPress={onGoogle} />
            <AppleButton onPress={() => toast.info(APPLE_SOON)} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(420)} className="mt-6 items-center">
          <Link href="/(auth)/cadastro" style={{ fontFamily: fonts.semibold }} className="text-[14px] text-primary">
            Não tem conta? Criar conta
          </Link>
          <View className="mt-3 flex-row items-center gap-1.5">
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-faint">
              🔒 Criptografado · Conformidade LGPD
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
