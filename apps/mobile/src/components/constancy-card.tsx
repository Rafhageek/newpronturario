import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Sprout } from 'lucide-react-native';
import { computeConstancy } from '@hubpatients/core';
import { useDiaryEntries } from '@hubpatients/supabase';
import { useColors, fonts } from '@/theme';

/**
 * Card de Constância Gentil (mobile) — anel de progresso + nível + frase calorosa.
 * Um dia perdido nunca zera. Sinal = dias com registro no diário.
 */
export function ConstancyCard({ patientId }: { patientId?: string }) {
  const colors = useColors();
  const { data: entries = [] } = useDiaryEntries(patientId);
  const c = computeConstancy(entries.map((e) => e.entry_date));

  const r = 24;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, c.score)) / 100);

  return (
    <View
      className="flex-row items-center gap-3 rounded-3xl border border-line bg-surface p-4"
      style={{ borderCurve: 'continuous' }}
    >
      <View style={{ width: 60, height: 60 }} className="items-center justify-center">
        <Svg width={60} height={60} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={30} cy={30} r={r} stroke={colors.line} strokeWidth={6} fill="none" />
          <Circle
            cx={30}
            cy={30}
            r={r}
            stroke={colors.primary}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </Svg>
        <Text style={{ fontFamily: fonts.bold, color: colors.fg }} className="text-[15px]">
          {c.score}
        </Text>
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Sprout size={15} color={colors.ok} />
          <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
            Sua constância
          </Text>
          <View className="rounded-full bg-primary/10 px-2 py-0.5">
            <Text style={{ fontFamily: fonts.medium, color: colors.primary }} className="text-[11px]">
              {c.levelLabel}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.regular }} className="mt-0.5 text-[12px] leading-4 text-muted" numberOfLines={2}>
          {c.message}
        </Text>
      </View>
    </View>
  );
}
