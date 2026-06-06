'use client';

import { useState } from 'react';
import { Check, ChevronDown, Users } from 'lucide-react';
import { useActiveProfile } from '@/components/profile-context';

export function ProfileSwitcher() {
  const { active, profiles, switchProfile } = useActiveProfile();
  const [open, setOpen] = useState(false);

  if (profiles.length <= 1) return null; // sem dependentes: não mostra o switcher

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-sm text-fg transition hover:bg-surface-2"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-400 text-xs font-bold text-white">
          {active.name.charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[120px] truncate">{active.isSelf ? 'Meu perfil' : active.name}</span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs text-muted">
            <Users className="h-3.5 w-3.5" /> Trocar de perfil
          </div>
          {profiles.map((p) => (
            <button
              key={p.id}
              onMouseDown={() => switchProfile(p.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-fg transition hover:bg-surface-2"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-400 text-xs font-bold text-white">
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 truncate">{p.isSelf ? 'Meu perfil' : p.name}</span>
              {p.id === active.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
