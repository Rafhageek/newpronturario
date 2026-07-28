import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Baby, Plus, Cake } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useChildren, useAddChild } from '@hubpatients/supabase';
import { calculateAge, type ChildSex } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Input, Button, EmptyState, ErrorState, IconCircle, Badge } from '@/components/ui';
import { DateInputBR } from '@/components/date-input';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { fonts } from '@/theme';

export default function CriancasScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: children, isLoading, isError, refetch } = useChildren();
  const add = useAddChild(user?.id ?? '');

  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await qc.invalidateQueries(); } finally { setRefreshing(false); }
  };

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<ChildSex>('male');

  async function onAdd() {
    if (!name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      toast.info('Informe o nome e a data de nascimento (DD/MM/AAAA).');
      return;
    }
    try {
      await add.mutateAsync({ fullName: name.trim(), birthDate, sex });
      setName('');
      setBirthDate('');
    } catch {
      toast.error('Não foi possível adicionar a criança.');
    }
  }

  const list = children ?? [];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Crianças" subtitle="Acompanhe o desenvolvimento" icon={Baby} back />
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        <Card className="gap-3">
          <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
            Adicionar criança
          </Text>
          <Input label="Nome" value={name} onChangeText={setName} placeholder="Nome da criança" />
          <DateInputBR
            label="Nascimento"
            value={birthDate}
            onChangeIso={setBirthDate}
          />
          <View className="flex-row gap-2">
            {(['male', 'female'] as ChildSex[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSex(s)}
                style={{ borderCurve: 'continuous' }}
                className={`flex-1 items-center rounded-2xl border py-2.5 ${sex === s ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'}`}
              >
                <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                  {s === 'male' ? 'Menino' : 'Menina'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button label="Adicionar" icon={Plus} loading={add.isPending} onPress={onAdd} />
        </Card>

        {isLoading ? null : isError && !children ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : list.length > 0 ? (
          <View className="gap-3">
            {list.map((c, i) => (
              <FadeInItem key={c.id} index={i}>
                <Card onPress={() => router.push(`/criancas/${c.id}` as never)} className="flex-row items-center gap-3">
                  <IconCircle icon={Baby} tone={c.sex === 'female' ? 'alert' : 'primary'} size={46} />
                  <View className="flex-1">
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
                      {c.full_name}
                    </Text>
                    <View className="mt-0.5 flex-row items-center gap-1.5">
                      <Cake size={13} color="#847e74" />
                      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                        {calculateAge(c.birth_date)} anos ·{' '}
                        {new Date(c.birth_date).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                  </View>
                  <Badge tone={c.sex === 'female' ? 'alert' : 'info'}>
                    {c.sex === 'female' ? 'Menina' : 'Menino'}
                  </Badge>
                </Card>
              </FadeInItem>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={Baby}
            title="Nenhuma criança cadastrada"
            subtitle="Adicione para acompanhar crescimento, vacinas e marcos."
          />
        )}
      </Screen>
    </View>
  );
}
