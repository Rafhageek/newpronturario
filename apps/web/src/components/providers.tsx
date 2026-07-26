'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { MotionConfig } from 'framer-motion';
import { HubPatientsClientProvider } from '@hubpatients/supabase';
import { createClient } from '@/lib/supabase/client';
import { AuthProvider } from '@/components/auth-provider';
import { AccessibilityProvider } from '@/components/a11y-provider';

/** Providers globais do app: React Query + client Supabase (para os hooks). */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Dados de saúde mudam devagar: cache mais longo deixa a navegação
            // de volta a telas já visitadas INSTANTÂNEA (sem refetch/spinner).
            staleTime: 2 * 60_000, // 2 min "fresco" → sem refetch ao revisitar
            gcTime: 10 * 60_000, // mantém em memória por 10 min
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      }),
  );
  const [supabase] = useState(() => createClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <HubPatientsClientProvider client={supabase}>
            <AccessibilityProvider>
              <AuthProvider>{children}</AuthProvider>
            </AccessibilityProvider>
          </HubPatientsClientProvider>
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
