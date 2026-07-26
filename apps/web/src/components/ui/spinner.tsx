import { Loader2 } from 'lucide-react';

/** Indicador de carregamento inline (para botões e seções pequenas). */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />;
}
