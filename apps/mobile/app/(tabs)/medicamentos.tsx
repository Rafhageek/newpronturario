import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useMedications, useRegisterIntake, useVidaLogClient } from '@vidalog/supabase';
import { medicationSchema, MEDICATION_FORM_LABELS } from '@vidalog/core';
import { useAuth } from '@/lib/auth';
import { Button, Card, Input } from '@/components/ui';

export default function MedicamentosScreen() {
  const { user } = useAuth();
  const supabase = useVidaLogClient();
  const patientId = user?.id ?? '';
  const { data: meds, isLoading, refetch } = useMedications(user?.id);
  const registerIntake = useRegisterIntake(patientId);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');

  async function onAdd() {
    const parsed = medicationSchema.safeParse({ name, dosage: dosage || undefined });
    if (!parsed.success) return;
    await supabase
      .from('medications')
      .insert({ patient_id: patientId, name: parsed.data.name, dosage: parsed.data.dosage ?? null });
    setName('');
    setDosage('');
    refetch();
  }

  async function onIntake(medicationId: string) {
    await registerIntake.mutateAsync({
      patient_id: patientId,
      medication_id: medicationId,
      status: 'taken',
      taken_at: new Date().toISOString(),
    });
  }

  return (
    <ScrollView className="flex-1 bg-neutral-50" contentContainerClassName="gap-4 p-4">
      <Card>
        <Text className="mb-2 text-sm font-semibold text-neutral-700">Adicionar medicamento</Text>
        <View className="gap-3">
          <Input label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Losartana" />
          <Input label="Dose" value={dosage} onChangeText={setDosage} placeholder="50 mg" />
          <Button label="Adicionar" onPress={onAdd} />
        </View>
      </Card>

      {isLoading ? (
        <Text className="text-sm text-neutral-500">Carregando…</Text>
      ) : meds && meds.length > 0 ? (
        meds.map((med) => (
          <Card key={med.id}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm font-medium text-neutral-800">{med.name}</Text>
                <Text className="text-xs text-neutral-400">
                  {med.dosage ? `${med.dosage} · ` : ''}
                  {MEDICATION_FORM_LABELS[med.form]}
                </Text>
              </View>
              <Button
                label="Registrar tomada"
                variant="accent"
                onPress={() => onIntake(med.id)}
                disabled={registerIntake.isPending}
              />
            </View>
          </Card>
        ))
      ) : (
        <Text className="text-sm text-neutral-400">Nenhum medicamento cadastrado.</Text>
      )}
    </ScrollView>
  );
}
