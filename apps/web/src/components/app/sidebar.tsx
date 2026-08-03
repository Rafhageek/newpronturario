'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

export function AppSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<NavSection[]>([]);
  const asideRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

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

  function toggleSection(section: NavSection) {
    setExpandedSections((current) =>
      current.includes(section)
        ? current.filter((candidate) => candidate !== section)
        : [...current, section],
    );
  }

  function ItemLink({ item }: { item: NavItem }) {
    // Ativo no item exato OU em qualquer subrota (ex.: /diario/novo → Diário).
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={onClose}
        title={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
          active
            ? 'bg-primary/10 font-semibold text-primary'
            : 'font-medium text-muted hover:bg-surface-2 hover:text-fg'
        }`}
      >
        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-primary' : ''}`} />
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            {item.plus && (
              <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                Plus
              </span>
            )}
            {!item.plus && item.status === 'beta' && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary/60" title="Em testes (beta)" />
            )}
            {!item.plus && item.status === 'planned' && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400/60" title="Em breve" />
            )}
          </>
        )}
      </Link>
    );
  }

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
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] shrink-0 flex-col overscroll-contain border-r border-line bg-surface transition-transform duration-300 lg:static lg:z-20 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-[76px]' : 'lg:w-[256px]'}`}
      >
        {/* Logo */}
        <div className="flex h-[72px] items-center gap-2.5 border-b border-line px-5">
          <img
            src="/logo.png"
            alt={collapsed ? 'HubPatients' : ''}
            aria-hidden={collapsed ? undefined : true}
            width={36}
            height={36}
            className="h-9 w-9 shrink-0"
          />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-fg" style={{ fontFamily: 'var(--font-display)' }}>
              Hub<span className="text-primary">Patients</span>
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto hidden h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg-soft lg:flex"
            aria-label="Recolher menu"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg-soft lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navegação */}
        <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 py-4">
          {collapsed ? (
            // recolhido → lista plana
            <div className="space-y-0.5">
              {items.map((item) => (
                <ItemLink key={item.href} item={item} />
              ))}
            </div>
          ) : (
            // padrão → agrupado por seção
            NAV_SECTIONS.map((section, sectionIndex) => {
              const group = items.filter((i) => i.section === section);
              if (group.length === 0) return null;
              const containsActiveRoute = group.some(
                (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
              );
              const isPrimary = section === PRIMARY_NAV_SECTION;
              const isExpanded =
                isPrimary || containsActiveRoute || expandedSections.includes(section);
              const sectionId = `nav-section-${sectionIndex}`;
              return (
                <div key={section} className="mb-2">
                  {isPrimary || containsActiveRoute ? (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                      {section}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSection(section)}
                      aria-expanded={isExpanded}
                      aria-controls={sectionId}
                      className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-faint transition hover:bg-surface-2 hover:text-fg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <span>{section}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </button>
                  )}
                  <div id={sectionId} hidden={!isExpanded} className="space-y-0.5">
                    {group.map((item) => (
                      <ItemLink key={item.href} item={item} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </nav>

        {/* Rodapé */}
        {!collapsed && (
          <div className="border-t border-line px-5 py-4">
            <p className="text-xs font-semibold text-fg-soft">HubPatients</p>
            <p className="text-[11px] text-muted">MVP · v0.1.0</p>
          </div>
        )}
      </aside>
    </>
  );
}
