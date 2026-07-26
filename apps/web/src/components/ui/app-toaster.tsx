'use client';

import type { CSSProperties } from 'react';
import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';

/**
 * Toaster do HubPatients — visual moderno e coerente com os tokens.
 * Fundo neutro (surface) com vidro fosco + ícone colorido por tipo (em vez de
 * cores berrantes de fundo). Tema acompanha claro/escuro. Toasts são apenas
 * feedback de UX — alertas clínicos críticos usam banners não-dispensáveis.
 */
export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="top-right"
      gap={10}
      offset={16}
      closeButton
      style={
        {
          '--normal-bg': 'var(--surface)',
          '--normal-text': 'var(--fg)',
          '--normal-border': 'var(--line)',
        } as CSSProperties
      }
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: 'vl-toast',
          title: 'vl-toast-title',
          description: 'vl-toast-desc',
          closeButton: 'vl-toast-close',
          icon: 'vl-toast-icon',
        },
      }}
      icons={{
        success: <CheckCircle2 className="h-[18px] w-[18px] text-status-ok-ink" />,
        error: <XCircle className="h-[18px] w-[18px] text-status-alert-ink" />,
        info: <Info className="h-[18px] w-[18px] text-status-info-ink" />,
        warning: <AlertTriangle className="h-[18px] w-[18px] text-status-attention-ink" />,
        loading: <Loader2 className="h-[18px] w-[18px] animate-spin text-primary" />,
      }}
    />
  );
}
