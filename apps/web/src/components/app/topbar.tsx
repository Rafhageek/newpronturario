'use client';

/**
 * Barra do topo do Painel: menu (telefone), busca larga com `Ctrl + K`,
 * alternador de tema, sino com contador e avatar.
 *
 * Altura 88px (`layout.topbarHeight` em @hubpatients/ui-tokens) — a mesma do
 * cabeçalho da lateral, senão as duas linhas divisórias ficam desalinhadas.
 */

import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useProfile } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { AppSearch } from '@/components/app/app-search';
import { ProfileSwitcher } from '@/components/app/profile-switcher';
import {
  LanguageMenu,
  NotificationsMenu,
  ThemeMenu,
  UserMenu,
} from '@/components/app/topbar-menus';

export function AppTopbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile(user?.id);

  const firstName =
    profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Paciente';
  const initial = firstName.charAt(0).toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="relative z-20 flex h-[88px] shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/80 px-3 backdrop-blur-md sm:px-6 xl:px-12">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-chip text-fg-soft transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <AppSearch />
        {/* No telefone a busca some e o espaço vira identidade da tela. */}
        <div className="min-w-0 md:hidden">
          <p className="truncate text-body-sm font-bold text-fg">HubPatients</p>
          <p className="truncate text-caption text-muted">Seu prontuário de saúde</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden items-center gap-1 sm:flex">
          <ProfileSwitcher />
          <LanguageMenu />
          <ThemeMenu />
        </div>
        <NotificationsMenu />
        <div className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <UserMenu
          initial={initial}
          name={profile?.full_name ?? firstName}
          email={user?.email ?? undefined}
          onSignOut={handleSignOut}
        />
      </div>
    </header>
  );
}
