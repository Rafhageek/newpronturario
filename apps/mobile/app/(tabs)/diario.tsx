import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useDiaryEntries, useCreateDiaryEntry } from '@vidalog/supabase';
import { diaryEntrySchema, MOOD_LABELS } from '@vidalog/core';
import { useAuth } from '@/lib/auth';
import { Button, Card, Input } from '@/components/ui';

export default function DiarioScreen() {
  const { user } = useAuth();
  const patientId = user?.id ?? '';
  const { data: entries, isLoading } = useDiaryEntries(user?.id);
  const createEntry = useCreateDiaryEntry(patientId);

  const [note, setNote] = useState('');
  const [symptoms, setSymptoms] = useState('');

  async function onAdd() {
    const parsed = diaryEntrySchema.safeParse({
      note: note || undefined,
      symptoms: symptoms.split(',').map((s) => s.trim()).filter(Boolean),
    });
    if (!parsed.success) return;
    await createEntry.mutateAsync({
      patient_id: patientId,
      note: parsed.data.note ?? null,
      symptoms: parsed.data.symptoms,
      entry_date: new Date().toISOString().slice(0, 10),
    });
    setNote('');
    setSymptoms('');
  }

  return (
    <ScrollView className="flex-1 bg-neutral-50" contentContainerClassName="gap-4 p-4">
      <Card>
        <Text className="mb-2 text-sm font-semibold text-neutral-700">Nova entrada</Text>
        <View className="gap-3">
          <Input label="Sintomas (vírgula)" value={symptoms} onChangeText={setSymptoms} placeholder="dor de cabeça, cansaço" />
          <Input label="Anotação" value={note} onChangeText={setNote} placeholder="Como foi seu dia?" />
          <Button
            label={createEntry.isPending ? 'Salvando…' : 'Adicionar'}
            onPress={onAdd}
            disabled={createEntry.isPending}
          />
        </View>
      </Card>

      {isLoading ? (
        <Text className="text-sm text-neutral-500">Carregando…</Text>
      ) : entries && entries.length > 0 ? (
        entries.map((entry) => (
          <Card key={entry.id}>
            <View className="flex-row justify-between">
              <Text className="text-sm font-medium text-neutral-800">
                {new Date(entry.entry_date).toLocaleDateString('pt-BR')}
              </Text>
              {entry.mood ? (
                <Text className="text-xs text-neutral-400">{MOOD_LABELS[entry.mood]}</Text>
              ) : null}
            </View>
            {entry.symptoms.length > 0 ? (
              <Text className="mt-1 text-sm text-neutral-600">Sintomas: {entry.symptoms.join(', ')}</Text>
            ) : null}
            {entry.note ? <Text className="mt-1 text-sm text-neutral-700">{entry.note}</Text> : null}
          </Card>
        ))
      ) : (
        <Text className="text-sm text-neutral-400">Nenhuma entrada ainda.</Text>
      )}
    </ScrollView>
  );
}
