import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors, useColors } from '@/theme';

/**
 * Celebração de marco (confete) — emissor global como o toast: qualquer tela
 * chama `celebrate()` ao concluir algo importante (ex.: registro do dia). Leve,
 * curto e não-bloqueante (pointerEvents none). Respeita reduzir movimento (não
 * dispara — o feedback fica por conta do toast de sucesso).
 */

let counter = 0;
const listeners = new Set<(id: number) => void>();

export function celebrate() {
  counter += 1;
  listeners.forEach((l) => l(counter));
}

const PALETTE = [colors.primary, colors.accent, colors.attention, colors.brand, colors.ok, '#f472b6'];

type PieceData = { key: number; x: number; size: number; color: string; delay: number; fall: number; rotateTo: number };

function Piece({ x, size, color, delay, fall, rotateTo }: Omit<PieceData, 'key'>) {
  const ty = useSharedValue(-40);
  const op = useSharedValue(0);
  const rot = useSharedValue(0);

  useEffect(() => {
    op.value = withDelay(delay, withSequence(withTiming(1, { duration: 120 }), withDelay(720, withTiming(0, { duration: 420 }))));
    ty.value = withDelay(delay, withTiming(fall, { duration: 1250, easing: Easing.in(Easing.quad) }));
    rot.value = withDelay(delay, withTiming(rotateTo, { duration: 1250 }));
  }, []);

  const st = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { rotate: `${rot.value}deg` }],
    opacity: op.value,
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: x, top: 0, width: size, height: size * 0.6, borderRadius: 2, backgroundColor: color },
        st,
      ]}
    />
  );
}

function Burst({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const colors = useColors();
  const pieces = useMemo<PieceData[]>(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        key: i,
        x: Math.random() * width,
        size: 7 + Math.random() * 7,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? colors.primary,
        delay: Math.random() * 240,
        fall: height * (0.6 + Math.random() * 0.4),
        rotateTo: Math.random() * 720 - 360,
      })),
    [width, height],
  );

  useEffect(() => {
    const t = setTimeout(onDone, 1700);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <Piece key={p.key} x={p.x} size={p.size} color={p.color} delay={p.delay} fall={p.fall} rotateTo={p.rotateTo} />
      ))}
    </View>
  );
}

export function CelebrationHost() {
  const reduce = useReducedMotion();
  const [bursts, setBursts] = useState<number[]>([]);

  useEffect(() => {
    const l = (id: number) => {
      if (!reduce) setBursts((b) => [...b, id]);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [reduce]);

  if (bursts.length === 0) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 9998 }]}>
      {bursts.map((id) => (
        <Burst key={id} onDone={() => setBursts((b) => b.filter((x) => x !== id))} />
      ))}
    </View>
  );
}
