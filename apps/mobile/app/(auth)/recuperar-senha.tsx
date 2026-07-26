import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { CheckCircle2, Mail } from 'lucide-react-native';
import { emailSchema } from '@hubpatients/core';
import { Button, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { fonts, useColors } from '@/theme';

export default function RecoverPasswordScreen() {
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function requestReset() {
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Informe um e-mail válido.');
      return;
    }

    setLoading(true);
    const redirectTo = Linking.createURL('redefinir-senha');
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo,
    });
    setLoading(false);

    if (requestError) {
      setError('Não foi possível enviar o link agora. Verifique sua conexão e tente novamente.');
      return;
    }

    setSent(true);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-bg"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-6 rounded-3xl border border-line bg-surface p-5">
          {sent ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="polite" className="gap-4">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                <CheckCircle2 size={24} color={colors.accent} accessible={false} />
              </View>
              <View className="gap-2">
                <Text accessibilityRole="header" style={{ fontFamily: fonts.display }} className="text-[24px] text-fg">
                  Confira seu e-mail
                </Text>
                <Text style={{ fontFamily: fonts.regular }} className="text-[14px] leading-6 text-muted">
                  Se existir uma conta para {email.trim()}, enviaremos um link seguro e temporário para
                  criar uma nova senha.
                </Text>
              </View>
              <Button label="Enviar para outro e-mail" variant="outline" onPress={() => setSent(false)} />
            </View>
          ) : (
            <>
              <View className="gap-2">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-trust-50">
                  <Mail size={23} color={colors.primary} accessible={false} />
                </View>
                <Text accessibilityRole="header" style={{ fontFamily: fonts.display }} className="mt-2 text-[24px] text-fg">
                  Recuperar acesso
                </Text>
                <Text style={{ fontFamily: fonts.regular }} className="text-[14px] leading-6 text-muted">
                  Informe seu e-mail para receber um link de uso único. Por segurança, não informamos se
                  ele possui uma conta.
                </Text>
              </View>
              <Input
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => void requestReset()}
                error={error ?? undefined}
                placeholder="voce@email.com"
              />
              <Button label="Enviar link seguro" loading={loading} onPress={() => void requestReset()} />
            </>
          )}

          <Link
            href="/(auth)/login"
            style={{ fontFamily: fonts.semibold, textAlign: 'center' }}
            className="text-[14px] text-primary"
          >
            Voltar para o login
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
