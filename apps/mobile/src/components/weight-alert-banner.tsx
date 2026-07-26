import { View, Text } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { weightAlert } from '@hubpatients/core';
import { useColors, fonts } from '@/theme';

/** Red-flag gentil de peso (mobile) — retenção de líquido / perda não intencional. */
export function WeightAlertBanner({ weights }: { weights: { date: string; kg: number }[] }) {
  const colors = useColors();
  const a = weightAlert(weights);
  if (!a.kind) return null;
  return (
    <View
      className="flex-row items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3"
      style={{ borderCurve: 'continuous', marginBottom: 8 }}
    >
      <AlertTriangle size={16} color={colors.attention} style={{ marginTop: 1 }} />
      <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[13px] leading-[18px] text-amber-800">
        {a.message}
      </Text>
    </View>
  );
}
