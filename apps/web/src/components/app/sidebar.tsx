'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LATERAL DO PAINEL — web
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Clara, recolhível, com os grupos do mockup em maiúsculas pequenas. Item ativo
 * é pílula azul-clara com texto azul (`nav-active-*`, 6,98:1 — medido em
 * `packages/core/src/utils/contraste-painel.test.ts`).
 *
 * O QUE ESTE ARQUIVO NÃO FAZ:
 *  · não declara uma segunda lista de menu — a única é `NAV`/`NAV_SECTIONS`;
 *  · não escreve tamanho de fonte literal (`text-[10px]` matava o Modo Sênior
 *    em todo item de menu: era o degrau mais usado da casca inteira);
 *  · não usa `height` em alvo tocável, só `min-h-11` em rem — com
 *    `html[data-senior] { font-size: 130% }` o item cresce para ~57px sozinho.
 *
 * RECOLHIDA: o rótulo sai da tela, então cada item vira ícone + `title` +
 * `aria-label`. Ícone sozinho sem nome acessível é um botão mudo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronLeft, X } from 'lucide-react';
import { useProfile, useActivePregnancy, useCommunityMember } from '@hubpatients/supabase';
import { calculateAge } from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { useActiveProfile } from '@/components/profile-context';
import {
  NAV,
  NAV_SECTIONS,
  PRIMARY_NAV_SECTION,
  type NavItem,
  type NavSection,
} from './nav';

/** Rodapé da lateral. Fica aqui porque é a única superfície que o exibe. */
const PRODUTO = 'HubPatients';
const VERSAO = 'MVP · v0.1.0';

/** Preferências da casca. Lidas depois da montagem (evita erro de hidratação). */
const CHAVE_RECOLHIDA = 'hp.painel.lateral.recolhida';
const CHAVE_GRUPOS = 'hp.painel.lateral.grupos';

function lerJson<T>(chave: string, padrao: T): T {
  try {
    const cru = window.localStorage.getItem(chave);
    return cru == null ? padrao : (JSON.parse(cru) as T);
  } catch {
    return padrao;
  }
}

function gravarJson(chave: string, valor: unknown): void {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* modo anônimo / cota cheia: a preferência é conforto, não requisito. */
  }
}

export function AppSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  /** `null` = ainda não escolheu nada; cai no padrão (grupo principal aberto). */
  const [gruposAbertos, setGruposAbertos] = useState<NavSection[] | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setCollapsed(lerJson<boolean>(CHAVE_RECOLHIDA, false));
    setGruposAbertos(lerJson<NavSection[] | null>(CHAVE_GRUPOS, null));
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const aside = asideRef.current;
    const focusable = aside?.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab' || !aside) return;
      const items = Array.from(
        aside.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [mobileOpen, onClose]);

  // Jornadas femininas: só no próprio perfil, sexo feminino, idade 12–55.
  const { user } = useAuth();
  const { isViewingDependent } = useActiveProfile();
  const { data: ownProfile } = useProfile(user?.id);
  const { data: activePregnancy } = useActivePregnancy(user?.id);
  const { data: communityMember } = useCommunityMember(user?.id);
  const isStaff =
    communityMember?.staff_role === 'admin' || communityMember?.staff_role === 'moderator';
  const age = ownProfile?.date_of_birth ? calculateAge(ownProfile.date_of_birth) : null;
  const femaleOfAge =
    !isViewingDependent &&
    ownProfile?.biological_sex === 'female' &&
    age != null &&
    age >= 12 &&
    age <= 55;
  const showPregnancy = femaleOfAge;
  const showCycle = femaleOfAge && !activePregnancy;

  const items = useMemo(
    () =>
      NAV.filter((item) => {
        if (item.gate === 'pregnancy') return showPregnancy;
        if (item.gate === 'cycle') return showCycle;
        if (item.gate === 'staff') return isStaff;
        return true;
      }),
    [showPregnancy, showCycle, isStaff],
  );

  const ehRotaAtiva = useCallback(
    (item: NavItem) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    [pathname],
  );

  /** Seção do item aberto agora — `null` numa rota fora do menu. */
  const secaoAtiva = useMemo(
    () => items.find((item) => ehRotaAtiva(item))?.section ?? null,
    [items, ehRotaAtiva],
  );

  /*
   * Quais grupos estão abertos.
   *
   * `null` = a pessoa ainda não escolheu nada; aí o padrão é o grupo principal
   * MAIS o grupo de onde ela está — chegar numa tela e não ver o próprio item no
   * menu é desorientador.
   *
   * O que NÃO fazemos: forçar o grupo da rota atual a ficar aberto para sempre.
   * A versão anterior fazia isso, e o botão do grupo virava um controle morto —
   * clicava, `aria-expanded` prometia mudar, e nada acontecia. Um botão que não
   * responde é pior que um rótulo fixo, porque promete uma ação que não existe.
   */
  const abertos = gruposAbertos ?? [
    PRIMARY_NAV_SECTION,
    ...(secaoAtiva && secaoAtiva !== PRIMARY_NAV_SECTION ? [secaoAtiva] : []),
  ];

  /* Navegou para um grupo fechado? Ele abre. Continua fechável logo em seguida. */
  useEffect(() => {
    if (!secaoAtiva) return;
    setGruposAbertos((atual) =>
      atual && !atual.includes(secaoAtiva) ? [...atual, secaoAtiva] : atual,
    );
  }, [secaoAtiva]);

  /* Persistência num lugar só: o estado é a fonte, o storage é o espelho. */
  useEffect(() => {
    if (gruposAbertos) gravarJson(CHAVE_GRUPOS, gruposAbertos);
  }, [gruposAbertos]);

  function alternarGrupo(secao: NavSection) {
    setGruposAbertos((atual) => {
      const base = atual ?? abertos;
      return base.includes(secao)
        ? base.filter((candidato) => candidato !== secao)
        : [...base, secao];
    });
  }

  function alternarRecolhida() {
    setCollapsed((atual) => {
      gravarJson(CHAVE_RECOLHIDA, !atual);
      return !atual;
    });
  }

  /*
   * "Recolhida" é estado de DESKTOP. A gaveta do telefone tem 264px e mostra
   * rótulo sempre — sem isto, quem recolheu a lateral no computador abria o menu
   * no celular e recebia uma coluna de ícones sem nome dentro de um painel
   * largo, porque a preferência é a mesma em `localStorage` nos dois tamanhos.
   */
  const recolhida = collapsed && !mobileOpen;

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          aria-hidden
        />
      )}

      <aside
        ref={asideRef}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? 'Menu principal' : undefined}
        /* 264 / 76 px vêm de `layout` em @hubpatients/ui-tokens (DESIGN.md §7). */
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] shrink-0 flex-col overscroll-contain border-r border-line bg-surface transition-[transform,width] duration-300 motion-reduce:transition-none lg:static lg:z-20 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${recolhida ? 'lg:w-[76px]' : 'lg:w-[264px]'}`}
      >
        {/* ── Marca + botão « ─────────────────────────────────────────────── */}
        <div
          className={`flex h-[88px] shrink-0 items-center gap-2 border-b border-line ${
            recolhida ? 'justify-center px-2' : 'px-8'
          }`}
        >
          {/*
            Expandida usa a LOGO COMPLETA (símbolo + escrita, `wordmark.png`).
            Recolhida cai no símbolo quadrado (`logo.png`), o único que cabe em
            76px sem esmagar a escrita. O nome NÃO é repetido em texto ao lado:
            com a logo completa, seria a marca escrita duas vezes.
          */}
          <Link
            href="/dashboard"
            onClick={onClose}
            aria-label="HubPatients — ir para a visão geral"
            className="flex min-h-11 items-center rounded-chip focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {recolhida ? (
              <img src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
            ) : (
              <img
                src="/wordmark.png"
                alt=""
                className="h-12 w-auto max-w-[152px] shrink-0 object-contain"
              />
            )}
          </Link>

          {/* Aberta: o « fica no cabeçalho. Recolhida ele não cabe ao lado do
              símbolo e desce para a faixa abaixo — continua no fluxo do Tab. */}
          {!recolhida && (
            <button
              type="button"
              onClick={alternarRecolhida}
              aria-expanded
              aria-label="Recolher menu"
              title="Recolher menu"
              className="ml-auto hidden min-h-11 min-w-11 items-center justify-center rounded-chip text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-chip text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Recolhida, o « sai do cabeçalho (não cabe ao lado do símbolo) e vira
            o primeiro item da navegação — continua alcançável pelo teclado. */}
        {recolhida && (
          <div className="flex justify-center border-b border-line py-2">
            <button
              type="button"
              onClick={alternarRecolhida}
              aria-expanded={false}
              aria-label="Expandir menu"
              title="Expandir menu"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-chip text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ChevronLeft className="h-4 w-4 rotate-180" aria-hidden />
            </button>
          </div>
        )}

        {/* ── Navegação ───────────────────────────────────────────────────── */}
        <nav
          aria-label="Navegação principal"
          className={`flex-1 overflow-y-auto py-3 ${recolhida ? 'px-2' : 'px-3'}`}
        >
          {recolhida ? (
            // Recolhida: lista plana. Agrupar sem rótulo visível seria decoração
            // sem significado — a categoria volta assim que a lateral abre.
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.href}>
                  <ItemLink
                    item={item}
                    collapsed
                    active={ehRotaAtiva(item)}
                    onNavigate={onClose}
                  />
                </li>
              ))}
            </ul>
          ) : (
            NAV_SECTIONS.map((secao, indice) => {
              const grupo = items.filter((i) => i.section === secao);
              if (grupo.length === 0) return null;

              const aberto = abertos.includes(secao);
              const idGrupo = `nav-grupo-${indice}`;

              return (
                <div key={secao} className="mb-1">
                  <button
                    type="button"
                    onClick={() => alternarGrupo(secao)}
                    aria-expanded={aberto}
                    aria-controls={idGrupo}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-chip px-3 text-left text-caption font-semibold uppercase tracking-wider text-hint transition-colors hover:bg-surface-2 hover:text-fg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="min-w-0 truncate">{secao}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${
                        aberto ? 'rotate-180' : ''
                      }`}
                      aria-hidden
                    />
                  </button>
                  <ul id={idGrupo} hidden={!aberto} className="mt-0.5 space-y-0.5">
                    {grupo.map((item) => (
                      <li key={item.href}>
                        <ItemLink
                          item={item}
                          active={ehRotaAtiva(item)}
                          onNavigate={onClose}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </nav>

        {/* ── Rodapé: cartão com o nome do produto e a versão ─────────────── */}
        {!recolhida && (
          <div className="shrink-0 border-t border-line p-5">
            <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-xs">
              <p className="truncate text-label font-semibold text-fg">{PRODUTO}</p>
              <p className="truncate text-caption text-muted">{VERSAO}</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

/* ══════════════════════════════ Item ══════════════════════════════ */

function ItemLink({
  item,
  active,
  collapsed = false,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  /* Estado do módulo em PALAVRAS. O ponto azul é reforço, nunca o único canal —
     um ponto sozinho não diz nada a quem não enxerga a cor (SC 1.4.1). */
  const marca =
    item.plus ? 'Plus' : item.status === 'beta' ? 'em testes' : item.status === 'planned' ? 'em breve' : null;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-chip py-2 text-body-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        collapsed ? 'justify-center px-2' : 'px-3'
      } ${
        active
          ? 'bg-nav-active-tint font-semibold text-nav-active-ink'
          : 'font-medium text-muted hover:bg-surface-2 hover:text-fg'
      }`}
    >
      <Icon className="h-[1.15em] w-[1.15em] shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.plus ? (
            <span className="shrink-0 rounded-full bg-chip-azul-tint px-2 py-0.5 text-caption font-bold uppercase tracking-wide text-chip-azul-ink">
              Plus
            </span>
          ) : marca ? (
            <>
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 rounded-full ${
                  item.status === 'beta' ? 'bg-primary' : 'border border-line-strong'
                }`}
              />
              <span className="sr-only">({marca})</span>
            </>
          ) : null}
        </>
      )}
      {collapsed && marca ? <span className="sr-only">({marca})</span> : null}
    </Link>
  );
}
