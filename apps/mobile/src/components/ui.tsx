import { type ReactNode } from 'react';
import {
  Text,
  TextInput,
  Pressable,
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, ChevronLeft, CloudOff, RefreshCw, type LucideIcon } from 'lucide-react-native';
import {
  useColors,
  cardShadow,
  shadowRaised,
  fonts,
  gradients,
  useType,
  useTapTarget,
  useFontScaler,
  useFontScale,
} from '@/theme';
import { PressableScale } from './feedback';
import { useTabBarSpace } from './tab-bar';

const CONTINUOUS = { borderCurve: 'continuous' as const };

/* ──────────────────────────── Layout ──────────────────────────── */

export function Screen({
  children,
  scroll = true,
  className = '',
  onRefresh,
  refreshing = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
  /** Habilita "puxar-para-atualizar"; receba aqui o refetch da query. */
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const colors = useColors();
  // Espaço no fim do scroll para o conteúdo não terminar atrás da barra de
  // navegação. Era 96 fixo — no Modo Sênior (ou com a fonte do sistema
  // ampliada) a barra fica mais alta que isso e comia a última linha.
  const tabBarSpace = useTabBarSpace();
  if (!scroll) {
    return <View className={`flex-1 bg-bg ${className}`}>{children}</View>;
  }
  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace, gap: 16 }}
        showsVerticalScrollIndicator={false}
        // Sem isto, o PRIMEIRO toque em qualquer botão com o teclado aberto só
        // fechava o teclado — o "Salvar" parecia não funcionar e a pessoa
        // tocava de novo. Com "handled", o toque chega ao botão de primeira.
        keyboardShouldPersistTaps="handled"
        // iOS: recua o conteúdo pela altura do teclado, então o campo em foco e
        // o botão logo abaixo dele continuam alcançáveis por rolagem. (No
        // Android o ajuste vem da própria janela; a prop é ignorada lá.)
        automaticallyAdjustKeyboardInsets
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
        className={className}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Cabeçalho com safe-area, título em fonte display, subtítulo e ação à direita. */
export function AppHeader({
  title,
  subtitle,
  right,
  icon: Icon,
  back,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  icon?: LucideIcon;
  back?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  // O botão Voltar era 40×40 — abaixo do piso de projeto (44) mesmo com o Modo
  // Sênior desligado. Agora acompanha o alvo (44 / 56).
  const tap = useTapTarget();
  return (
    <View style={{ paddingTop: insets.top + 10 }} className="bg-bg px-4 pb-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2.5">
          {back ? (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              hitSlop={8}
              style={[CONTINUOUS, { height: tap, width: tap }]}
              className="items-center justify-center rounded-2xl bg-surface-2 active:opacity-70"
            >
              <ChevronLeft size={22} color={colors.fg} />
            </Pressable>
          ) : Icon ? (
            <View
              style={[CONTINUOUS, { height: tap, width: tap }]}
              className="items-center justify-center rounded-2xl bg-trust-100"
            >
              <Icon size={21} color={colors.primary} />
            </View>
          ) : null}
          <View className="flex-1">
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={1.4}
              // 26px displayX não é token de `type` (o mais próximo, `display`,
              // é 30). Escalamos o valor de projeto para não mudar o desenho.
              style={[{ fontFamily: fonts.displayX }, fs(26, 32)]}
              className="text-fg"
            >
              {title}
            </Text>
            {subtitle ? (
              <Text maxFontSizeMultiplier={1.5} style={[t.caption, { color: colors.muted }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {right}
      </View>
    </View>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const fs = useFontScaler();
  return (
    <View className="mb-0.5 mt-1 flex-row items-center justify-between">
      {/* 17px display não é token (`heading` é 20) — escalamos o valor atual.
          `flex-1` + `shrink` para o título quebrar linha em vez de empurrar a
          ação para fora da tela quando a fonte cresce. */}
      <Text style={[{ fontFamily: fonts.display }, fs(17, 23)]} className="flex-1 text-fg">
        {children}
      </Text>
      {action}
    </View>
  );
}

/** Cartão de destaque com gradiente (hero da home, etc.). */
export function Hero({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: 28 }, CONTINUOUS, shadowRaised]}
    >
      <View className="p-5">{children}</View>
    </LinearGradient>
  );
}

/* ──────────────────────────── Surfaces ──────────────────────────── */

export function Card({
  children,
  dashed,
  className = '',
  onPress,
}: {
  children: ReactNode;
  dashed?: boolean;
  className?: string;
  onPress?: () => void;
}) {
  const inner = (
    <View
      style={[CONTINUOUS, dashed ? undefined : cardShadow]}
      className={`rounded-3xl border bg-surface p-4 ${dashed ? 'border-dashed border-line' : 'border-line'} ${className}`}
    >
      {children}
    </View>
  );
  if (onPress) {
    return <PressableScale onPress={onPress}>{inner}</PressableScale>;
  }
  return inner;
}

export function IconCircle({
  icon: Icon,
  tone = 'primary',
  size = 40,
}: {
  icon: LucideIcon;
  tone?: 'primary' | 'accent' | 'attention' | 'alert' | 'neutral';
  size?: number;
}) {
  const colors = useColors();
  const bg = {
    primary: 'bg-trust-100',
    accent: 'bg-health-300/40',
    attention: 'bg-amber-100',
    alert: 'bg-rose-100',
    neutral: 'bg-surface-2',
  }[tone];
  const color = {
    primary: colors.primary,
    accent: colors.accent,
    attention: colors.attention,
    alert: colors.alert,
    neutral: colors.muted,
  }[tone];
  return (
    <View
      style={[{ width: size, height: size }, CONTINUOUS]}
      className={`items-center justify-center rounded-2xl ${bg}`}
    >
      <Icon size={size * 0.5} color={color} />
    </View>
  );
}

/** Linha de lista clicável: ícone + título + subtítulo + chevron. */
export function ListRow({
  icon,
  iconTone,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon?: LucideIcon;
  iconTone?: 'primary' | 'accent' | 'attention' | 'alert' | 'neutral';
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();
  const row = (
    // minHeight (não height): a linha CRESCE quando o texto cresce, em vez de
    // cortar. Toda a linha é o alvo de toque, então precisa do piso.
    <View
      style={[CONTINUOUS, onPress ? { minHeight: tap } : null]}
      className="flex-row items-center gap-3 rounded-2xl px-1 py-2.5"
    >
      {icon ? <IconCircle icon={icon} tone={iconTone} size={42} /> : null}
      <View className="flex-1">
        <Text style={[{ fontFamily: fonts.semibold }, fs(15, 20)]} className="text-fg">
          {title}
        </Text>
        {subtitle ? <Text style={[t.caption, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={20} color={colors.faint} /> : null)}
    </View>
  );
  return onPress ? <PressableScale onPress={onPress}>{row}</PressableScale> : row;
}

/* ──────────────────────────── Métricas ──────────────────────────── */

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'primary' | 'accent' | 'attention' | 'alert' | 'neutral';
}) {
  const fs = useFontScaler();
  return (
    <View style={[CONTINUOUS, cardShadow]} className="flex-1 rounded-3xl border border-line bg-surface p-4">
      {icon ? <IconCircle icon={icon} tone={tone} size={36} /> : null}
      {/* O valor é dado clínico: escala junto e nunca trunca. */}
      <Text style={[{ fontFamily: fonts.displayX }, fs(24, 30)]} className="mt-2 text-fg">
        {value}
      </Text>
      <Text style={[{ fontFamily: fonts.medium }, fs(12, 16)]} className="text-muted">
        {label}
      </Text>
      {hint ? (
        <Text
          maxFontSizeMultiplier={1.4}
          style={[{ fontFamily: fonts.regular }, fs(11, 15)]}
          className="mt-0.5 text-muted"
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/* ──────────────────────────── Botões ──────────────────────────── */

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  icon: Icon,
  size = 'md',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'accent' | 'outline' | 'ghost';
  icon?: LucideIcon;
  size?: 'md' | 'sm';
}) {
  const colors = useColors();
  const fs = useFontScaler();
  const tap = useTapTarget();
  const gradient = variant === 'primary' || variant === 'accent';
  const iconColor = gradient ? colors.white : colors.fg;
  // Alvo de toque reativo (44 / 56 no Modo Sênior). `md` mantém a folga de 6px
  // que o desenho já tinha sobre o piso.
  const minHeight = size === 'sm' ? tap : tap + 6;

  const a11y = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: label,
    accessibilityState: { disabled: !!(disabled || loading), busy: !!loading },
  };

  // minHeight + paddingVertical (não `height` fixa): com a fonte ampliada o
  // botão CRESCE e o rótulo pode ir para duas linhas, em vez de ser cortado.
  const box = {
    minHeight,
    paddingVertical: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  };

  const content = loading ? (
    <ActivityIndicator color={iconColor} />
  ) : (
    <>
      {Icon ? <Icon size={18} color={iconColor} /> : null}
      <Text
        maxFontSizeMultiplier={1.4}
        // `shrink` deixa o rótulo quebrar dentro do botão em vez de empurrar o
        // ícone para fora quando o texto cresce.
        style={[{ fontFamily: fonts.semibold, flexShrink: 1, textAlign: 'center' }, fs(15, 20)]}
        className={gradient ? 'text-white' : 'text-fg'}
      >
        {label}
      </Text>
    </>
  );

  if (gradient) {
    return (
      <PressableScale
        onPress={onPress}
        disabled={disabled || loading}
        {...a11y}
        style={[{ borderRadius: 16 }, CONTINUOUS, { overflow: 'hidden' }, disabled || loading ? { opacity: 0.6 } : null]}
      >
        <LinearGradient
          colors={variant === 'accent' ? gradients.accent : gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[box, { paddingHorizontal: 16 }]}
        >
          {content}
        </LinearGradient>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      {...a11y}
      style={[{ borderRadius: 16 }, CONTINUOUS, disabled || loading ? { opacity: 0.6 } : null]}
    >
      <View
        style={box}
        className={`rounded-2xl px-4 ${variant === 'outline' ? 'border border-line bg-surface' : ''}`}
      >
        {content}
      </View>
    </PressableScale>
  );
}

/* ──────────────────────────── Formulário ──────────────────────────── */

/** Altura mínima do campo de várias linhas: ~3 linhas de 15px + folga. */
const MULTILINE_MIN_HEIGHT = 96;

export function Input(props: TextInputProps & { label?: string; error?: string }) {
  const colors = useColors();
  const fs = useFontScaler();
  const tap = useTapTarget();
  const { style: fontFactor } = useFontScale();
  const { label, error, style, multiline, ...rest } = props;
  // Nunca abaixo do desenho atual (48) nem do alvo de toque (56 no Sênior).
  const fieldMinHeight = Math.max(48, tap);
  return (
    <View className="gap-1.5">
      {label ? (
        // Rótulo de campo: diz o que a pessoa está preenchendo. Escala junto.
        <Text
          maxFontSizeMultiplier={1.6}
          style={[{ fontFamily: fonts.medium }, fs(13, 18)]}
          className="text-fg-soft"
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        // muted (em vez de faint) deixa o placeholder legível p/ baixa visão (faint falha WCAG no branco).
        placeholderTextColor={colors.muted}
        // Associa rótulo e erro ao campo p/ leitores de tela (TalkBack/VoiceOver).
        accessibilityLabel={label}
        accessibilityHint={error}
        maxFontSizeMultiplier={1.5}
        multiline={multiline}
        style={[
          // Sem `lineHeight` aqui de propósito: no Android o TextInput corta as
          // descidas (g, p, q) quando lineHeight é declarado. Só o fontSize escala.
          { fontFamily: fonts.regular, ...fs(15) },
          CONTINUOUS,
          // Campo de várias linhas não pode ter altura FIXA: com `h-12` ele
          // mostrava só a primeira linha e o texto rolava dentro de 48px.
          // minHeight cresce com o conteúdo; textAlignVertical alinha no topo
          // (no Android o texto começaria no meio da caixa).
          multiline
            ? {
                // A caixa de várias linhas cresce junto com a fonte — senão as
                // "3 linhas" viram 2 no Modo Sênior.
                minHeight: Math.round(MULTILINE_MIN_HEIGHT * fontFactor),
                paddingVertical: 12,
                textAlignVertical: 'top' as const,
              }
            : { minHeight: fieldMinHeight },
          // O estilo de quem chama continua com a última palavra.
          style,
        ]}
        className="rounded-2xl border border-line bg-surface px-4 text-fg"
        {...rest}
      />
      {error ? (
        // Mensagem de erro: é o que destrava o formulário. Nunca pode ficar ilegível.
        <Text
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          maxFontSizeMultiplier={1.6}
          style={[{ fontFamily: fonts.regular }, fs(12, 16)]}
          className="text-semaphore-alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/* ──────────────────────────── Diversos ──────────────────────────── */

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ok' | 'attention' | 'alert' | 'info';
}) {
  const fs = useFontScaler();
  const cls = {
    neutral: 'bg-surface-2 text-muted',
    ok: 'bg-health-300/30 text-health-600',
    attention: 'bg-amber-100 text-amber-700',
    alert: 'bg-rose-100 text-rose-700',
    info: 'bg-trust-100 text-trust-700',
  }[tone];
  return (
    // O badge carrega estado clínico ("Em dia", "Atrasado") a 11px — dos textos
    // mais críticos do app e o que menos se lia. `shrink` deixa o chip quebrar
    // linha em vez de vazar da tela quando o rótulo cresce.
    <View className={`shrink self-start rounded-full px-2.5 py-0.5 ${cls.split(' ')[0]}`}>
      <Text style={[{ fontFamily: fonts.semibold }, fs(11, 15)]} className={cls.split(' ')[1]}>
        {children}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  actionIcon,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
}) {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  return (
    <View
      style={CONTINUOUS}
      className="items-center gap-2 rounded-3xl border border-dashed border-line bg-surface/50 px-6 py-10"
    >
      <View style={CONTINUOUS} className="h-14 w-14 items-center justify-center rounded-3xl bg-surface-2">
        <Icon size={26} color={colors.faint} />
      </View>
      <Text style={[{ fontFamily: fonts.semibold, textAlign: 'center' }, fs(15, 20)]} className="text-fg">
        {title}
      </Text>
      {subtitle ? (
        <Text style={[t.caption, { color: colors.muted, textAlign: 'center' }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-2">
          <Button label={actionLabel} icon={actionIcon} onPress={onAction} size="sm" />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Estado de erro de carregamento — distinto do vazio (que é "tudo certo, só não
 * há nada ainda"). Aqui algo falhou e oferecemos um caminho de volta: tentar de
 * novo. Linguagem acolhedora (público inclui idosos), sem jargão técnico.
 */
export function ErrorState({
  title = 'Não conseguimos carregar',
  subtitle = 'Verifique sua conexão e tente novamente.',
  onRetry,
  icon: Icon = CloudOff,
}: {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  icon?: LucideIcon;
}) {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  return (
    <View
      style={CONTINUOUS}
      className="items-center gap-2 rounded-3xl border border-dashed border-line bg-surface/50 px-6 py-10"
    >
      <View style={CONTINUOUS} className="h-14 w-14 items-center justify-center rounded-3xl bg-surface-2">
        <Icon size={26} color={colors.muted} />
      </View>
      <Text style={[{ fontFamily: fonts.semibold, textAlign: 'center' }, fs(15, 20)]} className="text-fg">
        {title}
      </Text>
      <Text style={[t.caption, { color: colors.muted, textAlign: 'center' }]}>{subtitle}</Text>
      {onRetry ? (
        <View className="mt-2">
          <Button label="Tentar novamente" icon={RefreshCw} variant="outline" onPress={onRetry} size="sm" />
        </View>
      ) : null}
    </View>
  );
}

export function Divider() {
  return <View className="h-px bg-line" />;
}
