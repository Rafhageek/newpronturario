'use client';

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
    <header className="flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg-soft transition hover:bg-surface-2 lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <AppSearch />
        <div className="min-w-0 md:hidden">
          <p className="truncate text-sm font-bold text-fg">HubPatients</p>
          <p className="truncate text-xs text-muted">Seu prontuário de saúde</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <div className="hidden items-center gap-1.5 sm:flex">
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
