import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { Target, Scale, Footprints, Droplets } from 'lucide-react-native';
import { useGoals, useSetGoal, useTodayWater, useBodyComposition } from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import { AppHeader, Card, SectionTitle, Button } from '@/components/ui';
import { toast } from '@/components/toast';
import { useColors, fonts } from '@/theme';

const oneDec = (n: number) => n.toFixed(1).replace('.', ',');

export default function MetasScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const uid = user?.id;
  const { data: goals } = useGoals(uid);
  const setGoal = useSetGoal(uid);
  const { data: todayWaterMl = 0 } = useTodayWater(uid);
  const { data: bodyHistory = [] } = useBodyComposition(uid);
  const currentWeight = bodyHistory[0]?.weight_kg ?? null;

  const [vals, setVals] = useState({ weight: '', steps: '', water: '' });
  const prefilled = useRef(false);
  useEffect(() => {
    if (goals && !prefilled.current) {
      prefilled.current = true;
      setVals({
        weight: goals.weight != null ? String(goals.weight).replace('.', ',') : '',
        steps: goals.steps != null ? String(goals.steps) : '',
        water: goals.water != null ? String(goals.water / 1000).replace('.', ',') : '',
      });
    }
  }, [goals]);

  async function save() {
    if (!uid || setGoal.isPending) return;
    const tasks: Promise<void>[] = [];
    const w = parseFloat(vals.weight.replace(',', '.'));
    if (Number.isFinite(w) && w > 0) tasks.push(setGoal.mutateAsync({ goalType: 'weight', target: w }));
    const s = parseInt(vals.steps.replace(/\D/g, ''), 10);
    if (Number.isFinite(s) && s > 0) tasks.push(setGoal.mutateAsync({ goalType: 'steps', target: s }));
    const l = parseFloat(vals.water.replace(',', '.'));
    if (Number.isFinite(l) && l > 0) tasks.push(setGoal.mutateAsync({ goalType: 'water', target: Math.round(l * 1000) }));
    if (!tasks.length) {
      toast.info('Defina ao menos uma meta.');
      return;
    }
    try {
      await Promise.all(tasks);
      toast.success('Metas salvas.');
    } catch {
      toast.error('Não foi possível salvar agora.');
    }
  }

  const waterPct = goals?.water ? Math.min(1, todayWaterMl / goals.water) : null;

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Minhas metas" subtitle="Sem cobrança — no seu ritmo" back />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
      >
        {/* Progresso atual */}
        <SectionTitle>Como você está hoje</SectionTitle>
        <Card className="gap-3.5">
          <ProgressRow
            icon={Droplets}
            color="#0EA5E9"
            label="Água hoje"
            current={`${oneDec(todayWaterMl / 1000)} L`}
            target={goals?.water ? `${oneDec(goals.water / 1000)} L` : null}
            pct={waterPct}
          />
          <ProgressRow
            icon={Scale}
            color={colors.primary}
            label="Peso"
            current={currentWeight != null ? `${oneDec(currentWeight)} kg` : '—'}
            target={goals?.weight ? `${oneDec(goals.weight)} kg` : null}
            pct={null}
          />
          <ProgressRow
            icon={Footprints}
            color="#22C55E"
            label="Passos / dia"
            current="ver no início"
            target={goals?.steps ? String(goals.steps) : null}
            pct={null}
          />
        </Card>

        {/* Definir metas */}
        <SectionTitle>Definir metas</SectionTitle>
        <Card className="gap-3">
          <Field label="Meta de peso (kg)" value={vals.weight} onChange={(v) => setVals((s) => ({ ...s, weight: v }))} colors={colors} />
          <Field label="Meta de passos por dia" value={vals.steps} onChange={(v) => setVals((s) => ({ ...s, steps: v }))} colors={colors} intOnly />
          <Field label="Meta de água por dia (litros)" value={vals.water} onChange={(v) => setVals((s) => ({ ...s, water: v }))} colors={colors} />
          <Button
            label={setGoal.isPending ? 'Salvando…' : 'Salvar metas'}
            icon={Target}
            variant="primary"
            onPress={save}
            disabled={setGoal.isPending}
          />
          <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-muted">
            Metas são um incentivo pessoal, não uma recomendação clínica. Converse com sua equipe de saúde sobre o que é ideal para você.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  colors,
  intOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useColors>;
  intOnly?: boolean;
}) {
  return (
    <View>
      <Text style={{ fontFamily: fonts.medium }} className="mb-1 text-[12px] text-muted">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={intOnly ? 'number-pad' : 'decimal-pad'}
        placeholder="—"
        placeholderTextColor={colors.faint}
        style={{ fontFamily: fonts.regular, borderCurve: 'continuous' }}
        className="rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] text-fg"
      />
    </View>
  );
}

function ProgressRow({
  icon: Icon,
  color,
  label,
  current,
  target,
  pct,
}: {
  icon: typeof Scale;
  color: string;
  label: string;
  current: string;
  target: string | null;
  pct: number | null;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2">
        <Icon size={16} color={color} />
        <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg">
          {label}
        </Text>
        <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
          {current}
          {target ? ` · meta ${target}` : ''}
        </Text>
      </View>
      {pct != null ? (
        <View className="h-2 overflow-hidden rounded-full bg-surface-2">
          <View style={{ width: `${pct * 100}%`, backgroundColor: color }} className="h-full rounded-full" />
        </View>
      ) : target == null ? (
        <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-faint">
          Defina uma meta abaixo
        </Text>
      ) : null}
    </View>
  );
}
