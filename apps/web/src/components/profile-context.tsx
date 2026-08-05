'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useProfile, useAccessibleProfiles } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';

export interface ActiveProfile {
  id: string;
  name: string;
  isSelf: boolean;
}

interface ProfileContextValue {
  /** ID do perfil ATIVO — é o que as telas de dados devem usar como patientId. */
  patientId: string;
  /**
   * O `patientId` acima já vale como resposta?
   *
   * Enquanto a sessão não é resolvida, `patientId` é `''` — e `''` desliga as
   * consultas (`enabled: false`), o que no React Query v5 deixa `isLoading` e
   * `isError` AMBOS `false`. Uma tela que só olha essas duas flags conclui que
   * terminou de carregar e que não há nada, e escreve "Nenhuma registrada"
   * sobre um paciente que ela ainda não identificou.
   *
   * Este flag é o terceiro estado que faltava: `false` significa "ainda não sei
   * de quem é este prontuário", que NÃO é "este prontuário está vazio".
   */
  isPatientKnown: boolean;
  ownId: string;
  active: ActiveProfile;
  profiles: ActiveProfile[];
  isViewingDependent: boolean;
  switchProfile: (id: string) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  // `loading` é indispensável: sem ele o provedor anuncia `ownId = ''` com a
  // mesma cara de "usuário sem id" que teria depois de um logout, e as telas
  // não conseguem separar os dois casos.
  const { user, loading: authLoading } = useAuth();
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

  const value: ProfileContextValue = useMemo(() => {
    const patientId = active?.id ?? ownId;
    return {
      patientId,
      // Só é "conhecido" com a sessão resolvida E um id de verdade na mão.
      isPatientKnown: !authLoading && patientId !== '',
      ownId,
      active: active ?? { id: ownId, name: selfName, isSelf: true },
      profiles,
      isViewingDependent: Boolean(active && !active.isSelf),
      switchProfile: (id: string) => setActiveId(id),
    };
  }, [active, authLoading, ownId, selfName, profiles]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useActiveProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useActiveProfile deve ser usado dentro de <ProfileProvider>.');
  return ctx;
}
