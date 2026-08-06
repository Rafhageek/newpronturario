/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRIMITIVAS DO PAINEL — web
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ ESTE ARQUIVO NÃO TEM `'use client'`, E ISSO É DE PROPÓSITO.
 *
 * Ele tinha, sem precisar: nenhuma primitiva aqui usa hook nem define handler.
 * O efeito colateral foi caro — a marca `'use client'` transforma cada prop numa
 * travessia de fronteira RSC, e `LucideIcon` é um COMPONENTE. Qualquer Server
 * Component que fizesse `icon={Pill}` derrubava o `next build` com "Functions
 * cannot be passed directly to Client Components". Foi o que tirou o
 * `/assinatura` do prerender.
 *
 * O pior desse bug é o momento em que ele aparece: `tsc`, ESLint e os testes
 * passam todos. Só `next build` pega. Ou seja, ele atravessava a validação
 * inteira e explodiria na 3ª ou 4ª rota da próxima onda.
 *
 * Sem a marca, o módulo é UNIVERSAL: renderiza no servidor quando um Server
 * Component o usa, e vira código de cliente quando um Client Component o
 * importa. As duas formas de ícone passam a funcionar em qualquer lugar.
 *
 * (`MoodScale` continua `'use client'` — aquele usa estado de verdade.)
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
import { ChevronRight, CloudOff, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { createElement, isValidElement, type ComponentType, type ReactNode } from 'react';
import { CHIP_TONES, chipToneFor, type ChipTone } from '@hubpatients/ui-tokens';

export type { ChipTone };
export { CHIP_TONES, chipToneFor };

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/* ══════════════════════════════ Ícone ══════════════════════════════
 *
 * Aceita as DUAS formas:
 *   · componente — `icon={Pill}`      (o atalho; é o que as telas usam)
 *   · elemento   — `icon={<Pill className="h-5 w-5" />}`
 *
 * A forma de ELEMENTO existe para dois casos: quando se quer escolher o tamanho
 * do ícone, e quando o ícone precisa atravessar uma fronteira RSC → Client
 * Component de verdade (um Client Component recebendo `icon` de um Server
 * Component pai — aí quem passa precisa renderizar antes).
 */
export type Icone = LucideIcon | ComponentType<{ className?: string }> | ReactNode;

/**
 * Renderiza `Icone` nas duas formas. `isValidElement` é o teste certo, e não
 * `typeof === 'function'`: os ícones do lucide são `forwardRef`, que em runtime
 * é um OBJETO, não uma função.
 *
 * Quando vem elemento, `className` não é aplicado — quem passou o elemento já
 * escolheu o tamanho dele.
 */
function renderIcone(icone: Icone, className: string): ReactNode {
  if (icone === null || icone === undefined || icone === false) return null;
  if (isValidElement(icone)) return icone;
  if (typeof icone === 'object' || typeof icone === 'function') {
    return createElement(icone as ComponentType<{ className?: string }>, { className });
  }
  return icone;
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
  /**
   * `id` do elemento — normalmente para um `<SectionHeader id>` apontar para cá,
   * ou para virar alvo de `aria-labelledby` de outra região.
   */
  id?: string;
  /**
   * Nome acessível da região. Com `as="section"` isto NÃO é opcional na
   * prática: uma `<section>` sem nome não vira landmark, some do menu de
   * regiões do leitor de tela e o cartão fica anônimo. Aponte para o `id` do
   * título que já está dentro dele.
   */
  'aria-labelledby'?: string;
  'aria-label'?: string;
  role?: string;
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
  id,
  role,
  ...aria
}: PanelCardProps) {
  return (
    <Tag
      id={id}
      role={role}
      {...aria}
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
  /** Componente (`Pill`) ou elemento (`<Pill />`). Em RSC, use elemento. */
  icon: Icone;
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
export function IconChip({ icon, tone, seed, size = 'md', className }: IconChipProps) {
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
      {renderIcone(icon, s.icon)}
    </span>
  );
}

/* ══════════════════════════════ Botão ══════════════════════════════ */

export interface PanelButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  /** Componente (`Plus`) ou elemento (`<Plus />`). Em RSC, use elemento. */
  icon?: Icone;
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
  icon,
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
      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {renderIcone(icon, 'h-[1.15em] w-[1.15em]')}
        </span>
      ) : null}
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
  icon,
  children,
  className,
}: {
  icon?: Icone;
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
      {icon ? (
        <span aria-hidden="true" className="shrink-0 text-primary">
          {renderIcone(icon, 'h-4 w-4')}
        </span>
      ) : null}
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
  /** Ícone de categoria opcional para cabeçalhos das rotas internas. */
  icon?: Icone;
  tone?: ChipTone;
  /** Canto direito: selo, ação, filtro. */
  right?: ReactNode;
  className?: string;
}

/** Cabeçalho de página: data, saudação, subtítulo, selo e a mancha decorativa. */
export function PageHeader({ eyebrow, title, subtitle, icon, tone, right, className }: PageHeaderProps) {
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
          <div className="mt-1 flex items-center gap-3">
            {icon ? <IconChip icon={icon} tone={tone} seed={title} size="md" /> : null}
            <h1 className="font-display text-title text-fg">{title}</h1>
          </div>
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
  /** Componente ou elemento. Em RSC, use elemento. */
  icon?: Icone;
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
  icon,
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
        {icon ? <IconChip icon={icon} tone={tone} seed={title} size="sm" /> : null}
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
  /** Componente ou elemento. Em RSC, use elemento. */
  icon: Icone;
  tone?: ChipTone;
  label: string;
  /** Valor grande. Se for número clínico, passe já formatado. */
  value: ReactNode;
  /**
   * Dica embaixo do valor. É `ReactNode`, e não `string`, porque a leitura
   * clínica precisa caber aqui INTEIRA: `<ClinicalRangeChip>` é o componente
   * que carrega tinta `neutro` + seta + a frase da faixa de referência, e com
   * `string` a tela era obrigada a jogar fora o canal visual e deixar só o
   * texto. Passe `hintLabel` quando `hint` não for texto puro.
   */
  hint?: ReactNode;
  /** Texto do leitor de tela quando `hint` é um elemento. */
  hintLabel?: string;
  href?: string;
  /**
   * `true` quando o valor é uma medida do corpo (peso, pressão, IMC, dose) —
   * aplica `hp-num`: Atkinson Mono, largura tabular, 1/l e 0/O inconfundíveis.
   */
  clinical?: boolean;
  /** `compact` reproduz a métrica horizontal e baixa do dashboard. */
  layout?: 'default' | 'compact';
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
  hintLabel,
  href,
  clinical,
  layout = 'default',
  className,
}: StatCardProps) {
  // `hint` pode ser um elemento (ex.: <ClinicalRangeChip>). Quando for, o texto
  // do leitor de tela vem de `hintLabel` — nunca de `String(elemento)`.
  const dicaLegivel = typeof hint === 'string' ? hint : hintLabel;
  const corpo = layout === 'compact' ? (
    <div className="flex min-w-0 items-center gap-3">
      <IconChip icon={icon} tone={tone} seed={label} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption font-medium text-muted">{label}</p>
        <p
          className={cx(
            'mt-0.5 truncate text-label font-semibold leading-tight text-fg',
            clinical && 'hp-num',
          )}
        >
          {value}
        </p>
        {hint ? (
          <div className="mt-1 truncate text-caption leading-tight text-hint" aria-label={dicaLegivel || undefined}>
            {hint}
          </div>
        ) : null}
      </div>
      {href ? <ChevronRight className="h-5 w-5 shrink-0 text-hint" aria-hidden="true" /> : null}
    </div>
  ) : (
    <>
      <div className="flex items-start justify-between gap-3">
        <IconChip icon={icon} tone={tone} seed={label} />
        {href ? (
          <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-hint" aria-hidden="true" />
        ) : null}
      </div>
      <p className="mt-4 text-caption font-medium text-muted">{label}</p>
      <p className={cx('mt-0.5 font-display text-title text-fg', clinical && 'hp-num')}>{value}</p>
      {hint ? (
        <div className="mt-1 text-caption text-hint" aria-label={dicaLegivel || undefined}>
          {hint}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cx(
          'group block rounded-card border border-line bg-surface shadow-card transition-colors hover:border-primary/40',
          layout === 'compact' ? 'flex min-h-28 items-center p-4' : 'p-5',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          className,
        )}
      >
        {corpo}
      </Link>
    );
  }
  return (
    <PanelCard className={cx(layout === 'compact' ? 'flex min-h-28 items-center p-4' : 'p-5', className)}>
      {corpo}
    </PanelCard>
  );
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
  /** Componente ou elemento. Em RSC, use elemento. */
  icon?: Icone;
  tone?: ChipTone;
  title: string;
  description?: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /**
   * `boxed` (padrão) = moldura tracejada própria, para o vazio de uma LISTA
   * solta na página. `bare` = sem moldura, para quando o vazio já está DENTRO
   * de um `<PanelCard>` — senão vira borda dentro de borda.
   */
  variant?: 'boxed' | 'bare';
  /** `horizontal` coloca ilustração e mensagem lado a lado em painéis largos. */
  layout?: 'stacked' | 'horizontal';
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
  icon,
  tone = 'ardosia',
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  variant = 'boxed',
  layout = 'stacked',
  className,
}: EmptyStateProps) {
  const visual = illustration ?? (icon ? <IconChip icon={icon} tone={tone} size="lg" /> : null);
  const acao = actionLabel && (actionHref || onAction) ? (
    <PanelButton
      className="mt-2"
      icon={Plus}
      href={actionHref}
      onClick={onAction}
      size="sm"
    >
      {actionLabel}
    </PanelButton>
  ) : null;

  if (layout === 'horizontal') {
    return (
      <div
        className={cx(
          'grid items-center gap-5 text-left sm:grid-cols-[minmax(170px,0.9fr)_minmax(260px,1.1fr)]',
          variant === 'boxed'
            ? 'rounded-card border border-line bg-[linear-gradient(115deg,var(--surface-2),var(--surface))] px-7 py-5'
            : 'px-2 py-6',
          className,
        )}
      >
        <span aria-hidden="true" className="flex items-center justify-center text-hint">
          {visual}
        </span>
        <div className="min-w-0">
          <p className="text-label font-semibold text-fg">{title}</p>
          {description ? <div className="mt-2 max-w-sm text-body-sm text-muted">{description}</div> : null}
          {acao}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 text-center',
        variant === 'boxed'
          ? 'rounded-card border border-dashed border-line px-6 py-12'
          : 'px-2 py-8',
        className,
      )}
    >
      <span aria-hidden="true" className="text-hint">
        {visual}
      </span>
      <p className="text-body font-semibold text-fg-soft">{title}</p>
      {description ? <div className="max-w-sm text-body-sm text-muted">{description}</div> : null}
      {acao}
    </div>
  );
}

/* ══════════════════════════════ Estado de erro ══════════════════════════════ */

export interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  /** Componente ou elemento. Em RSC, use elemento. Padrão: nuvem cortada. */
  icon?: Icone;
  variant?: 'boxed' | 'bare';
  className?: string;
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
 * Linguagem acolhedora, sem jargão: o público inclui idosos e cuidadores.
 * "Erro 500" não é mensagem, é despejo de log.
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
  icon,
  variant = 'boxed',
  className,
}: ErrorStateProps) {
  return (
    <div
      // `status`, não `alert`: o leitor de tela anuncia quando chegar a vez, sem
      // interromper a leitura. `alert` é para o que exige ação imediata, e "não
      // carregou" não é.
      role="status"
      className={cx(
        'flex flex-col items-center justify-center gap-3 text-center',
        variant === 'boxed'
          ? 'rounded-card border border-dashed border-line px-6 py-12'
          : 'px-2 py-8',
        className,
      )}
    >
      <span aria-hidden="true">
        <IconChip icon={icon ?? CloudOff} tone="ardosia" size="lg" />
      </span>
      <p className="text-body font-semibold text-fg-soft">{title}</p>
      {description ? <div className="max-w-sm text-body-sm text-muted">{description}</div> : null}
      {onRetry ? (
        <PanelButton
          className="mt-2"
          icon={RefreshCw}
          onClick={onRetry}
          variant="secondary"
          size="sm"
        >
          {retryLabel}
        </PanelButton>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════ Linha de lista ══════════════════════════════ */

export interface PanelRowProps {
  /** Componente ou elemento. Em RSC, use elemento. */
  icon?: Icone;
  tone?: ChipTone;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Canto direito: chip de status, valor, hora, botão. */
  right?: ReactNode;
  href?: string;
  onClick?: () => void;
  /**
   * Nome acessível da linha inteira. Obrigatório na prática quando `title` ou
   * `subtitle` são elementos: sem ele o leitor de tela lê os pedaços soltos.
   */
  ariaLabel?: string;
  as?: 'div' | 'li';
  className?: string;
}

/**
 * A LINHA — chip + título + subtítulo + ação à direita.
 *
 * É a forma que mais se repete no produto: "Medicamentos de hoje", linha do
 * tempo, exames, consultas, membros da família, itens de configuração. Ela
 * estava sendo remontada à mão em cada tela, um pouco diferente a cada vez —
 * que é exatamente o que uma fundação existe para impedir.
 *
 * A linha inteira é o alvo de toque quando há `href`/`onClick` (`min-h-11`, em
 * rem, então o Modo Sênior a leva a ~57px). O chevron só aparece quando a linha
 * realmente leva a algum lugar.
 */
export function PanelRow({
  icon,
  tone,
  title,
  subtitle,
  right,
  href,
  onClick,
  ariaLabel,
  as: Tag = 'div',
  className,
}: PanelRowProps) {
  const interativa = Boolean(href || onClick);
  const conteudo = (
    <>
      {icon ? <IconChip icon={icon} tone={tone} seed={ariaLabel ?? 'linha'} size="md" /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label font-semibold text-fg">{title}</span>
        {subtitle ? <span className="block text-caption text-muted">{subtitle}</span> : null}
      </span>
      {right ?? (interativa ? <ChevronRight className="h-5 w-5 shrink-0 text-hint" aria-hidden="true" /> : null)}
    </>
  );

  const classes = cx(
    'flex min-h-11 w-full items-center gap-3 rounded-chip px-2 py-2.5 text-left',
    interativa &&
      'transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    className,
  );

  if (href) {
    return (
      <Tag className={Tag === 'li' ? 'list-none' : undefined}>
        <Link href={href} aria-label={ariaLabel} className={classes}>
          {conteudo}
        </Link>
      </Tag>
    );
  }
  if (onClick) {
    return (
      <Tag className={Tag === 'li' ? 'list-none' : undefined}>
        <button type="button" onClick={onClick} aria-label={ariaLabel} className={classes}>
          {conteudo}
        </button>
      </Tag>
    );
  }
  return (
    <Tag aria-label={ariaLabel} className={classes}>
      {conteudo}
    </Tag>
  );
}

/* ══════════════════════════════ Ações rápidas ══════════════════════════════ */

export interface QuickAction {
  label: string;
  /** Componente ou elemento. Em RSC, use elemento. */
  icon: Icone;
  href?: string;
  onClick?: () => void;
  tone?: ChipTone;
}

/** Barra de ações rápidas do rodapé do conteúdo: ícone + rótulo, lado a lado. */
export function QuickActions({
  actions,
  label = 'Ações rápidas',
  className,
  variant = 'cards',
}: {
  actions: QuickAction[];
  label?: string;
  className?: string;
  variant?: 'cards' | 'floating';
}) {
  return (
    <nav
      aria-label={label}
      className={cx(
        variant === 'floating' && 'rounded-[22px] border border-line bg-surface p-1.5 shadow-raised',
        className,
      )}
    >
      <ul className={cx('grid grid-cols-2 sm:grid-cols-4', variant === 'cards' ? 'gap-3' : 'gap-0')}>
        {actions.map((acao) => {
          const conteudo = (
            <>
              <IconChip icon={acao.icon} tone={acao.tone} seed={acao.label} size="sm" />
              <span className="min-w-0 text-label font-medium text-fg">{acao.label}</span>
            </>
          );
          const classes = cx(
            'flex min-h-11 w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            variant === 'cards'
              ? 'rounded-card border border-line bg-surface hover:border-primary/40'
              : 'rounded-2xl hover:bg-surface-2',
          );
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
