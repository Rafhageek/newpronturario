import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Scale, ChevronRight } from 'lucide-react-native';
import { useBodyComposition } from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui';
import { fonts, useColors } from '@/theme';

const oneDec = (n: number) => n.toFixed(1).replace('.', ',');

/** Atalho para Composição corporal no home — mostra a última medição (se houver). */
export function BodyCompositionCard() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { data: history = [] } = useBodyComposition(user?.id);
  const latest = history[0] ?? null;

  const subtitle = latest
    ? [
        latest.weight_kg != null ? `${oneDec(latest.weight_kg)} kg` : null,
        latest.body_fat_pct != null ? `${oneDec(latest.body_fat_pct)}% gordura` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Ver medições'
    : 'Registre peso, gordura, massa muscular…';

  return (
    <Pressable
      onPress={() => router.push('/composicao-corporal' as never)}
      accessibilityRole="button"
      accessibilityLabel="Composição corporal"
      className="active:opacity-80"
    >
      <Card className="flex-row items-center gap-3">
        <View
          style={{ backgroundColor: 'rgba(4,66,191,0.10)', borderCurve: 'continuous' }}
          className="h-9 w-9 items-center justify-center rounded-full"
        >
          <Scale size={18} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
            Composição corporal
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.faint} />
      </Card>
    </Pressable>
  );
}
