import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { passwordSchema } from '@hubpatients/core';
import { Button, Input } from '@/components/ui';
import { toast } from '@/components/toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fonts, useColors } from '@/theme';

export default function ResetPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { session, loading: authLoading, oauthError } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [waitingForSession, setWaitingForSession] = useState(true);

  useEffect(() => {
    if (session || oauthError || authLoading || typeof code !== 'string') {
      setWaitingForSession(false);
      return;
    }
    const timer = setTimeout(() => setWaitingForSession(false), 8_000);
    return () => clearTimeout(timer);
  }, [authLoading, code, oauthError, session]);

  async function updatePassword() {
    setError(null);
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Escolha uma senha mais segura.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não conferem.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data });
    if (updateError) {
      setSubmitting(false);
      setError('Não foi possível atualizar a senha. Solicite um novo link e tente novamente.');
      return;
    }

    await supabase.auth.signOut({ scope: 'local' });
    toast.success('Senha atualizada. Entre novamente com sua nova senha.');
    router.replace('/(auth)/login');
  }

  const validRecoverySession = Boolean(session && typeof code === 'string');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-bg"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-5 rounded-3xl border border-line bg-surface p-5">
          {authLoading || waitingForSession ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Validando link de recuperação"
              className="items-center gap-3 py-10"
            >
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ fontFamily: fonts.regular }} className="text-[14px] text-muted">
                Validando link seguro…
              </Text>
            </View>
          ) : validRecoverySession ? (
            <>
              <View className="gap-2">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-trust-50">
                  <LockKeyhole size={23} color={colors.primary} accessible={false} />
                </View>
                <Text accessibilityRole="header" style={{ fontFamily: fonts.display }} className="mt-2 text-[24px] text-fg">
                  Crie uma nova senha
                </Text>
                <Text style={{ fontFamily: fonts.regular }} className="text-[14px] leading-6 text-muted">
                  Use pelo menos 8 caracteres, com uma letra e um número.
                </Text>
              </View>
              <Input
                label="Nova senha"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <Input
                label="Confirmar nova senha"
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={() => void updatePassword()}
                error={error ?? undefined}
              />
              <Button label="Atualizar senha" loading={submitting} onPress={() => void updatePassword()} />
            </>
          ) : (
            <View accessibilityRole="alert" accessibilityLiveRegion="assertive" className="gap-4">
              <Text accessibilityRole="header" style={{ fontFamily: fonts.display }} className="text-[24px] text-fg">
                Link inválido ou expirado
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-[14px] leading-6 text-muted">
                Solicite um novo link para redefinir sua senha com segurança.
              </Text>
              <Link
                href={'/(auth)/recuperar-senha' as Href}
                style={{ fontFamily: fonts.semibold, textAlign: 'center' }}
                className="rounded-2xl bg-primary px-4 py-4 text-[15px] text-white"
              >
                Solicitar novo link
              </Link>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
