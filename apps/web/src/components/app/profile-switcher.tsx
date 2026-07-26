'use client';

import { ChevronDown, Users } from 'lucide-react';
import { useActiveProfile } from '@/components/profile-context';

export function ProfileSwitcher() {
  const { active, profiles, switchProfile } = useActiveProfile();

  if (profiles.length <= 1) return null;

  return (
    <label className="relative flex min-h-11 items-center rounded-xl border border-line bg-surface text-sm text-fg shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
      <span className="sr-only">Perfil de saúde ativo</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary"
      >
        {active.isSelf ? active.name.charAt(0).toUpperCase() : <Users className="h-4 w-4" />}
      </span>
      <select
        aria-label="Perfil de saúde ativo"
        value={active.id}
        onChange={(event) => switchProfile(event.target.value)}
        className="min-h-11 max-w-52 cursor-pointer appearance-none rounded-xl bg-transparent py-2 pl-11 pr-9 font-medium outline-none"
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.isSelf ? 'Meu perfil' : profile.name}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 h-4 w-4 text-muted"
      />
    </label>
  );
}
