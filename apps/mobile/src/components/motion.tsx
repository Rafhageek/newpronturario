import { type ReactNode, useMemo, useRef } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  FadeIn,
  FadeOut,
  FadeOutDown,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { motion, staggerDelay } from '@hubpatients/ui-tokens';

const { duration, springPhysics } = motion;

/**
 * Entrada animada com "stagger" POR ÍNDICE E COM TETO (cards de lista, grids).
 * Spring-based — não misturar com .duration()/.easing() (regra Reanimated).
 * Respeita "reduzir movimento" do sistema (a11y): cai para fade simples, sem
 * qualquer deslocamento.
 *
 * Duas correções de acessibilidade em relação à versão anterior:
 *  1. o atraso usa `staggerDelay(index)` (teto de 6 × 45 = 270 ms). Antes era
 *     `index * 55` sem teto: o 20º item entrava 1,1 s depois do primeiro —
 *     além do limite de fluxo de 1 s (NN/g);
 *  2. a mola passou a ser `springPhysics.calm` (ζ = 1,0). A anterior tinha
 *     ζ ≈ 0,81, ou seja, overshoot visível a cada item da lista.
 *
 * `animateExit` liga saída + reflow suave (item some/desliza ao ser removido e
 * a lista reorganiza com mola) — opt-in p/ não surpreender telas que só montam.
 */
export function FadeInItem({
  children,
  index = 0,
  style,
  animateExit = false,
}: {
  children: ReactNode;
  index?: number;
  style?: ViewStyle;
  animateExit?: boolean;
}) {
  const reduce = useReducedMotion();

  // O índice é CONGELADO na montagem. Sem isso, cada refetch/troca de filtro que
  // reordena a lista recria o descritor de entrada de todos os itens já
  // visíveis — e a lista inteira volta a "entrar" a cada atualização de dados.
  // O item novo (que realmente monta agora) continua animando normalmente.
  const mountIndex = useRef(index);

  const entering = useMemo(
    () =>
      reduce
        ? FadeIn.duration(duration.base)
        : FadeInDown.delay(staggerDelay(mountIndex.current))
            .springify()
            .damping(springPhysics.calm.damping)
            .mass(springPhysics.calm.mass)
            .stiffness(springPhysics.calm.stiffness),
    [reduce],
  );

  const exiting = !animateExit
    ? undefined
    : reduce
      ? FadeOut.duration(duration.fast)
      : FadeOutDown.duration(duration.base);

  // Sob "reduzir movimento" NÃO há reordenação animada: a lista reorganiza seca.
  const layout =
    animateExit && !reduce
      ? LinearTransition.springify()
          .damping(springPhysics.calm.damping)
          .mass(springPhysics.calm.mass)
          .stiffness(springPhysics.calm.stiffness)
      : undefined;

  return (
    <Animated.View entering={entering} exiting={exiting} layout={layout} style={style}>
      {children}
    </Animated.View>
  );
}

/** Fade simples (hero, blocos de topo). */
export function FadeInBlock({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  const entering = useMemo(
    () => (reduce ? FadeIn.duration(duration.base) : FadeIn.delay(delay).duration(duration.slow)),
    [delay, reduce],
  );
  return <Animated.View entering={entering}>{children}</Animated.View>;
}
