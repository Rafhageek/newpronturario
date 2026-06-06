'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { VidaLogClientProvider } from '@vidalog/supabase';
import { createClient } from '@/lib/supabase/client';
import { AuthProvider } from '@/components/auth-provider';

/** Providers globais do app: React Query + client Supabase (para os hooks). */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const [supabase] = useState(() => createClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <VidaLogClientProvider client={supabase}>
          <AuthProvider>{children}</AuthProvider>
        </VidaLogClientProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
