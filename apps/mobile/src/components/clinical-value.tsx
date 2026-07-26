import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useColors, useType, fonts, radius, space, status, statusMeta } from '@/theme';

/**
 * Valor clínico — o "número-herói" do redesign "Papel Clínico Quente + Expressivo"
 * (docs/REDESIGN-2026-07.md §§1, 4, 5).
 *
 * Anatomia, de cima para baixo:
 *   rótulo → número grande + unidade menor ALINHADA PELA BASELINE → status → frase
 *
 * Três regras que este componente existe para garantir:
 *  1. Nenhum número sem contexto. O Gentler Streak (Apple Design Award 2024)
 *     evitou deliberadamente "números sem contexto"; aqui `context` é a frase que
 *     interpreta o valor ("2 kg a menos que no mês passado").
 *  2. Cor NUNCA sozinha (WCAG SC 1.4.1). Passar `status` renderiza SEMPRE o
 *     glifo + o rótulo de `statusMeta` — não existe modo "só a cor".
 *  3. Vermelho e âmbar pertencem ao SISTEMA, não ao corpo do paciente. Valor de
 *     exame fora da faixa usa `status="attention"`/`"alert"` apenas para dizer
 *     ACIMA/ABAIXO do intervalo do laboratório — nós não interpretamos resultado.
 *
 * Dígitos: usa `fontVariant: ['tabular-nums']` (prop nativa do RN) para que a
 * largura do dígito não "dance" ao atualizar o valor.
 * TODO(APK 0.4.0): trocar `fonts.bold`/`fonts.semibold` por `fonts.numBold`/
 * `fonts.num` (Atkinson Hyperlegible Mono). A fonte é asset nativo e NÃO entra
 * por OTA — enquanto o binário for o 0.2.0, apontar para ela cairia na fonte do
 * sistema. Só mexer aqui depois que o APK novo sair.
 */

/** Status clínico — mesmas chaves de `statusMeta` (ui-tokens). */
export type ClinicalStatus = keyof typeof statusMeta;

/** `md` = linha de lista · `lg` = card · `xl` = número-herói (um por tela). */
export type ClinicalValueSize = 'md' | 'lg' | 'xl';

export type ClinicalValueProps = {
  /** Rótulo acima do número. Title case — CAPS é proibido no sistema. */
  label: string;
  /** Já formatado pela tela (Hermes não tem Intl: formatar manualmente). */
  value: string | number;
  /** Unidade ao lado do número, menor e na mesma baseline. Ex.: "kg", "mg/dL". */
  unit?: string;
  /** Frase que interpreta o valor. Sem ela, o número fica sem contexto. */
  context?: string;
  /** Renderiza o chip de status (glifo + rótulo + tinta). */
  status?: ClinicalStatus;
  /**
   * Substitui o rótulo padrão de `statusMeta` (que fala em intervalo de
   * laboratório). Use quando o status for do SISTEMA — ex.: "Dose atrasada".
   */
  statusLabel?: string;
  size?: ClinicalValueSize;
  align?: 'left' | 'center';
  /** Sobrescreve a frase lida pelo leitor de tela (o padrão junta tudo). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function ClinicalValue({
  label,
  value,
  unit,
  context,
  status: statusName,
  statusLabel,
  size = 'lg',
  align = 'left',
  accessibilityLabel,
  style,
}: ClinicalValueProps) {
  const colors = useColors();
  const t = useType();
  const { colorScheme } = useColorScheme();
  const tone = statusName ? status[colorScheme === 'dark' ? 'dark' : 'light'][statusName] : null;
  const meta = statusName ? statusMeta[statusName] : null;

  // Proporção número:unidade de ~2,4× — a unidade acompanha, não compete.
  const valueType = size === 'xl' ? t.dataXl : size === 'lg' ? t.dataLg : t.data;
  const unitType = size === 'xl' ? t.data : size === 'lg' ? t.dataSm : t.dataUnit;

  const centered = align === 'center';
  const text = String(value);
  const toneText = statusLabel ?? meta?.label;

  // Uma frase só para o leitor de tela: rótulo, valor, unidade, status, contexto.
  const spoken =
    accessibilityLabel ??
    [`${label}: ${text}${unit ? ` ${unit}` : ''}`, toneText, context].filter(Boolean).join('. ');

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={spoken}
      style={[{ gap: space[1], alignItems: centered ? 'center' : 'flex-start' }, style]}
    >
      <Text style={[t.label, { color: colors.muted, textAlign: centered ? 'center' : 'left' }]}>
        {label}
      </Text>

      {/* Text aninhado: é o que garante a mesma baseline em iOS e Android
          (uma Row com alignItems:'baseline' quebra quando a fonte escala). */}
      <Text
        style={[
          valueType,
          { color: colors.fg, fontVariant: ['tabular-nums'], textAlign: centered ? 'center' : 'left' },
        ]}
      >
        {text}
        {unit ? <Text style={[unitType, { color: colors.muted }]}>{` ${unit}`}</Text> : null}
      </Text>

      {tone && meta ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2] - 2,
            alignSelf: centered ? 'center' : 'flex-start',
            marginTop: space[1],
            paddingHorizontal: space[3],
            paddingVertical: space[1],
            borderRadius: radius.full,
            borderWidth: 1,
            backgroundColor: tone.tint,
            borderColor: tone.mark,
          }}
        >
          {/* O glifo é o sinal NÃO-cromático: ✓ ↑ ↓ • i (SC 1.4.1). */}
          <Text style={[t.caption, { fontFamily: fonts.bold, color: tone.ink }]}>{meta.glyph}</Text>
          <Text style={[t.caption, { color: tone.ink, flexShrink: 1 }]}>{toneText}</Text>
        </View>
      ) : null}

      {context ? (
        <Text
          style={[t.caption, { color: colors.muted, textAlign: centered ? 'center' : 'left' }]}
        >
          {context}
        </Text>
      ) : null}
    </View>
  );
}
