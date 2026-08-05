/**
 * ════════════════════════════════════════════════════════════════════════════
 * ESCALA DE HUMOR — mobile
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Espelho exato de `apps/web/src/components/ui/painel/mood-scale.tsx`. A
 * geometria das cinco carinhas vem de `MOOD_SCALE` (@hubpatients/core), então
 * web e mobile desenham a MESMA curva a partir de um cálculo só.
 *
 * O mockup pedia carinhas de vermelha a verde. Não foi reproduzido: semáforo em
 * dado autorrelatado é o app julgando o que a pessoa sente, e 8% dos homens não
 * distinguem esse vermelho desse verde. A escala continua com cinco opções
 * ordenadas — a ordem só mudou de canal:
 *   curva da boca · inclinação dos olhos · rótulo em texto · posição.
 *
 * A cor marca ESTADO (escolhida / não escolhida), num matiz só. A 1ª e a 5ª
 * opção têm exatamente a mesma cor.
 */

import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  MOOD_SCALE,
  MOOD_QUESTION,
  MOOD_FACE_VIEWBOX,
  MOOD_FACE_RADIUS,
  moodFacePaths,
} from '@hubpatients/core';
import { fonts, radius, space, useColors, useFontScaler, useTapTarget } from '@/theme';

/** Canto contínuo (iOS). */
const CONTINUOUS = { borderCurve: 'continuous' as const };

/**
 * A carinha de um degrau — só traço, numa cor só, recebida por prop.
 * Ela nunca "tem" cor própria: não há como um degrau ficar vermelho por
 * descuido de quem consome.
 */
export function MoodFace({
  value,
  size = 36,
  color,
  strokeWidth = 1.6,
}: {
  value: number;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const { boca, olhoEsquerdo, olhoDireito } = moodFacePaths(value);
  const meio = MOOD_FACE_VIEWBOX / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${MOOD_FACE_VIEWBOX} ${MOOD_FACE_VIEWBOX}`}>
      <Circle
        cx={meio}
        cy={meio}
        r={MOOD_FACE_RADIUS}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Path d={olhoEsquerdo} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
      <Path d={olhoDireito} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
      <Path d={boca} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export interface MoodScaleProps {
  /** Degrau escolhido (1–5) ou `null` quando ainda não há resposta. */
  value: number | null;
  onChange: (value: number) => void;
  question?: string;
  disabled?: boolean;
}

/**
 * Seletor de humor.
 *
 * Cada opção é um `radio` de verdade para o leitor de tela (`accessibilityRole`
 * + `accessibilityState.checked`), e anuncia "Bem — 4 de 5": rótulo E posição.
 * Alvo de toque: `useTapTarget()` (44px, 56 no Modo Sênior).
 */
export function MoodScale({
  value,
  onChange,
  question = MOOD_QUESTION,
  disabled,
}: MoodScaleProps) {
  const colors = useColors();
  const fs = useFontScaler();
  const tap = useTapTarget();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={question}>
      <Text style={[{ fontFamily: fonts.semibold, color: colors.fg }, fs(15, 20)]}>{question}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[3] }}>
        {MOOD_SCALE.map((opcao) => {
          const escolhida = value === opcao.valor;
          return (
            <Pressable
              key={opcao.valor}
              onPress={() => onChange(opcao.valor)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: escolhida, disabled: !!disabled }}
              accessibilityLabel={opcao.descricao}
              style={[
                CONTINUOUS,
                {
                  flexGrow: 1,
                  flexBasis: 88,
                  minHeight: tap,
                  borderRadius: radius.md,
                  borderWidth: escolhida ? 2 : 1,
                  // COR = ESTADO, nunca posição na escala.
                  borderColor: escolhida ? colors.primary : colors.line,
                  backgroundColor: escolhida ? colors.surface2 : colors.surface,
                  paddingVertical: space[3],
                  paddingHorizontal: space[2],
                  alignItems: 'center',
                  gap: space[1] + 2,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
            >
              <MoodFace
                value={opcao.valor}
                color={escolhida ? colors.primary : colors.fgSoft}
                // Traço mais grosso na escolhida: mais um canal de FORMA, que
                // sobrevive ao preto e branco e ao daltonismo.
                strokeWidth={escolhida ? 2.1 : 1.6}
              />
              <Text
                maxFontSizeMultiplier={1.5}
                style={[
                  {
                    fontFamily: escolhida ? fonts.semibold : fonts.medium,
                    color: escolhida ? colors.fg : colors.muted,
                    textAlign: 'center',
                  },
                  fs(13, 18),
                ]}
              >
                {opcao.rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Marcador compacto de um humor já registrado. Carinha + rótulo, nunca só cor. */
export function MoodMark({ value }: { value: number }) {
  const colors = useColors();
  const fs = useFontScaler();
  const opcao = MOOD_SCALE.find((o) => o.valor === Math.round(value)) ?? MOOD_SCALE[2];
  if (!opcao) return null;
  return (
    <View
      accessible
      accessibilityLabel={opcao.descricao}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] + 2 }}
    >
      <MoodFace value={opcao.valor} size={20} color={colors.primary} />
      <Text style={[{ fontFamily: fonts.medium, color: colors.fgSoft }, fs(13, 18)]}>
        {opcao.rotulo}
      </Text>
    </View>
  );
}
