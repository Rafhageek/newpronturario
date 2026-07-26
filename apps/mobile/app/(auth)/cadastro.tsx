import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Eye, EyeOff, HeartPulse, UserPlus, Apple } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { signupSchema, DISCLAIMERS } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Button, Input } from '@/components/ui';
import { toast } from '@/components/toast';
import { fonts, gradients, useColors } from '@/theme';

const APPLE_SOON = 'Cadastro com Apple chega em breve — estamos implementando! 🍎';

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

/** Botão "Cadastrar com Apple" — preto (diretrizes da Apple) com selo "em breve". */
function AppleButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Cadastrar com Apple — em breve"
      style={{ minHeight: 50, backgroundColor: '#000000' }}
      className="flex-row items-center justify-center gap-2 rounded-2xl px-4 active:opacity-80"
    >
      <Apple size={18} color="#ffffff" fill="#ffffff" />
      <Text style={{ fontFamily: fonts.semibold, color: '#ffffff' }} className="text-[15px]">
        Cadastrar com Apple
      </Text>
      <View className="rounded-full bg-white/20 px-2 py-0.5">
        <Text style={{ fontFamily: fonts.semibold, color: '#ffffff' }} className="text-[10px]">
          em breve
        </Text>
      </View>
    </Pressable>
  );
}

export default function CadastroScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { signUp, signInWithGoogle, oauthError, clearOauthError } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    const parsed = signupSchema.safeParse({ fullName, email, password, confirmPassword, acceptedTerms });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    setLoading(true);
    const { error: signUpError } = await signUp(fullName, email, password);
    setLoading(false);
    if (signUpError) setError(signUpError);
  }

  async function onGoogle() {
    setError(null);
    clearOauthError();
    const { error: gErr } = await signInWithGoogle();
    if (gErr) setError(gErr);
  }


  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 36,
            paddingBottom: 48,
            alignItems: 'center',
            borderBottomLeftRadius: 40,
            borderBottomRightRadius: 40,
            borderCurve: 'continuous',
          }}
        >
          <Animated.View
            entering={FadeIn.duration(500)}
            style={{
              height: 72,
              width: 72,
              borderRadius: 24,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.16)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.3)',
            }}
          >
            <HeartPulse size={34} color="#ffffff" />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.delay(120).springify().damping(16)}
            style={{ fontFamily: fonts.displayX, fontSize: 26, color: '#fff', marginTop: 16 }}
          >
            Criar conta
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(220).springify().damping(16)}
            style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}
          >
            Comece a cuidar da sua saúde hoje
          </Animated.Text>
        </LinearGradient>

        <Animated.View entering={FadeInDown.delay(320).springify().damping(18)} style={{ marginTop: -26, marginHorizontal: 20 }}>
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
            <Input
              label="Nome completo"
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              textContentType="name"
              placeholder="Seu nome"
            />
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
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="••••••••"
            />
            <PasswordInput
              label="Confirmar senha"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="••••••••"
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
              accessibilityLabel="Li e aceito os termos de uso e a política de privacidade (LGPD)."
              hitSlop={8}
              onPress={() => setAcceptedTerms((v) => !v)}
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View
                className={acceptedTerms ? 'border-primary bg-primary' : 'border-line bg-surface'}
                style={{
                  height: 24,
                  width: 24,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  borderWidth: 1.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {acceptedTerms ? <Check size={16} color={c.white} strokeWidth={3} /> : null}
              </View>
              <Text
                style={{ fontFamily: fonts.regular }}
                className="flex-1 text-[13px] leading-5 text-muted"
              >
                Li e aceito os termos de uso e a política de privacidade (LGPD).
              </Text>
            </Pressable>
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
            <Button label="Criar conta" icon={UserPlus} loading={loading} onPress={onSubmit} />
            <Button label="Cadastrar com Google" variant="outline" onPress={onGoogle} />
            <AppleButton onPress={() => toast.info(APPLE_SOON)} />
            <Text style={{ fontFamily: fonts.regular }} className="text-center text-[11px] leading-4 text-faint">
              {DISCLAIMERS.dataSharing}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(420)} className="mt-6 items-center">
          <Link href="/(auth)/login" style={{ fontFamily: fonts.semibold }} className="text-[14px] text-primary">
            Já tem conta? Entrar
          </Link>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
