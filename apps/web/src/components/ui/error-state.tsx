'use client';

import { RotateCw, WifiOff } from 'lucide-react';

/** Estado de erro com recuperação (botão tentar novamente). */
export function ErrorState({
  message = 'Não foi possível carregar agora.',
  onRetry,
  className = '',
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center ${className}`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2">
        <WifiOff className="h-6 w-6 text-faint" aria-hidden />
      </span>
      <p className="text-sm text-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-4 text-sm font-medium text-fg-soft transition hover:bg-surface-2"
        >
          <RotateCw className="h-4 w-4" /> Tentar novamente
        </button>
      )}
    </div>
  );
}
