import { useEffect } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Home, NotebookPen, Pill, LayoutGrid, type LucideIcon } from 'lucide-react-native';
import { motion } from '@hubpatients/ui-tokens';
import { useColors, fonts, useSeniorMode, useFontScale } from '@/theme';

const { springPhysics } = motion;

// Tipo mínimo das props do tabBar (evita importar @react-navigation/bottom-tabs).
type TabRoute = { key: string; name: string };
type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
  };
};

// Quatro destinos frequentes; exames e consultas permanecem no prontuário em Mais.
const TAB_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Início', icon: Home },
  diario: { label: 'Diário', icon: NotebookPen },
  medicamentos: { label: 'Medicamentos', icon: Pill },
  mais: { label: 'Mais', icon: LayoutGrid },
};

/*
 * ════════════════════════ "Cápsula Clínica" ════════════════════════
 * Barra ANCORADA e SÓLIDA, com cápsula preenchida atrás do ícone ativo.
 * Medidas vindas dos tokens da navigation bar do Material 3 (indicador
 * 56×32, ícone 24, rótulo label-medium 12/16, folga ícone→rótulo 4).
 *
 * Por que cápsula preenchida e não a linha fina de antes: a pesquisa do
 * M3 Expressive (Google Design, 10 apps testados) mediu que o desenho
 * com CONTENÇÃO — forma preenchida em volta do alvo — fez usuários
 * IDOSOS localizarem os elementos interativos tão rápido quanto os
 * jovens. Nosso público é majoritariamente idoso; a linha de 3px era
 * justamente o padrão fraco que essa pesquisa desaconselha.
 *
 * Por que sólido e não vidro: sobre blur o contraste depende do que
 * está rolando ATRÁS da barra — não dá para garantir (nem testar) os
 * 4,5:1 do rótulo. Aqui todos os pares são fixos e verificados:
 *   claro  — cápsula #0442bf vs barra 8,28:1 · ícone branco na cápsula 8,28:1
 *   escuro — cápsula #8ba9ff vs barra 7,87:1 · ícone quase-preto 8,53:1
 *
 * REFINO: a cápsula é um TINT do azul com CONTORNO na cor cheia, não o azul
 * maciço — este último pesava e deixava a barra "chapada". O contorno não é
 * enfeite: o tint sozinho dá 1,27:1 contra a barra, ou seja, a FORMA quase
 * desaparece, e é a forma preenchida que faz o público idoso achar o alvo
 * rápido. Com o contorno: ícone e rótulo em 6,54:1 (claro) e 5,19:1 (escuro)
 * sobre o tint, e a borda define a cápsula com 8,28:1.
 *
 * HISTÓRICO: existiu por um tempo uma variante em vidro (desfoque), para o
 * Rafael comparar no aparelho. Ele escolheu o sólido em 2026-07-28 e a
 * variante saiu daqui junto com a preferência `useTabBarStyle`.
 * Nota para quem pensar em ressuscitá-la: Liquid Glass DE VERDADE é exclusivo
 * do iOS 26 (`expo-glass-effect` vira View comum fora dele) e este app é
 * Android; e no Android o `expo-blur` só borra com
 * `experimentalBlurMethod="dimezisBlurView"` — sem isso a barra fica quebrada.
 */

/** Alvo/ícone crescem no Modo Sênior. O TEXTO não entra aqui: quem escala o
 *  rótulo é o `fontFactor`, que já embute o 1,3× do Modo Sênior. */
const SIZES = {
  normal: { item: 56, icon: 24, pillW: 56, pillH: 32 },
  senior: { item: 64, icon: 28, pillW: 64, pillH: 36 },
} as const;

/** Rótulo base (label-medium do M3). Multiplicado por `fontFactor` em tempo de render. */
const LABEL = { size: 12, line: 16 } as const;
const GAP = 4;
const PAD_TOP = 8;

/**
 * Espaço que as telas devem reservar no fim do scroll para não ficarem
 * atrás da barra. Cresce junto com o Modo Sênior e com a fonte do sistema.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  const { enabled: senior } = useSeniorMode();
  const { style: fontFactor } = useFontScale();
  const s = senior ? SIZES.senior : SIZES.normal;
  const label = Math.round(LABEL.line * fontFactor);
  return PAD_TOP + Math.max(s.item, s.pillH + GAP + label) + insets.bottom + 16;
}

export function HubPatientsTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = useColors();
  const reduce = useReducedMotion();
  const { enabled: senior } = useSeniorMode();
  const { style: fontFactor } = useFontScale();
  const dark = colors.bg === '#0d0d0d';

  const s = senior ? SIZES.senior : SIZES.normal;

  const tabRoutes = state.routes.filter((r) => TAB_CONFIG[r.name]);
  const focusedKey = state.routes[state.index]?.key;
  const activeIndex = Math.max(
    0,
    tabRoutes.findIndex((r) => r.key === focusedKey),
  );

  // Barra ancorada usando a largura cheia: alvo maior e encostado na borda da
  // tela, onde o dedo não erra (Lei de Fitts).
  const tabWidth = width / Math.max(1, tabRoutes.length);

  // Tint da cápsula por tema (ver o "REFINO" no cabeçalho para os contrastes).
  const pillFill = dark ? '#31374a' : '#dce5f6';

  const pillX = useSharedValue(activeIndex * tabWidth);
  useEffect(() => {
    const target = activeIndex * tabWidth;
    // "reduzir movimento" = sem deslizamento: a cápsula aparece já na aba ativa.
    if (reduce) {
      pillX.value = target;
      return;
    }
    // ζ = 1,0: alvo que ainda oscila é alvo que mão trêmula erra.
    pillX.value = withSpring(target, springPhysics.responsive);
  }, [activeIndex, tabWidth, pillX, reduce]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value + (tabWidth - s.pillW) / 2 }],
  }));

  const labelSize = Math.round(LABEL.size * fontFactor);
  const labelLine = Math.round(LABEL.line * fontFactor);

  const linhas = (
    <View style={{ flexDirection: 'row' }}>
      {/* Cápsula do item ativo — desliza num eixo só (recomendação do M3). */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            width: s.pillW,
            height: s.pillH,
            borderRadius: 999,
            borderCurve: 'continuous',
            backgroundColor: pillFill,
            borderWidth: 1.5,
            borderColor: colors.primary,
          },
          pillStyle,
        ]}
        pointerEvents="none"
      />

      {tabRoutes.map((route) => {
        const cfg = TAB_CONFIG[route.name];
        if (!cfg) return null;
        const focused = route.key === focusedKey;
        const Icon = cfg.icon;

        const onPress = () => {
          void Haptics.selectionAsync();
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={cfg.label}
            style={{ width: tabWidth, minHeight: s.item, alignItems: 'center' }}
          >
            <View style={{ height: s.pillH, justifyContent: 'center' }}>
              {/*
                  Lucide não tem variante preenchida; o M3 sanciona o
                  fallback ("use a thicker or heavier version of the icon").
                  1,75 → 2,75 é um salto grande de propósito: o delta sutil
                  de antes não se lia em baixa visão.
                */}
              <Icon
                size={s.icon}
                color={focused ? colors.primary : colors.muted}
                strokeWidth={focused ? 2.75 : 1.75}
              />
            </View>
            {/*
                Rótulo SEMPRE visível (NN/g, M3 e a HIG da Apple concordam:
                em toque não existe hover, então esconder o rótulo obrigaria
                a pessoa a navegar para descobrir o que era). Duas linhas
                permitidas: com a fonte ampliada a barra CRESCE em vez de
                cortar o texto.
              */}
            <Text
              numberOfLines={2}
              style={{
                marginTop: GAP,
                paddingHorizontal: 2,
                textAlign: 'center',
                fontFamily: focused ? fonts.bold : fonts.medium,
                fontSize: labelSize,
                lineHeight: labelLine,
                color: focused ? colors.primary : colors.muted,
              }}
            >
              {cfg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopWidth: 1,
        // `lineStrong` (3:1), não a linha decorativa: esta borda é o limite
        // entre navegação e conteúdo, e precisa ser percebida (SC 1.4.11).
        borderTopColor: colors.lineStrong,
      }}
    >
      {/* Gradiente de um degrau só — dá profundidade sem chamar atenção.
            É o "refino" que faltava; nada aqui altera contraste de texto,
            porque o rótulo fica sobre a faixa superior (surface). */}
      <LinearGradient
        colors={[colors.surface, colors.surface2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ paddingTop: PAD_TOP, paddingBottom: insets.bottom }}
      >
        {linhas}
      </LinearGradient>
    </View>
  );
}
