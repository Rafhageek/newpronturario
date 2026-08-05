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
import { ChevronRight, CloudOff, Plus, RefreshCw, type LucideIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { CHIP_TONES, chipToneFor, type ChipTone } from '@hubpatients/ui-tokens';
import {
  fonts,
  radius,
  space,
  status,
  statusMeta,
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
  /**
   * Estilo do cartão. Vai para o elemento MAIS EXTERNO (o Pressable, quando há
   * `onPress`) — é ele que a fileira estica.
   */
  style?: StyleProp<ViewStyle>;
  /** Só posição/tamanho, quando se quer separar de `style`. Também vai por fora. */
  layoutStyle?: StyleProp<ViewStyle>;
}

/**
 * Cartão do Painel: superfície, canto de 16px, borda clara, sombra sutil.
 *
 * ⚠️ O `style` vai para o PRESSABLE DE FORA quando há `onPress`, e não para a
 * View de dentro. Parece detalhe e não é: quem é o item flexível de uma
 * `<StatRow>` é o elemento mais externo, e enquanto o `flex: 1` pousava na View
 * interna o Pressable ficava com largura de conteúdo — um cartão de valor longo
 * ("Próxima consulta") esticava e empurrava os vizinhos, e a fileira deixava de
 * ser grade. A tela teve que embrulhar o cartão numa View só para consertar
 * isso; remendo de tela em cima de primitiva não escala para 47 telas.
 *
 * `layoutStyle` existe para o caso raro em que se quer separar as duas coisas:
 * o que é POSIÇÃO/tamanho (vai por fora) do que é aparência interna.
 */
export function PanelCard({
  children,
  className = '',
  elevation = 'plain',
  onPress,
  style,
  layoutStyle,
}: PanelCardProps) {
  // No tema escuro isto devolve degrau tonal + hairline: sombra não se lê sobre
  // preto, e o hook resolve a regra para a tela não ter que lembrar dela.
  const sombra = usePainelShadow(elevation === 'raised' ? 'raised' : 'card');
  const caixa = (
    <View
      style={[
        CONTINUOUS,
        { borderRadius: radius.md },
        elevation === 'dashed' ? null : sombra,
        // Sem `onPress` não existe elemento de fora: o estilo fica aqui mesmo.
        onPress ? null : style,
        onPress ? null : layoutStyle,
      ]}
      className={`border bg-surface p-4 ${
        elevation === 'dashed' ? 'border-dashed border-line' : 'border-line'
      } ${className}`}
    >
      {children}
    </View>
  );
  if (!onPress) return caixa;
  return (
    <PressableScale onPress={onPress} style={[style, layoutStyle]}>
      {caixa}
    </PressableScale>
  );
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
  /**
   * Dica embaixo do valor. É `ReactNode`, e não `string`, porque a leitura
   * clínica precisa caber aqui INTEIRA — um chip de faixa de referência tem
   * tinta `neutro` + seta + texto, e com `string` a tela era obrigada a jogar
   * fora o canal visual e ficar só com a frase. Passe `hintLabel` quando `hint`
   * não for texto puro.
   */
  hint?: ReactNode;
  /** Texto do leitor de tela quando `hint` é um elemento. */
  hintLabel?: string;
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
  hintLabel,
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
  // `hint` pode ser um elemento; o texto do leitor de tela vem de `hintLabel`.
  const dicaLegivel = typeof hint === 'string' ? hint : hintLabel;

  return (
    <PanelCard
      onPress={acao}
      // `flex: 1` no elemento de FORA — é ele que a `StatRow` estica. Enquanto
      // o `PanelCard` não repassava `style`, a fileira saía irregular.
      layoutStyle={{ flex: 1, minWidth: 150 }}
      style={style}
    >
      <View
        accessible
        accessibilityRole={acao ? 'button' : 'text'}
        // Uma leitura só: "Peso, 78,4 kg, ontem".
        accessibilityLabel={[label, value, dicaLegivel].filter(Boolean).join(', ')}
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
        {typeof hint === 'string' ? (
          <Text
            maxFontSizeMultiplier={1.4}
            style={[{ fontFamily: fonts.regular, color: colors.hint, marginTop: 2 }, fs(13, 18)]}
          >
            {hint}
          </Text>
        ) : hint ? (
          <View style={{ marginTop: space[1] }}>{hint}</View>
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
  description?: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /**
   * `boxed` (padrão) = moldura tracejada própria, para o vazio de uma lista
   * solta na tela. `bare` = sem moldura, para quando o vazio já está DENTRO de
   * um `<PanelCard>` — senão vira borda dentro de borda.
   */
  variant?: 'boxed' | 'bare';
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
  variant = 'boxed',
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
        { alignItems: 'center', gap: space[2] },
        variant === 'boxed'
          ? {
              borderRadius: radius.md,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.line,
              paddingHorizontal: space[6],
              paddingVertical: space[10],
            }
          : { paddingHorizontal: space[2], paddingVertical: space[6] },
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
      {typeof description === 'string' ? (
        <Text style={[t.bodySm, { color: colors.muted, textAlign: 'center' }]}>{description}</Text>
      ) : (
        description ?? null
      )}
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

/* ══════════════════════════════ Estado de erro ══════════════════════════════ */

export interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: LucideIcon;
  variant?: 'boxed' | 'bare';
}

/**
 * Estado de ERRO — irmão do `EmptyState`, e deliberadamente diferente dele.
 *
 * Vazio é "ainda não há nada aqui, e é assim que começa". Erro é "existe algo e
 * nós não conseguimos trazer". A diferença importa porque, num prontuário,
 * "nenhum exame" e "não carregamos seus exames" levam a decisões opostas — a
 * primeira convida a registrar, a segunda a esperar e tentar de novo. Por isso
 * este componente SEMPRE oferece caminho de volta e nunca deixa a ausência
 * parecer um fato.
 *
 * Existia um `ErrorState` no design antigo (`components/ui.tsx`), com canto
 * 3xl e sombra quente. Enquanto o Painel só tinha o vazio, o par ficava
 * partido: metade nova, metade velha, lado a lado na mesma tela.
 *
 * ⚠️ Sem cor de alerta, de propósito. Falha de carregamento é do SISTEMA e o
 * vermelho seria permitido — mas o erro já se distingue pelo ÍCONE, pelo TÍTULO
 * e pelo botão. Pintar de vermelho um cartão que contém dado de saúde faz a
 * pessoa ler gravidade clínica onde só houve rede ruim.
 */
export function ErrorState({
  title = 'Não conseguimos carregar',
  description = 'Verifique sua conexão e tente novamente.',
  onRetry,
  retryLabel = 'Tentar novamente',
  icon: Icon = CloudOff,
  variant = 'boxed',
}: ErrorStateProps) {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  return (
    <View
      accessible
      // `text`, não `alert`: o leitor de tela anuncia quando chegar a vez, sem
      // interromper a leitura. `alert` é para o que exige ação imediata.
      accessibilityRole="text"
      style={[
        CONTINUOUS,
        { alignItems: 'center', gap: space[2] },
        variant === 'boxed'
          ? {
              borderRadius: radius.md,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.line,
              paddingHorizontal: space[6],
              paddingVertical: space[10],
            }
          : { paddingHorizontal: space[2], paddingVertical: space[6] },
      ]}
    >
      <IconChip icon={Icon} tone="ardosia" size="lg" />
      <Text
        style={[
          { fontFamily: fonts.semibold, color: colors.fgSoft, textAlign: 'center' },
          fs(17, 24),
        ]}
      >
        {title}
      </Text>
      {typeof description === 'string' ? (
        <Text style={[t.bodySm, { color: colors.muted, textAlign: 'center' }]}>{description}</Text>
      ) : (
        description ?? null
      )}
      {onRetry ? (
        <PanelButton
          label={retryLabel}
          icon={RefreshCw}
          variant="secondary"
          onPress={onRetry}
          size="sm"
          style={{ marginTop: space[2] }}
        />
      ) : null}
    </View>
  );
}

/* ══════════════════════════════ Linha de lista ══════════════════════════════ */

export interface PanelRowProps {
  icon?: LucideIcon;
  tone?: ChipTone;
  title: string;
  subtitle?: string;
  /** Canto direito: chip de status, valor, hora. */
  right?: ReactNode;
  href?: string;
  onPress?: () => void;
  /** Nome acessível da linha inteira. Padrão: título + subtítulo. */
  ariaLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A LINHA — chip + título + subtítulo + ação à direita.
 *
 * É a forma que mais se repete no produto: "Medicamentos de hoje", linha do
 * tempo, exames, consultas, membros da família, itens de ajuste. Estava sendo
 * remontada à mão em cada tela, um pouco diferente a cada vez — que é
 * exatamente o que uma fundação existe para impedir.
 *
 * A linha INTEIRA é o alvo de toque quando há `href`/`onPress`, com o piso de
 * `useTapTarget()` (44px, 56 no Modo Sênior) em `minHeight` — ela cresce com o
 * texto em vez de cortar. O chevron só aparece quando leva a algum lugar.
 */
export function PanelRow({
  icon: Icon,
  tone,
  title,
  subtitle,
  right,
  href,
  onPress,
  ariaLabel,
  style,
}: PanelRowProps) {
  const colors = useColors();
  const t = useType();
  const fs = useFontScaler();
  const tap = useTapTarget();
  const router = useRouter();
  const acao = onPress ?? (href ? () => router.push(href as never) : undefined);

  const corpo = (
    <View
      style={[
        CONTINUOUS,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          borderRadius: radius.sm,
          paddingHorizontal: space[1],
          paddingVertical: space[2] + 2,
          minHeight: tap,
        },
        acao ? null : style,
      ]}
    >
      {Icon ? <IconChip icon={Icon} tone={tone} seed={title} size="md" /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[{ fontFamily: fonts.semibold, color: colors.fg }, fs(15, 20)]}>{title}</Text>
        {subtitle ? <Text style={[t.caption, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {right ?? (acao ? <ChevronRight size={20} color={colors.hint} /> : null)}
    </View>
  );

  if (!acao) return corpo;
  return (
    <PressableScale
      onPress={acao}
      accessibilityRole="button"
      accessibilityLabel={ariaLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      style={style}
    >
      {corpo}
    </PressableScale>
  );
}

/* ══════════════════════════════ Chip de status ══════════════════════════════ */

export type StatusKind = keyof typeof statusMeta;

export interface StatusChipProps {
  /** Papel semântico. Obrigatório: não existe chip "sem status". */
  status: StatusKind;
  /**
   * Texto SEMPRE visível ao lado do glifo. Obrigatório de propósito — é ele que
   * carrega o significado quando a cor não chega (daltonismo, sol, impressão).
   */
  label: string;
  /** Substitui o glifo padrão. */
  icon?: LucideIcon;
  /** `tint` = fundo preenchido (padrão) · `outline` = só borda. */
  variant?: 'tint' | 'outline';
  style?: StyleProp<ViewStyle>;
}

/**
 * Chip de status do SISTEMA — a ÚNICA porta de âmbar e vermelho no Painel.
 *
 * Espelho do `<StatusChip>` da web (`components/ui/status-chip.tsx`). Existir
 * nas duas plataformas é o ponto: enquanto ele só existia na web, cada tela do
 * mobile que precisava dizer "sem confirmação de dose" montava o seu à mão,
 * dentro de uma região de exceção própria — e regra repetida em 47 lugares é
 * regra que uma hora sai errada em um deles. (Não escreva o marcador de exceção
 * por extenso em comentário: a varredura lê o arquivo como texto e abriria uma
 * região aqui sem ninguém pedir.)
 *
 * Três papéis de cor, porque um âmbar vivo nunca chega a 4,5:1 sobre off-white:
 *   `ink`  → texto e glifo (≥4,5:1 sobre o `tint`)
 *   `mark` → borda (≥3:1, SC 1.4.11)
 *   `tint` → fundo
 *
 * `label` é obrigatório e SEMPRE renderizado: cor nunca sozinha (SC 1.4.1). Se
 * não dá para escrever um rótulo, não é status — é decoração, e decoração não
 * entra em tela clínica.
 *
 * ⚠️ REGRA CLÍNICA: isto vale para AGENDA, LEMBRETE, ENVIO e SEGURANÇA — coisas
 * do app. NUNCA para dado do corpo do paciente (pressão, dor, peso, IMC, humor,
 * tendência). Para faixa de referência de medida clínica use tinta `neutro` +
 * seta + texto. Há teste travando isso:
 * `packages/core/src/utils/regra-cor-clinica.test.ts`.
 *
 * @cor-do-sistema — este componente É a definição da cor de sistema. A exceção
 * mora aqui, uma vez, em vez de espalhada pelas telas.
 */
export function StatusChip({
  status: kind,
  label,
  icon: Icon,
  variant = 'tint',
  style,
}: StatusChipProps) {
  const { colorScheme } = useColorScheme();
  const fs = useFontScaler();
  const tom = status[colorScheme === 'dark' ? 'dark' : 'light'][kind];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        CONTINUOUS,
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: space[1],
          paddingHorizontal: space[2],
          paddingVertical: 2,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: tom.mark,
          backgroundColor: variant === 'outline' ? 'transparent' : tom.tint,
        },
        style,
      ]}
    >
      {Icon ? (
        <Icon size={12} color={tom.ink} />
      ) : (
        <Text style={[{ fontFamily: fonts.semibold, color: tom.ink }, fs(12, 16)]}>
          {statusMeta[kind].glyph}
        </Text>
      )}
      <Text style={[{ fontFamily: fonts.semibold, color: tom.ink, flexShrink: 1 }, fs(12, 16)]}>
        {label}
      </Text>
    </View>
  );
}
/* @fim-cor-do-sistema */

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
