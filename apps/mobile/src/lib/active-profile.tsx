import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAccessibleProfiles, useProfile } from '@hubpatients/supabase';
import { useAuth } from './auth';

export interface ActiveProfile {
  id: string;
  name: string;
  isSelf: boolean;
}

interface ActiveProfileState {
  patientId: string;
  ownId: string;
  active: ActiveProfile;
  profiles: ActiveProfile[];
  isViewingDependent: boolean;
  isLoading: boolean;
  switchProfile: (id: string) => void;
}

const ActiveProfileContext = createContext<ActiveProfileState | null>(null);

export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const { user, mfaLoading, mfaRequired } = useAuth();
  const ownId = user?.id ?? '';
  const canLoadPhi = Boolean(user && !mfaLoading && !mfaRequired);
  const safeUserId = canLoadPhi ? user?.id : undefined;
  const { data: ownProfile, isLoading: ownProfileLoading } = useProfile(safeUserId);
  const selfName = ownProfile?.full_name ?? user?.email?.split('@')[0] ?? 'Você';
  const { data: accessible, isLoading: accessibleLoading } = useAccessibleProfiles(safeUserId, selfName);
  const [activeId, setActiveId] = useState<string | null>(null);

  const profiles = useMemo<ActiveProfile[]>(() => {
    if (!ownId) return [];
    return (
      accessible?.map((profile) => ({
        id: profile.id,
        name: profile.name,
        isSelf: profile.isSelf,
      })) ?? [{ id: ownId, name: selfName, isSelf: true }]
    );
  }, [accessible, ownId, selfName]);

  const own = profiles.find((profile) => profile.isSelf) ?? {
    id: ownId,
    name: selfName,
    isSelf: true,
  };
  const active = profiles.find((profile) => profile.id === activeId) ?? own;

  // Troca de conta e revogação de vínculo sempre retornam ao próprio perfil.
  useEffect(() => {
    if (!activeId) return;
    if (!profiles.some((profile) => profile.id === activeId)) setActiveId(null);
  }, [activeId, profiles]);

  useEffect(() => setActiveId(null), [ownId]);

  const switchProfile = useCallback(
    (id: string) => {
      // Não aceita IDs arbitrários; somente perfis retornados pela consulta com RLS.
      if (profiles.some((profile) => profile.id === id)) setActiveId(id);
    },
    [profiles],
  );

  const value = useMemo<ActiveProfileState>(
    () => ({
      patientId: active.id,
      ownId,
      active,
      profiles,
      isViewingDependent: Boolean(active.id && !active.isSelf),
      isLoading: Boolean(ownId && (mfaLoading || mfaRequired || ownProfileLoading || accessibleLoading)),
      switchProfile,
    }),
    [accessibleLoading, active, mfaLoading, mfaRequired, ownId, ownProfileLoading, profiles, switchProfile],
  );

  return <ActiveProfileContext.Provider value={value}>{children}</ActiveProfileContext.Provider>;
}

export function useActiveProfile(): ActiveProfileState {
  const context = useContext(ActiveProfileContext);
  if (!context) throw new Error('useActiveProfile deve ser usado dentro de <ActiveProfileProvider>.');
  return context;
}
