import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { signupSchema, DISCLAIMERS } from '@vidalog/core';
import { useAuth } from '@/lib/auth';
import { Button, Input } from '@/components/ui';

export default function CadastroScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    const parsed = signupSchema.safeParse({
      fullName,
      email,
      password,
      confirmPassword,
      acceptedTerms: true,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
      return;
    }
    setLoading(true);
    const { error: signUpError } = await signUp(fullName, email, password);
    setLoading(false);
    if (signUpError) setError(signUpError);
  }

  return (
    <ScrollView contentContainerClassName="flex-1 justify-center bg-trust-50 px-6 py-10">
      <Text className="mb-6 text-center text-2xl font-bold text-primary">Criar conta</Text>
      <View className="gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <Input label="Nome completo" value={fullName} onChangeText={setFullName} placeholder="Seu nome" />
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input label="Senha" value={password} onChangeText={setPassword} secureTextEntry />
        <Input
          label="Confirmar senha"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        {error ? <Text className="text-sm text-semaphore-alert">{error}</Text> : null}
        <Button label={loading ? 'Criando…' : 'Criar conta'} onPress={onSubmit} disabled={loading} />
        <Text className="text-center text-xs text-neutral-400">{DISCLAIMERS.dataSharing}</Text>
        <Link href="/(auth)/login" className="text-center text-sm text-primary">
          Já tem conta? Entrar
        </Link>
      </View>
    </ScrollView>
  );
}
