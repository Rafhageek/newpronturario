import { useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Droplets, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTodayWater, useLogWater } from '@hubpatients/supabase';
import { GLASS_ML, waterGoalMl, glassesForGoal, WATER_CAP_NOTE } from '@hubpatients/core';
import { Card } from '@/components/ui';
import { toast } from '@/components/toast';
import { fonts } from '@/theme';

// Azul de hidratação — distinto do royal da marca, lê claramente como "água".
const WATER = '#0EA5E9';

const oneDecimalL = (ml: number) => (ml / 1000).toFixed(1).replace('.', ',');

/**
 * Card de hidratação (bem-estar, grátis). A meta é SEMPRE enquadrada como
 * "estimativa" (regra ética do projeto) e o card mostra o aviso de teto para
 * cardiopata/renal. Um toque = 1 copo. Owner-only (RLS user_id = auth.uid()).
 */
export function WaterCard({
  patientId,
  weightKg,
  age,
}: {
  patientId: string | undefined;
  weightKg: number | null;
  age: number | null;
}) {
  const { data: todayMl, isLoading, isError } = useTodayWater(patientId);
  const logWater = useLogWater(patientId);
  // Trava síncrona: impede 2º toque no mesmo tick (antes do isPending re-renderizar).
  const submitting = useRef(false);

  const goal = waterGoalMl(weightKg, age);
  const ml = todayMl ?? 0;
  const reached = ml >= goal;
  const pct = Math.min(1, ml / goal);
  const glasses = Math.round(ml / GLASS_ML);
  const goalGlasses = glassesForGoal(goal);
  const busy = logWater.isPending;

  async function addGlass() {
    if (!patientId || submitting.current) return;
    submitting.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await logWater.mutateAsync(GLASS_ML);
    } catch {
      toast.error('Não foi possível registrar agora.');
    } finally {
      submitting.current = false;
    }
  }

  const subtitle = isError
    ? 'Não foi possível carregar agora'
    : isLoading
      ? 'Carregando…'
      : `${glasses} ${glasses === 1 ? 'copo' : 'copos'} · meta estimada ${goalGlasses} (${oneDecimalL(goal)} L)`;

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <View
          style={{ backgroundColor: 'rgba(14,165,233,0.12)', borderCurve: 'continuous' }}
          className="h-9 w-9 items-center justify-center rounded-full"
        >
          <Droplets size={18} color={WATER} />
        </View>
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
            Hidratação
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
            {subtitle}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.bold, color: WATER }} className="text-[18px]">
          {isError || isLoading ? '—' : `${Math.round(pct * 100)}%`}
        </Text>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: isError || isLoading ? 0 : Math.round(pct * 100) }}
        className="h-2.5 overflow-hidden rounded-full bg-surface-2"
      >
        <View style={{ width: `${pct * 100}%`, backgroundColor: WATER }} className="h-full rounded-full" />
      </View>

      {reached && !isError && !isLoading ? (
        <Text style={{ fontFamily: fonts.medium, color: WATER }} className="text-[12px]">
          Meta estimada atingida 🎉
        </Text>
      ) : null}

      <Pressable
        onPress={addGlass}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Bebi um copo de água (250 ml)"
        accessibilityState={{ disabled: busy, busy }}
        style={{ backgroundColor: WATER, borderCurve: 'continuous', minHeight: 44 }}
        className="flex-row items-center justify-center gap-1.5 rounded-xl px-3 py-3 active:opacity-80"
      >
        {busy ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Plus size={16} color="#ffffff" />
        )}
        <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-white">
          Bebi um copo (250 ml)
        </Text>
      </Pressable>

      <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-muted">
        {WATER_CAP_NOTE}
      </Text>
    </Card>
  );
}
