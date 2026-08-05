'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRIMITIVAS DO PAINEL — web
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O vocabulário que as ~49 rotas da web vão falar. O mobile tem os mesmos
 * componentes, com os mesmos nomes e a mesma API conceitual, em
 * `apps/mobile/src/components/painel`. Se você mudar a assinatura de um lado,
 * mude do outro.
 *
 * REGRAS QUE ESTES COMPONENTES FAZEM VALER SOZINHOS (não delegue para a tela):
 *
 *  1. MODO SÊNIOR — nenhum tamanho literal. Só os degraus semânticos
 *     (`text-caption` … `text-display`), que são rem e crescem com
 *     `html[data-senior] { font-size: 130% }`. Um `text-[13px]` aqui mataria o
 *     Modo Sênior nas 49 rotas de uma vez.
 *  2. ALVO DE TOQUE — `min-h-11` (44px). Em rem, então a regra do Modo Sênior o
 *     leva a ~57px sem nenhuma exceção.
 *  3. COR NO CORPO DO PACIENTE — o `tone` do chip é CATEGORIA, e a paleta não
 *     tem verde, âmbar nem vermelho para escolher. Status do SISTEMA continua
 *     no `<StatusChip>` de `components/ui/status-chip`.
 *  4. CONTRASTE — todo par de cor usado aqui está medido em
 *     `packages/core/src/utils/contraste-painel.test.ts`.
 */

import type { LucideIcon } from 'lucide-react';
import { ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CHIP_TONES, chipToneFor, type ChipTone } from '@hubpatients/ui-tokens';

export type { ChipTone };
export { CHIP_TONES, chipToneFor };

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Classes por tom, escritas por extenso de propósito: o Tailwind varre o código
 * como TEXTO, então `bg-chip-${tom}-tint` não geraria classe nenhuma.
 */
const CHIP_CLASSES: Record<ChipTone, string> = {
  azul: 'bg-chip-azul-tint text-chip-azul-ink',
  indigo: 'bg-chip-indigo-tint text-chip-indigo-ink',
  violeta: 'bg-chip-violeta-tint text-chip-violeta-ink',
  ameixa: 'bg-chip-ameixa-tint text-chip-ameixa-ink',
  turquesa: 'bg-chip-turquesa-tint text-chip-turquesa-ink',
  ardosia: 'bg-chip-ardosia-tint text-chip-ardosia-ink',
};

/* ══════════════════════════════ Superfície ══════════════════════════════ */

export interface PanelCardProps {
  children: ReactNode;
  className?: string;
  /** `plain` = repouso (padrão) · `raised` = popover/foco · `dashed` = vazio. */
  elevation?: 'plain' | 'raised' | 'dashed';
  /** `as="section"` quando o cartão for uma região com cabeçalho próprio. */
  as?: 'div' | 'section' | 'article' | 'li';
}

/**
 * O cartão do Painel: branco, canto de 16px, borda muito clara, sombra sutil.
 * É a superfície de tudo — se algo precisa de outra, provavelmente não devia
 * ser um cartão.
 */
export function PanelCard({
  children,
  className,
  elevation = 'plain',
  as: Tag = 'div',
}: PanelCardProps) {
  return (
    <Tag
      className={cx(
        'rounded-card border bg-surface text-fg',
        elevation === 'dashed' ? 'border-dashed border-line' : 'border-line',
        elevation === 'plain' && 'shadow-card',
        elevation === 'raised' && 'shadow-raised',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ══════════════════════════════ Chip de ícone ══════════════════════════════ */

export interface IconChipProps {
  icon: LucideIcon;
  /**
   * Cor de CATEGORIA. Se você não passar, derivamos de `seed` (a rota, o id do
   * módulo) — a mesma seção fica com a mesma cor na web e no mobile, sem
   * tabela duplicada.
   *
   * ⚠️ NÃO existe tom de gravidade aqui, e isso é de propósito: um cartão não
   * pode nascer "grave" por escolha de cor. Gravidade do SISTEMA é `<StatusChip>`.
   */
  tone?: ChipTone;
  seed?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CHIP_SIZE = {
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10 rounded-chip', icon: 'h-5 w-5' },
  lg: { box: 'h-12 w-12 rounded-chip', icon: 'h-6 w-6' },
} as const;

/** Quadradinho pastel com o ícone da categoria. Decorativo: `aria-hidden`. */
export function IconChip({ icon: Icon, tone, seed, size = 'md', className }: IconChipProps) {
  const tom = tone ?? (seed ? chipToneFor(seed) : 'azul');
  const s = CHIP_SIZE[size];
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center',
        s.box,
        CHIP_CLASSES[tom],
        className,
      )}
    >
      <Icon className={s.icon} strokeWidth={2} />
    </span>
  );
}

/* ══════════════════════════════ Botão ══════════════════════════════ */

export interface PanelButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  /**
   * `primary` = azul cheio, canto totalmente arredondado (o botão do mockup)
   * `secondary` = superfície com borda · `ghost` = só texto
   * `quiet` = ação discreta de cabeçalho ("Ver todos")
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'quiet';
  size?: 'md' | 'sm';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

const BUTTON_VARIANT: Record<NonNullable<PanelButtonProps['variant']>, string> = {
  // `text-white` + a regra `.bg-primary` de globals.css: no tema escuro a tinta
  // vira `--on-primary` sozinha (branco sobre o azul claro daria 2,2:1).
  primary: 'bg-primary text-white shadow-card hover:bg-primary-hover',
  secondary: 'border border-line-strong bg-surface text-fg hover:bg-surface-2',
  ghost: 'text-fg hover:bg-surface-2',
  quiet: 'text-primary hover:bg-surface-2',
};

/**
 * Botão do Painel. Canto totalmente arredondado no `primary` — é a assinatura
 * do desenho novo.
 *
 * A altura é `min-h-11` (2,75rem = 44px), NUNCA `h-11`: com a fonte ampliada o
 * botão precisa CRESCER, não cortar o rótulo. Em rem, o Modo Sênior o leva a
 * ~57px sem exceção nenhuma.
 */
export function PanelButton({
  children,
  onClick,
  href,
  icon: Icon,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  className,
  ...rest
}: PanelButtonProps) {
  const classes = cx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-semibold',
    size === 'sm' ? 'px-4 text-label' : 'px-5 text-body-sm',
    'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:cursor-not-allowed disabled:opacity-60',
    BUTTON_VARIANT[variant],
    className,
  );

  const conteudo = (
    <>
      {Icon ? <Icon className="h-[1.15em] w-[1.15em] shrink-0" aria-hidden="true" /> : null}
      <span className="min-w-0">{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {conteudo}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes} {...rest}>
      {conteudo}
    </button>
  );
}

/* ══════════════════════════════ Selo ══════════════════════════════ */

/**
 * Selo informativo do cabeçalho — "Dados protegidos • LGPD" no mockup.
 *
 * NÃO é status: não muda de cor, não alerta, não pisca. Se você precisa
 * comunicar que algo deu errado, o componente é `<StatusChip>`.
 */
export function Seal({
  icon: Icon,
  children,
  className,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-caption font-medium text-muted',
        className,
      )}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* ══════════════════════════════ Cabeçalho de página ══════════════════════════════ */

export interface PageHeaderProps {
  /**
   * Data por extenso, em azul pequeno ("Quarta-feira, 5 de Agosto").
   *
   * Vem PRONTA de quem chama, formatada com os utilitários de data em PT-BR do
   * `@hubpatients/core` — nunca com `Intl` (o mobile roda em Hermes e `Intl`
   * derruba o app; a paridade exige o mesmo caminho nas duas plataformas).
   */
  eyebrow?: string;
  /** Saudação grande ("Olá, Rafael! 👋"). */
  title: string;
  subtitle?: string;
  /** Canto direito: selo, ação, filtro. */
  right?: ReactNode;
  className?: string;
}

/** Cabeçalho de página: data, saudação, subtítulo, selo e a mancha decorativa. */
export function PageHeader({ eyebrow, title, subtitle, right, className }: PageHeaderProps) {
  return (
    <header className={cx('relative overflow-hidden', className)}>
      {/* Mancha de gradiente do canto. Decorativa e ESTÁTICA: movimento
          periférico ao lado de texto é gatilho vestibular (P5 do sistema de
          movimento) e um fundo animado atrás de dado clínico distrai a leitura. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'var(--painel-blob)' }}
      />
      <div className="flex flex-wrap items-start justify-between gap-4 py-2">
        <div className="min-w-0">
          {eyebrow ? <p className="text-caption font-semibold text-primary">{eyebrow}</p> : null}
          <h1 className="mt-1 font-display text-title text-fg">{title}</h1>
          {subtitle ? <p className="mt-1 text-body-sm text-muted">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}

/* ══════════════════════════════ Cabeçalho de seção ══════════════════════════════ */

export interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  tone?: ChipTone;
  /** Destino do "Ver todos". */
  href?: string;
  /** Texto do link (padrão: "Ver todos"). */
  actionLabel?: string;
  /** Substitui o link por qualquer ação. */
  action?: ReactNode;
  /** `id` do heading, para `aria-labelledby` da região. */
  id?: string;
  className?: string;
}

/** Título de cartão com ícone + link "Ver todos" à direita. */
export function SectionHeader({
  title,
  icon: Icon,
  tone,
  href,
  actionLabel = 'Ver todos',
  action,
  id,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cx('flex items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? <IconChip icon={Icon} tone={tone} seed={title} size="sm" /> : null}
        <h2 id={id} className="min-w-0 truncate font-display text-label text-fg">
          {title}
        </h2>
      </div>
      {action ??
        (href ? (
          <Link
            href={href}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-caption font-semibold text-primary hover:bg-surface-2"
          >
            {actionLabel}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null)}
    </div>
  );
}

/* ══════════════════════════════ Cartão de métrica ══════════════════════════════ */

export interface StatCardProps {
  icon: LucideIcon;
  tone?: ChipTone;
  label: string;
  /** Valor grande. Se for número clínico, passe já formatado. */
  value: ReactNode;
  hint?: string;
  href?: string;
  /**
   * `true` quando o valor é uma medida do corpo (peso, pressão, IMC, dose) —
   * aplica `hp-num`: Atkinson Mono, largura tabular, 1/l e 0/O inconfundíveis.
   */
  clinical?: boolean;
  className?: string;
}

/**
 * O cartão da fileira de cinco do mockup: chip de ícone pastel, rótulo pequeno,
 * valor grande, dica cinza, chevron à direita.
 *
 * O chevron só aparece quando existe `href`: seta que não leva a lugar nenhum é
 * promessa quebrada.
 */
export function StatCard({
  icon,
  tone,
  label,
  value,
  hint,
  href,
  clinical,
  className,
}: StatCardProps) {
  const corpo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <IconChip icon={icon} tone={tone} seed={label} />
        {href ? (
          <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-hint" aria-hidden="true" />
        ) : null}
      </div>
      <p className="mt-4 text-caption font-medium text-muted">{label}</p>
      <p className={cx('mt-0.5 font-display text-title text-fg', clinical && 'hp-num')}>{value}</p>
      {hint ? <p className="mt-1 text-caption text-hint">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cx(
          'group block rounded-card border border-line bg-surface p-5 shadow-card transition-colors hover:border-primary/40',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          className,
        )}
      >
        {corpo}
      </Link>
    );
  }
  return <PanelCard className={cx('p-5', className)}>{corpo}</PanelCard>;
}

/** Fileira responsiva de cartões de métrica (5 no desktop do mockup). */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════ Estado vazio ══════════════════════════════ */

export interface EmptyStateProps {
  /**
   * A ilustração. Passe um <svg> próprio (frasco de remédio, calendário) ou um
   * ícone do lucide — nos dois casos ela é decorativa e fica `aria-hidden`.
   */
  illustration?: ReactNode;
  icon?: LucideIcon;
  tone?: ChipTone;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Estado vazio ILUSTRADO: desenho, explicação e um caminho de saída.
 *
 * Estado vazio não é erro — é "ainda não há nada aqui, e é assim que começa".
 * Por isso a linguagem é acolhedora e o botão sempre diz o que vai acontecer.
 * Falha de carregamento tem componente próprio (`ErrorState`).
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
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line px-6 py-12 text-center',
        className,
      )}
    >
      <span aria-hidden="true" className="text-hint">
        {illustration ?? (Icon ? <IconChip icon={Icon} tone={tone} size="lg" /> : null)}
      </span>
      <p className="text-body font-semibold text-fg-soft">{title}</p>
      {description ? <p className="max-w-sm text-body-sm text-muted">{description}</p> : null}
      {actionLabel && (actionHref || onAction) ? (
        <PanelButton
          className="mt-2"
          icon={Plus}
          href={actionHref}
          onClick={onAction}
          size="sm"
        >
          {actionLabel}
        </PanelButton>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════ Ações rápidas ══════════════════════════════ */

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  tone?: ChipTone;
}

/** Barra de ações rápidas do rodapé do conteúdo: ícone + rótulo, lado a lado. */
export function QuickActions({
  actions,
  label = 'Ações rápidas',
  className,
}: {
  actions: QuickAction[];
  label?: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map((acao) => {
          const conteudo = (
            <>
              <IconChip icon={acao.icon} tone={acao.tone} seed={acao.label} size="sm" />
              <span className="min-w-0 text-label font-medium text-fg">{acao.label}</span>
            </>
          );
          const classes =
            'flex min-h-11 w-full items-center gap-2.5 rounded-card border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
          return (
            <li key={acao.label}>
              {acao.href ? (
                <Link href={acao.href} className={classes}>
                  {conteudo}
                </Link>
              ) : (
                <button type="button" onClick={acao.onClick} className={classes}>
                  {conteudo}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
