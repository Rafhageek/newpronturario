import { ScrollView, Text, View } from 'react-native';
import { useDashboard } from '@vidalog/supabase';
import { formatVital, MEDICATION_FORM_LABELS } from '@vidalog/core';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui';

export default function InicioScreen() {
  const { user } = useAuth();
  const { data, isLoading, error } = useDashboard(user?.id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <Text className="text-neutral-500">Carregando seu resumo…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <Text className="text-semaphore-alert">Erro ao carregar dados.</Text>
      </View>
    );
  }

  const bp = data?.latestBloodPressure ?? null;
  const meds = data?.activeMedications ?? [];
  const upcoming = data?.upcomingIntakes ?? [];

  return (
    <ScrollView className="flex-1 bg-neutral-50" contentContainerClassName="gap-4 p-4">
      <Text className="text-xl font-bold text-neutral-900">Olá! Seu resumo</Text>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Card>
            <Text className="text-xs uppercase text-neutral-400">Última PA</Text>
            <Text className="mt-1 text-xl font-bold text-primary">{bp ? formatVital(bp) : '—'}</Text>
          </Card>
        </View>
        <View className="flex-1">
          <Card>
            <Text className="text-xs uppercase text-neutral-400">Medicamentos</Text>
            <Text className="mt-1 text-xl font-bold text-accent">{meds.length}</Text>
          </Card>
        </View>
      </View>

      <Card>
        <Text className="mb-1 text-xs uppercase text-neutral-400">Próximas tomadas pendentes</Text>
        <Text className="text-2xl font-bold text-semaphore-attention">{upcoming.length}</Text>
      </Card>

      <Card>
        <Text className="mb-2 text-sm font-semibold text-neutral-700">Próxima medicação</Text>
        {meds.length === 0 ? (
          <Text className="text-sm text-neutral-400">
            Nenhum medicamento cadastrado. Adicione na aba Medicamentos.
          </Text>
        ) : (
          meds.slice(0, 3).map((med) => (
            <View key={med.id} className="flex-row justify-between border-b border-neutral-100 py-2">
              <Text className="text-sm text-neutral-800">{med.name}</Text>
              <Text className="text-xs text-neutral-400">
                {med.dosage ?? MEDICATION_FORM_LABELS[med.form]}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
