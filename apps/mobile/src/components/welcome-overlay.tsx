import { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { motion } from '@hubpatients/ui-tokens';
import { fonts, gradients } from '@/theme';
import APP_ICON from '../../assets/icon.png';

const { duration, springPhysics, LOOP_LIMIT } = motion;

// Ícone da marca (o "app tile") — mesmo arquivo do launcher, gerado de img/icon.png.

/** Meio ciclo da "respiração" do tile/halo. Não responde a toque, então pode
 *  passar do teto de 400 ms da faixa de interação. */
const BREATH_MS = 900;
/** Opacidade de repouso do halo — é onde ele começa E onde ele termina. */
const GLOW_REST = 0.4;

/**
 * Splash de boas-vindas exibido ao entrar no app (após login): gradiente da marca
 * (royal → elétrico), o ícone do HubPatients surgindo com mola + pulso, e título
 * com entrada escalonada. Some sozinho (montagem condicional no pai) com FadeOut.
 *
 * ACESSIBILIDADE (era o único componente animado do app que ignorava a
 * preferência do sistema):
 *  - `useReducedMotion()`: com a preferência ligada NADA se move — o overlay já
 *    nasce no estado final (mesma composição, sem deslocamento nenhum);
 *  - a respiração do tile e do halo é limitada a `LOOP_LIMIT` ciclos mesmo sem
 *    "reduzir movimento": WCAG SC 2.2.2 proíbe loop indefinido ao lado de
 *    conteúdo. Depois disso os dois ficam estáticos no valor de repouso.
 */
export function WelcomeOverlay() {
  const reduce = useReducedMotion();
  const scale = useSharedValue(reduce ? 1 : 0.7);
  const glow = useSharedValue(GLOW_REST);

  useEffect(() => {
    if (reduce) {
      // Estado final estático, idêntico ao de quem vê a animação inteira.
      scale.value = 1;
      glow.value = GLOW_REST;
      return;
    }
    // Entrada com "overshoot" (back) e depois respiração LIMITADA: cada ciclo
    // vai e volta (reverse=false na sequência já invertida), então o tile
    // termina exatamente em 1 e o halo em GLOW_REST.
    scale.value = withSequence(
      withTiming(1.06, { duration: duration.slow, easing: Easing.out(Easing.back(1.7)) }),
      withRepeat(
        withSequence(withTiming(1.04, { duration: BREATH_MS }), withTiming(1, { duration: BREATH_MS })),
        LOOP_LIMIT,
        false,
      ),
    );
    glow.value = withRepeat(
      withSequence(withTiming(0.9, { duration: BREATH_MS }), withTiming(GLOW_REST, { duration: BREATH_MS })),
      LOOP_LIMIT,
      false,
    );
  }, [scale, glow, reduce]);

  const tileStyle = useAnimatedStyle(() => ({ transform: [{ scale: reduce ? 1 : scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    // Opacidade continua valendo sob "reduzir movimento"; a escala, não.
    opacity: glow.value,
    transform: [{ scale: reduce ? 1 + GLOW_REST * 0.3 : 1 + glow.value * 0.3 }],
  }));

  // Sob "reduzir movimento" os textos entram só por opacidade (sem subir).
  // Fora dele, mola `springPhysics.calm` (ζ = 1,0) — sem overshoot.
  const calm = (delay: number) =>
    FadeInDown.delay(delay)
      .springify()
      .damping(springPhysics.calm.damping)
      .mass(springPhysics.calm.mass)
      .stiffness(springPhysics.calm.stiffness);
  const titleEnter = reduce ? FadeIn.duration(duration.base) : calm(duration.base);
  const taglineEnter = reduce ? FadeIn.duration(duration.base) : calm(duration.base + duration.fast);

  return (
    <Animated.View
      entering={FadeIn.duration(duration.base)}
      exiting={FadeOut.duration(duration.slow)}
      style={StyleSheet.absoluteFill}
    >
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
        <View className="items-center">
          {/* Halo pulsante atrás do ícone */}
          <View className="items-center justify-center">
            <Animated.View style={[styles.glow, glowStyle]} />
            <Animated.View style={[styles.tile, tileStyle]}>
              <Image source={APP_ICON} style={styles.icon} resizeMode="contain" />
            </Animated.View>
          </View>

          <Animated.Text entering={titleEnter} style={[styles.title, { fontFamily: fonts.displayX }]}>
            HubPatients
          </Animated.Text>
          <Animated.Text entering={taglineEnter} style={[styles.tagline, { fontFamily: fonts.regular }]}>
            Sua saúde, seu controle 💙
          </Animated.Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 168, height: 168, borderRadius: 84, backgroundColor: 'rgba(255,255,255,0.16)' },
  tile: {
    height: 104,
    width: 104,
    borderRadius: 26,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  icon: { height: 104, width: 104, borderRadius: 26 },
  title: { marginTop: 24, fontSize: 34, color: '#ffffff', letterSpacing: 0.5 },
  tagline: { marginTop: 6, fontSize: 15, color: 'rgba(255,255,255,0.88)' },
});
