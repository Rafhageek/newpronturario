import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { loginSchema } from '@vidalog/core';
import { useAuth } from '@/lib/auth';
import { Button, Input } from '@/components/ui';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <ScrollView contentContainerClassName="flex-1 justify-center bg-trust-50 px-6">
      <Text className="mb-1 text-center text-3xl font-bold text-primary">🩺 VidaLog</Text>
      <Text className="mb-8 text-center text-sm text-neutral-500">
        Seu prontuário pessoal de saúde
      </Text>
      <View className="gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <Text className="text-lg font-semibold text-neutral-900">Entrar</Text>
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="voce@email.com"
        />
        <Input
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        {error ? <Text className="text-sm text-semaphore-alert">{error}</Text> : null}
        <Button label={loading ? 'Entrando…' : 'Entrar'} onPress={onSubmit} disabled={loading} />
        <Link href="/(auth)/cadastro" className="text-center text-sm text-primary">
          Não tem conta? Criar conta
        </Link>
      </View>
    </ScrollView>
  );
}
