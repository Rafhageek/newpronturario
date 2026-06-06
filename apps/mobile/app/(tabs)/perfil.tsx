import { ScrollView, Text, View } from 'react-native';
import { useProfile } from '@vidalog/supabase';
import { BIOLOGICAL_SEX_LABELS, calculateAge, DISCLAIMERS } from '@vidalog/core';
import { useAuth } from '@/lib/auth';
import { Button, Card } from '@/components/ui';

export default function PerfilScreen() {
  const { user, signOut } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <Text className="text-neutral-500">Carregando perfil…</Text>
      </View>
    );
  }

  const age = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null;

  return (
    <ScrollView className="flex-1 bg-neutral-50" contentContainerClassName="gap-4 p-4">
      <Card>
        <Field label="Nome" value={profile?.full_name ?? '—'} />
        <Field label="E-mail" value={user?.email ?? '—'} />
        <Field label="Idade" value={age != null ? `${age} anos` : '—'} />
        <Field
          label="Sexo biológico"
          value={profile ? BIOLOGICAL_SEX_LABELS[profile.biological_sex] : '—'}
        />
        <Field
          label="Tipo sanguíneo"
          value={profile && profile.blood_type !== 'unknown' ? profile.blood_type : '—'}
        />
      </Card>

      {/* Cartão de emergência QR — placeholder (Fase 1). */}
      <Card dashed>
        <View className="flex-row items-center gap-4">
          <View className="h-20 w-20 items-center justify-center rounded-xl border-2 border-neutral-200 bg-neutral-50">
            <Text className="text-3xl">🔳</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-neutral-800">Cartão de Emergência</Text>
            <Text className="mt-1 text-xs text-neutral-500">
              QR público com dados vitais. Em breve.
            </Text>
          </View>
        </View>
      </Card>

      <Button label="Sair" onPress={signOut} />
      <Text className="text-center text-xs text-neutral-400">{DISCLAIMERS.notDiagnosis}</Text>
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="border-b border-neutral-100 py-2">
      <Text className="text-xs uppercase text-neutral-400">{label}</Text>
      <Text className="text-sm text-neutral-800">{value}</Text>
    </View>
  );
}
