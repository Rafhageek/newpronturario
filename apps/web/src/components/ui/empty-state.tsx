import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Estado vazio padronizado: ícone + mensagem + ação opcional. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-6 py-14 text-center ${className}`}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2">
        <Icon className="h-7 w-7 text-faint" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-fg-soft">{title}</p>
      {description && <p className="max-w-xs text-xs text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
