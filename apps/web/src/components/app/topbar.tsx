'use client';

import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useProfile } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { ProfileSwitcher } from '@/components/app/profile-switcher';
import { ThemeMenu, LanguageMenu, NotificationsMenu, UserMenu } from '@/components/app/topbar-menus';

function greeting(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function AppTopbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile(user?.id);

  const now = new Date();
  const firstName =
    profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Paciente';
  const initial = firstName.charAt(0).toUpperCase();
  const dateLabel = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Menu (mobile) */}
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-fg-soft transition hover:bg-surface-2 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-fg sm:text-base">
            {greeting(now.getHours())}, {firstName} <span aria-hidden>👋</span>
          </h1>
          <p className="hidden truncate text-xs capitalize text-muted sm:block">
            {dateLabel} · aqui está o resumo da sua saúde hoje.
          </p>
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
