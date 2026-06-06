'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useProfile, useAccessibleProfiles } from '@vidalog/supabase';
import { useAuth } from '@/components/auth-provider';

export interface ActiveProfile {
  id: string;
  name: string;
  isSelf: boolean;
}

interface ProfileContextValue {
  /** ID do perfil ATIVO — é o que as telas de dados devem usar como patientId. */
  patientId: string;
  ownId: string;
  active: ActiveProfile;
  profiles: ActiveProfile[];
  isViewingDependent: boolean;
  switchProfile: (id: string) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const ownId = user?.id ?? '';
  const { data: ownProfile } = useProfile(user?.id);
  const selfName = ownProfile?.full_name ?? user?.email?.split('@')[0] ?? 'Você';
  const { data: accessible } = useAccessibleProfiles(user?.id, selfName);

  const [activeId, setActiveId] = useState<string | null>(null);

  const profiles: ActiveProfile[] = useMemo(
    () => accessible?.map((p) => ({ id: p.id, name: p.name, isSelf: p.isSelf })) ?? [{ id: ownId, name: selfName, isSelf: true }],
    [accessible, ownId, selfName],
  );

  const active = profiles.find((p) => p.id === activeId) ?? profiles.find((p) => p.isSelf) ?? profiles[0]!;

  const value: ProfileContextValue = useMemo(
    () => ({
      patientId: active?.id ?? ownId,
      ownId,
      active: active ?? { id: ownId, name: selfName, isSelf: true },
      profiles,
      isViewingDependent: Boolean(active && !active.isSelf),
      switchProfile: (id: string) => setActiveId(id),
    }),
    [active, ownId, selfName, profiles],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useActiveProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useActiveProfile deve ser usado dentro de <ProfileProvider>.');
  return ctx;
}
