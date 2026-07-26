import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Home, NotebookPen, Pill, LayoutGrid, type LucideIcon } from 'lucide-react-native';
import { motion } from '@hubpatients/ui-tokens';
import { useColors, fonts, shadowRaised, useSeniorMode, useFontScale, useTabBarStyle } from '@/theme';

const { springPhysics } = motion;

// Tipo mínimo das props do tabBar (evita importar @react-navigation/bottom-tabs).
type TabRoute = { key: string; name: string };
type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
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
 * ─────────────────── DUAS APARÊNCIAS, TEMPORARIAMENTE ───────────────────
 * O Rafael achou o sólido "sem graça" e quer comparar no aparelho. Então
 * existem duas versões, escolhidas por `useTabBarStyle()`:
 *
 *  · 'solid'  — ancorada, opaca, com refino (gradiente sutil, borda de luz
 *    no topo e cápsula em TINT do azul em vez do azul cheio, que era o que
 *    pesava). Contraste 100% determinístico.
 *
 *  · 'glass'  — flutuante com desfoque real (`expo-blur`), na linguagem do
 *    Liquid Glass. Liquid Glass DE VERDADE é exclusivo do iOS 26
 *    (`expo-glass-effect` cai para View comum fora dele) e este app é
 *    Android, então aqui é imitação honesta: desfoque + borda especular.
 *    Para o vidro não custar legibilidade, três travas:
 *      1. PISO DE OPACIDADE no tint (0,90 claro / 0,86 escuro) — nunca
 *         fica transparente o bastante para o fundo comer o rótulo;
 *      2. cápsula do ativo 100% OPACA — o estado selecionado jamais
 *         depende do que está passando atrás (SC 1.4.11);
 *      3. Modo Sênior força 'solid', ignorando a escolha — quem ligou o
 *         Modo Sênior declarou que precisa de legibilidade, não de efeito.
 *
 * Quando ele escolher, a perdedora sai daqui e `useTabBarStyle` vai embora.
 *
 * `expo-blur` já estava instalado e presente no APK 0.4.0, então voltar a
 * usá-lo sai por OTA — sem build novo.
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
  const { style: chosen } = useTabBarStyle();
  // Mesma regra do render: Modo Sênior força o sólido.
  const glass = !senior && chosen === 'glass';
  const s = senior ? SIZES.senior : SIZES.normal;
  const label = Math.round(LABEL.line * fontFactor);
  const conteudo = PAD_TOP + Math.max(s.item, s.pillH + GAP + label);
  // O vidro flutua: soma o próprio respiro de baixo (8) mais a folga do gesto.
  return glass ? conteudo + 8 + insets.bottom + 8 + 16 : conteudo + insets.bottom + 16;
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

  // Modo Sênior IGNORA a escolha e força o sólido (ver cabeçalho).
  const { style: chosen } = useTabBarStyle();
  const variant = senior ? 'solid' : chosen;
  const glass = variant === 'glass';

  const tabRoutes = state.routes.filter((r) => TAB_CONFIG[r.name]);
  const focusedKey = state.routes[state.index]?.key;
  const activeIndex = Math.max(0, tabRoutes.findIndex((r) => r.key === focusedKey));

  // Vidro flutua com margem lateral; sólido é ancorado e usa a largura cheia
  // (alvo maior, encostado na borda da tela — Lei de Fitts).
  const sideMargin = glass ? 12 : 0;
  // Desconta a borda de 1px de cada lado no vidro: sem isso a soma das abas
  // fica 2px mais larga que a caixa interna e a última encosta/corta.
  const barWidth = width - sideMargin * 2 - (glass ? 2 : 0);
  const tabWidth = barWidth / Math.max(1, tabRoutes.length);

  /*
   * Cápsula do ativo — a diferença central entre as duas aparências.
   *
   * No VIDRO ela é OPACA (primary cheio) e o ícone vai na tinta de contraste:
   * o estado selecionado não pode depender do que passa atrás (SC 1.4.11).
   *
   * No SÓLIDO ela é um TINT com CONTORNO. O azul cheio era o que pesava e
   * deixava tudo "chapado"; só que um tint sozinho tem 1,27:1 contra a barra,
   * ou seja, a FORMA quase desaparece — e é justamente a forma que faz o
   * público idoso achar o alvo rápido. O contorno na cor cheia resolve os dois:
   * ícone/rótulo em primary sobre o tint dão 6,54:1 (claro) e 5,19:1 (escuro),
   * e a borda define a cápsula com 8,28:1.
   */
  const onPill = dark ? colors.bg : colors.white;
  const pillFill = glass ? colors.primary : dark ? '#31374a' : '#dce5f6';
  const pillBorder = glass ? 'transparent' : colors.primary;
  const activeInk = glass ? onPill : colors.primary;

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

  const rows = (
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
            borderWidth: glass ? 0 : 1.5,
            borderColor: pillBorder,
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
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
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
                  color={focused ? activeInk : colors.muted}
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

  // ── SÓLIDO: ancorado, com gradiente sutil e hairline de 3:1 no topo ───────
  if (!glass) {
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
          {rows}
        </LinearGradient>
      </View>
    );
  }

  // ── VIDRO: flutuante, desfoque real, com piso de opacidade ────────────────
  return (
    <View
      style={{ position: 'absolute', left: sideMargin, right: sideMargin, bottom: insets.bottom + 8 }}
      pointerEvents="box-none"
    >
      <View
        style={[
          {
            borderRadius: 28,
            borderCurve: 'continuous',
            overflow: 'hidden',
            borderWidth: 1,
            // Borda especular: no escuro é a luz na quina do vidro; no claro um
            // hairline definido, senão a barra some sobre fundo claro.
            borderColor: dark ? 'rgba(255,255,255,0.16)' : colors.line,
            paddingTop: PAD_TOP,
            paddingBottom: 8,
          },
          // Sombra só no claro: no escuro o Android desenha um retângulo cinza
          // em volta do card arredondado em vez de sombra.
          dark ? null : shadowRaised,
        ]}
      >
        {/*
          `experimentalBlurMethod` é OBRIGATÓRIO no Android — sem ele o
          expo-blur não borra nada aqui e a barra fica com aparência quebrada.
          O blur vai como CAMADA DE FUNDO absoluta, não envolvendo o conteúdo:
          BlurView com filhos se comporta mal no Android.
        */}
        <BlurView
          intensity={dark ? 40 : 60}
          tint={dark ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/*
          PISO DE OPACIDADE — a trava que torna o vidro aceitável num app de
          saúde, e também o fallback se o aparelho não borrar.
          Medido no PIOR caso (conteúdo preto atrás, no claro; branco, no
          escuro), com o rótulo inativo: 0,85 dá 5,58:1 e 0,84 dá 4,82:1 —
          ambos passam em AA. Para comparar, o vidro ANTIGO usava 0,62 e 0,55,
          que davam 2,95:1 e 1,74:1: reprovava, e foi por isso que ele saiu.
        */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: dark ? 'rgba(23,23,23,0.84)' : 'rgba(255,255,255,0.85)' },
          ]}
          pointerEvents="none"
        />
        {/* Hairline de luz no topo — o detalhe que dá acabamento de vidro. */}
        <LinearGradient
          colors={
            dark
              ? ['rgba(255,255,255,0.14)', 'transparent']
              : ['rgba(255,255,255,0.9)', 'transparent']
          }
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }}
          pointerEvents="none"
        />
        {rows}
      </View>
    </View>
  );
}
