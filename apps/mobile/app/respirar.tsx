import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Wind, Check } from 'lucide-react-native';
import { AppHeader, Button } from '@/components/ui';
import { toast } from '@/components/toast';
import { fonts, gradients } from '@/theme';

const INHALE = 4000; // 4s inspira
const EXHALE = 6000; // 6s expira → ~6 respirações/min

/**
 * Respiração guiada lenta (~6 rpm) — apoio de relaxamento (PA/ansiedade).
 * Círculo que expande (inspire) e contrai (expire), contadores e háptica.
 * Respeita reduce-motion (círculo estático, guia por texto). NUNCA trata —
 * disclaimer permanente. Feature de bem-estar (grátis).
 */
export default function RespirarScreen() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const scale = useSharedValue(reduce ? 0.85 : 0.5);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [breaths, setBreaths] = useState(0);
  const [secs, setSecs] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let alive = true;
    const inhale = () => {
      if (!alive) return;
      setPhase('in');
      if (!reduce) scale.value = withTiming(1, { duration: INHALE, easing: Easing.inOut(Easing.sin) });
      void Haptics.selectionAsync();
      timer.current = setTimeout(exhale, INHALE);
    };
    const exhale = () => {
      if (!alive) return;
      setPhase('out');
      if (!reduce) scale.value = withTiming(0.5, { duration: EXHALE, easing: Easing.inOut(Easing.sin) });
      setBreaths((b) => b + 1);
      timer.current = setTimeout(inhale, EXHALE);
    };
    inhale();
    const sec = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      clearInterval(sec);
    };
  }, [scale, reduce]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const finish = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.success('Sessão de respiração concluída. Respire fundo mais uma vez. 💙');
    router.back();
  };

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Respirar" subtitle="Um momento de calma" back />

      <View className="flex-1 items-center justify-center px-6">
        <Text style={{ fontFamily: fonts.display }} className="mb-10 text-[24px] text-fg">
          {phase === 'in' ? 'Inspire…' : 'Expire…'}
        </Text>

        <View className="h-64 w-64 items-center justify-center">
          <Animated.View style={[{ position: 'absolute', width: 256, height: 256, borderRadius: 128 }, circleStyle]}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 128 }} />
          </Animated.View>
          <Wind size={40} color="#ffffff" />
        </View>

        <Text style={{ fontFamily: fonts.regular }} className="mt-10 text-[14px] text-muted">
          {breaths} {breaths === 1 ? 'respiração' : 'respirações'} · {mm}:{ss}
        </Text>
      </View>

      <View className="gap-3 px-4 pb-6">
        <Button label="Concluir" icon={Check} onPress={finish} />
        <Text style={{ fontFamily: fonts.regular }} className="px-2 text-center text-[11px] leading-4 text-faint">
          Técnica de relaxamento — não substitui sua medicação. Em emergência, ligue 192.
        </Text>
      </View>
    </View>
  );
}
