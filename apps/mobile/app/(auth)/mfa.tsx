import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fonts, useColors } from '@/theme';

export default function MfaChallengeScreen() {
  const colors = useColors();
  const { signOut, mfaError, refreshMfaAssurance } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(mfaError);

  const loadFactor = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp.find((factor) => factor.status === 'verified');
    setFactorId(verified?.id ?? null);
    setError(
      listError || !verified
        ? 'Não foi possível localizar um autenticador verificado. Tente novamente ou entre com outra conta.'
        : null,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFactor();
  }, [loadFactor]);

  async function verify() {
    const normalizedCode = code.replace(/\D/g, '');
    if (!factorId || !/^\d{6}$/.test(normalizedCode)) {
      setError('Digite o código de 6 dígitos do seu aplicativo autenticador.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: normalizedCode,
    });
    if (verifyError) {
      setSubmitting(false);
      setError('Código inválido ou expirado. Aguarde um novo código e tente novamente.');
      return;
    }

    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== 'aal2') {
      setSubmitting(false);
      setError('O código foi aceito, mas não foi possível confirmar o nível AAL2. Tente novamente.');
      return;
    }

    // O navigator só libera as tabs depois que o servidor comprova AAL2.
    await refreshMfaAssurance();
    setSubmitting(false);
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
        <View
          accessibilityLabelledBy="mfa-title"
          className="gap-5 rounded-3xl border border-line bg-surface p-5"
        >
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-trust-50">
            <ShieldCheck size={24} color={colors.primary} accessible={false} />
          </View>
          <View className="gap-2">
            <Text
              nativeID="mfa-title"
              accessibilityRole="header"
              style={{ fontFamily: fonts.display }}
              className="text-[24px] text-fg"
            >
              Confirme que é você
            </Text>
            <Text style={{ fontFamily: fonts.regular }} className="text-[14px] leading-6 text-muted">
              Abra seu aplicativo autenticador e informe o código atual antes de acessar seus dados de
              saúde.
            </Text>
          </View>

          {loading ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Carregando segundo fator"
              className="items-center gap-3 py-6"
            >
              <ActivityIndicator color={colors.primary} />
              <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
                Verificando proteção da conta…
              </Text>
            </View>
          ) : factorId ? (
            <>
              <Input
                label="Código de 6 dígitos"
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (!submitting) void verify();
                }}
                error={error ?? undefined}
                accessibilityHint="O código muda a cada poucos segundos"
              />
              <Button
                label="Continuar com segurança"
                icon={ShieldCheck}
                loading={submitting}
                disabled={code.length !== 6}
                onPress={() => void verify()}
              />
            </>
          ) : (
            <View accessibilityRole="alert" accessibilityLiveRegion="assertive" className="gap-3">
              <Text style={{ fontFamily: fonts.regular }} className="text-[13px] leading-5 text-semaphore-alert">
                {error}
              </Text>
              <Button
                label="Tentar novamente"
                variant="outline"
                onPress={() => {
                  void refreshMfaAssurance();
                  void loadFactor();
                }}
              />
            </View>
          )}

          <Button
            label="Sair e usar outra conta"
            variant="ghost"
            onPress={() => void signOut()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
