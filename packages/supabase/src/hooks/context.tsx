'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { VidaLogClient } from '../types';

const VidaLogClientContext = createContext<VidaLogClient | null>(null);

/**
 * Provider do client Supabase. Web e mobile criam o client com seus próprios
 * adaptadores (cookies / secure-store) e o injetam aqui — os hooks abaixo
 * passam a funcionar igual nas duas plataformas.
 */
export function VidaLogClientProvider({
  client,
  children,
}: {
  client: VidaLogClient;
  children: ReactNode;
}) {
  return <VidaLogClientContext.Provider value={client}>{children}</VidaLogClientContext.Provider>;
}

export function useVidaLogClient(): VidaLogClient {
  const client = useContext(VidaLogClientContext);
  if (!client) {
    throw new Error('useVidaLogClient deve ser usado dentro de <VidaLogClientProvider>.');
  }
  return client;
}
