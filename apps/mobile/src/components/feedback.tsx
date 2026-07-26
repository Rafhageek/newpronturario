import { type ReactNode, useEffect, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { type LucideIcon } from 'lucide-react-native';
import { motion } from '@hubpatients/ui-tokens';
import { colors, useColors, fonts } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Curva assinatura do produto, na forma que o Reanimated consome. */
const EASE_SIGNATURE = Easing.bezier(...motion.easing.signature);

/**
 * Pressable com micro-interação: encolhe levemente no toque (escala) + haptic
 * sutil. Respeita "reduzir movimento" do sistema. Base de todo toque do app.
 */
export function PressableScale({
  children,
  onPress,
  haptic = true,
  scaleTo = 0.97,
  disabled,
  style,
  ...rest
}: PressableProps & { haptic?: boolean; scaleTo?: number; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(1);
  const reduce = useReducedMotion();
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        if (!reduce) s.value = withTiming(scaleTo, { duration: motion.duration.instant });
        if (haptic && !disabled) void Haptics.selectionAsync();
      }}
      onPressOut={() => {
        s.value = withTiming(1, { duration: motion.duration.fast });
      }}
      onPress={onPress}
      disabled={disabled}
      style={[aStyle, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Feedback tátil de sucesso/erro para confirmações (usar em ações importantes). */
export const haptics = {
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  tap: () => void Haptics.selectionAsync(),
};

/* ──────────────────────────── Swipe-to-action ──────────────────────────── */

export type SwipeAction = {
  label: string;
  icon?: LucideIcon;
  tone?: 'primary' | 'accent' | 'alert';
  onPress: () => void;
};

const SWIPE_BG: Record<NonNullable<SwipeAction['tone']>, string> = {
  primary: colors.primary,
  accent: colors.accent,
  alert: colors.alert,
};

/**
 * Linha que revela ações ao arrastar para a esquerda (ex.: "Tomei", "Repor",
 * "Excluir"). Gesto direto e rápido — bom p/ quem tem dificuldade de mirar em
 * botões pequenos. Usa ReanimatedSwipeable (gesture-handler), roda em Expo Go.
 */
export function SwipeRow({
  children,
  rightActions = [],
  enabled = true,
}: {
  children: ReactNode;
  rightActions?: SwipeAction[];
  enabled?: boolean;
}) {
  if (!enabled || rightActions.length === 0) return <>{children}</>;

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(_progress, _drag, methods) => (
        <View style={{ flexDirection: 'row' }}>
          {rightActions.map((a, i) => {
            const Icon = a.icon;
            return (
              <Pressable
                key={i}
                onPress={() => {
                  methods.close();
                  void Haptics.selectionAsync();
                  a.onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={{
                  width: 84,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  backgroundColor: SWIPE_BG[a.tone ?? 'primary'],
                }}
              >
                {Icon ? <Icon size={20} color="#ffffff" /> : null}
                <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.semibold, color: '#ffffff', fontSize: 12 }}>
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

/* ──────────────────────────── Skeletons ──────────────────────────── */

/**
 * Placeholder de carregamento.
 *
 * ACESSIBILIDADE: a versão anterior TROCAVA o shimmer por um pulso de opacidade
 * `withRepeat(..., -1, true)` quando "reduzir movimento" estava ligado — ou
 * seja, continuava animando infinitamente justamente para quem pediu para não
 * animar. Agora:
 *  - com "reduzir movimento": ESTÁTICO desde o primeiro frame (só o degrau
 *    tonal da superfície comunica "carregando");
 *  - sem "reduzir movimento": a faixa de luz varre no máximo `LOOP_LIMIT` vezes
 *    e para (WCAG SC 2.2.2 — nada em loop indefinido ao lado de conteúdo).
 */
export function Skeleton({
  height = 16,
  width = '100%',
  radius = 10,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (reduce || w === 0) return;
    x.value = 0;
    x.value = withRepeat(
      withTiming(1, { duration: motion.duration.draw, easing: Easing.inOut(Easing.ease) }),
      motion.LOOP_LIMIT,
      false,
    );
  }, [x, reduce, w]);

  // No fim das repetições x = 1: a faixa fica parada FORA da área visível.
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -w + x.value * (2 * w) }] }));

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[
        { height, width, borderRadius: radius, borderCurve: 'continuous', backgroundColor: colors.surface2, overflow: 'hidden' },
        style,
      ]}
    >
      {!reduce && w > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.6)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1, width: w }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/* ──────────────────────────── Número animado (count-up) ──────────────────────────── */

/**
 * Número que sobe suavemente até o valor (ex.: "%", contagens). Usa o truque do
 * TextInput animado (texto via useAnimatedProps) — fluido na UI thread. Respeita
 * reduzir movimento (mostra o valor final direto). `suffix` é concatenado.
 */
export function AnimatedNumber({
  value,
  suffix = '',
  duration = motion.duration.slow,
  style,
  maxFontSizeMultiplier,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  style?: StyleProp<TextStyle>;
  maxFontSizeMultiplier?: number;
}) {
  const reduce = useReducedMotion();
  const sv = useSharedValue(0);

  useEffect(() => {
    sv.value = reduce ? value : withTiming(value, { duration, easing: EASE_SIGNATURE });
  }, [sv, value, reduce, duration]);

  // `text` não faz parte dos props animados tipados do TextInput → cast p/ any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const animatedProps = useAnimatedProps<any>(() => {
    const text = `${Math.round(sv.value)}${suffix}`;
    return { text, defaultValue: text };
  });

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      caretHidden
      // O valor real é dirigido por animatedProps; deixamos um valor inicial coerente.
      value={`${Math.round(reduce ? value : 0)}${suffix}`}
      underlineColorAndroid="transparent"
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={style}
      animatedProps={animatedProps}
      accessibilityLabel={`${Math.round(value)}${suffix}`}
    />
  );
}

/** Barra de progresso que preenche suave (0→percent). Respeita reduzir movimento. */
export function AnimatedBar({
  percent,
  color,
  height = 8,
  track = colors.line,
}: {
  percent: number;
  color: string;
  height?: number;
  track?: string;
}) {
  const reduce = useReducedMotion();
  const w = useSharedValue(0);
  const target = Math.max(0, Math.min(100, percent));
  useEffect(() => {
    w.value = reduce ? target : withTiming(target, { duration: motion.duration.slow, easing: EASE_SIGNATURE });
  }, [w, target, reduce]);
  const st = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={{ height, width: '100%', borderRadius: 999, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: 999, backgroundColor: color }, st]} />
    </View>
  );
}

/** Skeleton de cartão (lista) — placeholder enquanto carrega. */
export function SkeletonCard() {
  return (
    <View
      style={{ borderRadius: 24, borderCurve: 'continuous' }}
      className="flex-row items-center gap-3 border border-line bg-surface p-4"
    >
      <Skeleton height={44} width={44} radius={16} />
      <View className="flex-1 gap-2">
        <Skeleton height={14} width={'70%'} />
        <Skeleton height={11} width={'45%'} />
      </View>
    </View>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
