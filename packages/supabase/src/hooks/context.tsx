'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { HubPatientsClient } from '../types';

const HubPatientsClientContext = createContext<HubPatientsClient | null>(null);

/**
 * Provider do client Supabase. Web e mobile criam o client com seus próprios
 * adaptadores (cookies / secure-store) e o injetam aqui — os hooks abaixo
 * passam a funcionar igual nas duas plataformas.
 */
export function HubPatientsClientProvider({
  client,
  children,
}: {
  client: HubPatientsClient;
  children: ReactNode;
}) {
  return <HubPatientsClientContext.Provider value={client}>{children}</HubPatientsClientContext.Provider>;
}

export function useHubPatientsClient(): HubPatientsClient {
  const client = useContext(HubPatientsClientContext);
  if (!client) {
    throw new Error('useHubPatientsClient deve ser usado dentro de <HubPatientsClientProvider>.');
  }
  return client;
}
