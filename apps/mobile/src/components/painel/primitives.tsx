/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRIMITIVAS DO PAINEL — mobile
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Espelho de `apps/web/src/components/ui/painel/primitives.tsx`: MESMOS nomes,
 * MESMA API conceitual, MESMOS tokens (@hubpatients/ui-tokens). Mudou a
 * assinatura de um lado? Muda do outro, no mesmo commit.
 *
 * REGRAS QUE ESTES COMPONENTES FAZEM VALER SOZINHOS:
 *
 *  1. MODO SÊNIOR — nenhum `fontSize` literal em `style`. Tudo passa por
 *     `useType()` / `useFontScaler()`, que aplicam o fator (Modo Sênior ×
 *     fonte do sistema, com clamp 1,0–2,0). O Tailwind do NativeWind resolve
 *     classes em tempo de build e o Jest não as enxerga — por isso tamanho vive
 *     em `style`, e é isso que torna o Modo Sênior testável.
 *  2. ALVO DE TOQUE — `useTapTarget()` (44px, 56 no Modo Sênior) como
 *     `minHeight`, nunca `height`: com a fonte ampliada o componente CRESCE em
 *     vez de cortar o rótulo.
 *  3. COR NO CORPO DO PACIENTE — `tone` é CATEGORIA. A paleta não tem verde,
 *     âmbar nem vermelho para escolher.
 *  4. SEM `Intl` — nada aqui formata data ou número por conta própria. Hermes
 *     derruba o app com `Intl`; formatação vem pronta de `@hubpatients/core`.
 */

import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Plus, type LucideIcon } from 'lucide-react-native';
import { CHIP_TONES, chipToneFor, type ChipTone } from '@hubpatients/ui-tokens';
import {
  fonts,
  radius,
  space,
  useChipPastel,
  useColors,
  useFontScaler,
  usePainelShadow,
  useTapTarget,
  useType,
} from '@/theme';
import { PressableScale } from '../feedback';

export type { ChipTone };
export { CHIP_TONES, chipToneFor };

/** Canto contínuo (iOS) — o mesmo detalhe do resto do app. */
const CONTINUOUS = { borderCurve: 'continuous' as const };

/* ══════════════════════════════ Superfície ══════════════════════════════ */

export interface PanelCardProps {
  children: ReactNode;
  className?: string;
  elevation?: 'plain' | 'raised' | 'dashed';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Cartão do Painel: superfície, canto de 16px, borda clara, sombra sutil. */
export function PanelCard({
  children,
  className = '',
  elevation = 'plain',
  onPress,
  style,
}: PanelCardProps) {
  // No tema escuro isto devolve degrau tonal + hairline: sombra não se lê sobre
  // preto, e o hook resolve a regra para a tela não ter que lembrar dela.
  const sombra = usePainelShadow(elevation === 'raised' ? 'raised' : 'card');
  const conteudo = (
    <View
      style={[
        CONTINUOUS,
        { borderRadius: radius.md },
        elevation === 'dashed' ? null : sombra,
        style,
      ]}
      className={`border bg-surface p-4 ${
        elevation === 'dashed' ? 'border-dashed border-line' : 'border-line'
      } ${className}`}
    >
      {children}
    </View>
  );
  return onPress ? <PressableScale onPress={onPress}>{conteudo}</PressableScale> : conteudo;
}

/* ══════════════════════════════ Chip de ícone ══════════════════════════════ */

export interface IconChipProps {
  icon: LucideIcon;
  /**
   * Cor de CATEGORIA (de que assunto é o cartão). Omita e derivamos de `seed`:
   * a mesma seção fica com a mesma cor na web e aqui, sem tabela duplicada.
   *
   * ⚠️ Não existe tom de gravidade — nenhum cartão pode nascer "grave".
   */
  tone?: ChipTone;
  seed?: string;
  size?: 'sm' | 'md' | 'lg';
}

const CHIP_BOX = { sm: 32, md: 40, lg: 48 } as const;

export function IconChip({ icon: Icon, tone, seed, size = 'md' }: IconChipProps) {
  const paleta = useChipPastel();
  const tom = tone ?? (seed ? chipToneFor(seed) : 'azul');
  const cor = paleta[tom];
  const lado = CHIP_BOX[size];
  return (
    <View
      // Decorativo: o significado está no rótulo ao lado, então o leitor de
      // tela não deve anunciar o chip.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        CONTINUOUS,
        {
          width: lado,
          height: lado,
          borderRadius: size === 'sm' ? radius.sm : radius.sm + 2,
          backgroundColor: cor.tint,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Icon size={Math.round(lado * 0.5)} color={cor.ink} />
    </View>
  );
}

/* ══════════════════════════════ Botão ══════════════════════════════ */

export interface PanelButtonProps {
  label: string;
  onPress?: () => void;
  /** Rota do expo-router. Ignorado quando há `onPress`. */
  href?: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'ghost' | 'quiet';
  size?: 'md' | 'sm';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Botão do Painel — canto totalmente arredondado no `primary`, como no desenho.
 *
 * `minHeight` (não `height`): com a fonte ampliada o botão cresce e o rótulo
 * pode ir para duas linhas em vez de ser cortado.
 */
export function PanelButton({
  label,
  onPress,
  href,
  icon: Icon,
  variant = 'primary',
  size = 'md',
  disabled,
  style,
}: PanelButtonProps) {
  const colors = useColors();
  const fs = useFontScaler();
  const tap = useTapTarget();
  const router = useRouter();

  const preenchido = variant === 'primary';
  const corTexto = preenchido ? colors.white : variant === 'quiet' ? colors.primary : colors.fg;
  const fundo = preenchido
    ? { backgroundColor: colors.primary }
    : variant === 'secondary'
      ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong }
      : null;

  return (
    <PressableScale
      onPress={onPress ?? (href ? () => router.push(href as never) : undefined)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        CONTINUOUS,
        {
          borderRadius: radius.full,
          minHeight: size === 'sm' ? tap : tap + 6,
          paddingHorizontal: size === 'sm' ? space[4] : space[5],
          paddingVertical: space[2],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[2],
        },
        fundo,
        disabled ? { opacity: 0.6 } : null,
        style,
      ]}
    >
      {Icon ? <Icon size={18} color={corTexto} /> : null}
      <Text
        maxFontSizeMultiplier={1.4}
        style={[
          { fontFamily: fonts.semibold, color: corTexto, flexShrink: 1, textAlign: 'center' },
          fs(15, 20),
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

/* ══════════════════════════════ Selo ══════════════════════════════ */

/**
 * Selo informativo ("Dados protegidos • LGPD"). NÃO é status: não muda de cor,
 * não alerta. Para erro/atraso do sistema existe o chip de status.
 */
export function Seal({ icon: Icon, label }: { icon?: LucideIcon; label: string }) {
  const colors = useColors();
  const fs = useFontScaler();
  return (
    <View
      style={[
        CONTINUOUS,
        {
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surface,
          paddingHorizontal: space[3],
          paddingVertical: space[1] + 2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[1] + 2,
          alignSelf: 'flex-start',
        },
      ]}
    >
      {Icon ? <Icon size={14} color={colors.primary} /> : null}
      <Text style={[{ fontFamily: fonts.medium, color: colors.muted }, fs(13, 18)]}>{label}</Text>
    </View>
  );
}

/* ══════════════════════════════ Cabeçalho de página ══════════════════════════════ */

export interface PageHeaderProps {
  /**
   * Data por extenso ("Quarta-feira, 5 de Agosto"), JÁ FORMATADA por quem
   * chama, com os utilitários de data em PT-BR do `@hubpatients/core`.
   *
   * ⚠️ NUNCA `Intl` aqui: no Hermes ele derruba o app (dois incidentes reais —
   * `RelativeTimeFormat` e `DateTimeFormat` com dateStyle/timeStyle).
   */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, right }: PageHeaderProps) {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? (
          <Text style={[{ fontFamily: fonts.semibold, color: colors.primary }, fs(13, 18)]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
          style={[{ fontFamily: fonts.displayX, color: colors.fg, marginTop: 2 }, fs(26, 32)]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[t.bodySm, { color: colors.muted, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/* ══════════════════════════════ Cabeçalho de seção ══════════════════════════════ */

export interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  tone?: ChipTone;
  /** Rota do "Ver todos". */
  href?: string;
  actionLabel?: string;
  action?: ReactNode;
}

export function SectionHeader({
  title,
  icon: Icon,
  tone,
  href,
  actionLabel = 'Ver todos',
  action,
}: SectionHeaderProps) {
  const colors = useColors();
  const fs = useFontScaler();
  const tap = useTapTarget();
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[2],
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2] + 2 }}>
        {Icon ? <IconChip icon={Icon} tone={tone} seed={title} size="sm" /> : null}
        <Text
          accessibilityRole="header"
          style={[{ fontFamily: fonts.display, color: colors.fg, flex: 1 }, fs(17, 23)]}
        >
          {title}
        </Text>
      </View>
      {action ??
        (href ? (
          <PressableScale
            onPress={() => router.push(href as never)}
            accessibilityRole="link"
            accessibilityLabel={`${actionLabel}: ${title}`}
            style={{
              minHeight: tap,
              paddingHorizontal: space[2],
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Text style={[{ fontFamily: fonts.semibold, color: colors.primary }, fs(13, 18)]}>
              {actionLabel}
            </Text>
            <ChevronRight size={16} color={colors.primary} />
          </PressableScale>
        ) : null)}
    </View>
  );
}

/* ══════════════════════════════ Cartão de métrica ══════════════════════════════ */

export interface StatCardProps {
  icon: LucideIcon;
  tone?: ChipTone;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  onPress?: () => void;
  /** `true` quando o valor é medida do corpo — usa a mono de largura tabular. */
  clinical?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Chip de ícone, rótulo pequeno, valor grande, dica e chevron — como no desenho. */
export function StatCard({
  icon,
  tone,
  label,
  value,
  hint,
  href,
  onPress,
  clinical,
  style,
}: StatCardProps) {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  const router = useRouter();
  const acao = onPress ?? (href ? () => router.push(href as never) : undefined);

  return (
    <PanelCard
      onPress={acao}
      style={[{ flex: 1, minWidth: 150 }, style]}
      // Uma leitura só para o leitor de tela: "Peso, 78,4 kg, ontem".
    >
      <View
        accessible
        accessibilityRole={acao ? 'button' : 'text'}
        accessibilityLabel={[label, value, hint].filter(Boolean).join(', ')}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <IconChip icon={icon} tone={tone} seed={label} />
          {acao ? <ChevronRight size={20} color={colors.hint} /> : null}
        </View>
        <Text
          style={[{ fontFamily: fonts.medium, color: colors.muted, marginTop: space[3] }, fs(13, 18)]}
        >
          {label}
        </Text>
        <Text
          style={[
            clinical ? t.dataLg : { fontFamily: fonts.displayX, ...fs(24, 30) },
            { color: colors.fg, marginTop: 2 },
          ]}
        >
          {value}
        </Text>
        {hint ? (
          <Text
            maxFontSizeMultiplier={1.4}
            style={[{ fontFamily: fonts.regular, color: colors.hint, marginTop: 2 }, fs(13, 18)]}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </PanelCard>
  );
}

/** Fileira de cartões de métrica que quebra linha em telas estreitas. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>{children}</View>
  );
}

/* ══════════════════════════════ Estado vazio ══════════════════════════════ */

export interface EmptyStateProps {
  /** Ilustração própria (frasco, calendário). Decorativa. */
  illustration?: ReactNode;
  icon?: LucideIcon;
  tone?: ChipTone;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

/**
 * Estado vazio ILUSTRADO. Vazio não é erro: é "ainda não há nada aqui, e é
 * assim que começa". Falha de carregamento tem componente próprio.
 */
export function EmptyState({
  illustration,
  icon: Icon,
  tone = 'ardosia',
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  const router = useRouter();
  const acao = onAction ?? (actionHref ? () => router.push(actionHref as never) : undefined);

  return (
    <View
      style={[
        CONTINUOUS,
        {
          borderRadius: radius.md,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.line,
          paddingHorizontal: space[6],
          paddingVertical: space[10],
          alignItems: 'center',
          gap: space[2],
        },
      ]}
    >
      {illustration ?? (Icon ? <IconChip icon={Icon} tone={tone} size="lg" /> : null)}
      <Text
        style={[
          { fontFamily: fonts.semibold, color: colors.fgSoft, textAlign: 'center' },
          fs(17, 24),
        ]}
      >
        {title}
      </Text>
      {description ? (
        <Text style={[t.bodySm, { color: colors.muted, textAlign: 'center' }]}>{description}</Text>
      ) : null}
      {actionLabel && acao ? (
        <PanelButton
          label={actionLabel}
          icon={Plus}
          onPress={acao}
          size="sm"
          style={{ marginTop: space[2] }}
        />
      ) : null}
    </View>
  );
}

/* ══════════════════════════════ Ações rápidas ══════════════════════════════ */

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  href?: string;
  onPress?: () => void;
  tone?: ChipTone;
}

/** Barra de ações rápidas: ícone + rótulo, lado a lado. */
export function QuickActions({
  actions,
  label = 'Ações rápidas',
}: {
  actions: QuickAction[];
  label?: string;
}) {
  const colors = useColors();
  const fs = useFontScaler();
  const tap = useTapTarget();
  const router = useRouter();
  return (
    <View
      accessibilityRole="menu"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}
    >
      {actions.map((acao) => (
        <PressableScale
          key={acao.label}
          onPress={acao.onPress ?? (acao.href ? () => router.push(acao.href as never) : undefined)}
          accessibilityRole="button"
          accessibilityLabel={acao.label}
          style={[
            CONTINUOUS,
            {
              flexGrow: 1,
              flexBasis: 150,
              minHeight: tap,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.surface,
              paddingHorizontal: space[3],
              paddingVertical: space[2],
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[2] + 2,
            },
          ]}
        >
          <IconChip icon={acao.icon} tone={acao.tone} seed={acao.label} size="sm" />
          <Text style={[{ fontFamily: fonts.medium, color: colors.fg, flex: 1 }, fs(15, 20)]}>
            {acao.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}
