import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { LockKeyhole } from 'lucide-react-native';
import { passwordSchema } from '@hubpatients/core';
import { AppSheet, type AppSheetHandle } from './sheet';
import { Button, Input } from './ui';
import { toast } from './toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useColors, fonts } from '@/theme';

/**
 * Verdadeiro quando a conta logada só tem identidade do Google (nenhuma
 * identidade "email"), ou seja, nunca teve uma senha própria cadastrada.
 *
 * `identities` só reflete como a conta foi CRIADA/vinculada — chamar
 * `updateUser({ password })` não adiciona uma identidade "email" depois.
 * Por isso o app usa isso só para decidir se OFERECE o convite; o controle de
 * "já criou/já dispensou" é feito à parte (ver CREATE_PASSWORD_DISMISSED_KEY).
 */
export function useCreatePasswordEligibility(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  const identities = user.identities ?? [];
  if (identities.length === 0) return false;
  return !identities.some((identity) => identity.provider === 'email');
}

function dismissedKey(userId: string) {
  return `hubpatients.create-password-dismissed.${userId}`;
}

/** Formulário de criação de senha — usado tanto no convite automático quanto em Configurações. */
export function CreatePasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const colors = useColors();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
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
    setSubmitting(false);
    if (updateError) {
      setError('Não foi possível criar a senha. Tente novamente.');
      return;
    }
    toast.success('Senha criada. Agora você também pode entrar com e-mail e senha.');
    onSuccess();
  }

  return (
    <View className="gap-4 pb-2">
      <View className="flex-row items-center gap-2.5">
        <LockKeyhole size={18} color={colors.primary} />
        <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] leading-5 text-fg-soft">
          Você entrou com sua conta do Google. Crie uma senha para também poder entrar com e-mail e
          senha — útil se um dia não tiver acesso à conta Google.
        </Text>
      </View>
      <Input
        label="Nova senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="••••••••"
      />
      <Input
        label="Confirmar senha"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="••••••••"
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        error={error ?? undefined}
      />
      <Button label="Criar senha" loading={submitting} onPress={() => void submit()} />
    </View>
  );
}

/**
 * Convite automático — aparece UMA vez por conta elegível (Google sem senha),
 * na Home. Segue o mesmo princípio do WhatsNewSheet: preferência, não dado
 * clínico, então falha de leitura/escrita do SecureStore não bloqueia nada.
 *
 * "Agora não" também marca como dispensado: a pessoa não fica sendo cobrada
 * a cada abertura do app. Quem mudar de ideia cria a senha em
 * Configurações → Segurança, que fica disponível sempre.
 *
 * `onDecided` avisa o componente pai se o convite VAI aparecer, para telas com
 * mais de um "sheet" de boas-vindas evitarem empilhar dois ao mesmo tempo.
 */
export function CreatePasswordSheet({ onDecided }: { onDecided?: (willShow: boolean) => void }) {
  const { user } = useAuth();
  const eligible = useCreatePasswordEligibility();
  const sheetRef = useRef<AppSheetHandle>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelado = false;
    if (!user || !eligible) {
      onDecided?.(false);
      return;
    }
    (async () => {
      try {
        const dispensado = await SecureStore.getItemAsync(dismissedKey(user.id));
        if (cancelado) return;
        if (dispensado) {
          onDecided?.(false);
          return;
        }
        setVisible(true);
        onDecided?.(true);
      } catch {
        onDecided?.(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [user?.id, eligible]);

  async function dismiss() {
    if (user) {
      try {
        await SecureStore.setItemAsync(dismissedKey(user.id), '1');
      } catch {
        // preferência, não bloqueia
      }
    }
    sheetRef.current?.close();
  }

  async function handleSuccess() {
    if (user) {
      try {
        await SecureStore.setItemAsync(dismissedKey(user.id), '1');
      } catch {
        // preferência, não bloqueia
      }
    }
    sheetRef.current?.close();
  }

  if (!visible) return null;

  return (
    <AppSheet ref={sheetRef} onClose={() => setVisible(false)} title="Criar uma senha">
      <View className="gap-3">
        <CreatePasswordForm onSuccess={handleSuccess} />
        <Button label="Agora não" variant="ghost" onPress={() => void dismiss()} />
      </View>
    </AppSheet>
  );
}
