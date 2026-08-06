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
      className={`flex flex-col items-center justify-center gap-3 rounded-card border border-line bg-[linear-gradient(145deg,var(--surface-2),var(--surface))] px-6 py-14 text-center shadow-card ${className}`}
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-chip-azul-tint text-chip-azul-ink shadow-sm">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <p className="text-body font-semibold text-fg">{title}</p>
      {description && <p className="max-w-md text-body-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
