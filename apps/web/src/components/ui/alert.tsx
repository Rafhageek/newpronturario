import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<AlertTone, { wrap: string; icon: LucideIcon; iconColor: string }> = {
  info: { wrap: 'border-sky-400/20 bg-sky-500/[0.06]', icon: Info, iconColor: 'text-primary' },
  success: { wrap: 'border-emerald-400/20 bg-emerald-500/[0.06]', icon: CheckCircle2, iconColor: 'text-status-ok-ink' },
  warning: { wrap: 'border-amber-500/25 bg-amber-500/[0.06]', icon: AlertTriangle, iconColor: 'text-status-attention-ink' },
  danger: { wrap: 'border-rose-500/30 bg-rose-500/[0.06]', icon: XCircle, iconColor: 'text-status-alert-ink' },
};

/** Banner/aviso padronizado, com semântica de leitura para alertas. */
export function Alert({
  tone = 'info',
  title,
  children,
  className = '',
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : undefined}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 ${t.wrap} ${className}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${t.iconColor}`} aria-hidden />
      <div className="text-xs leading-relaxed text-fg-soft">
        {title && <p className="font-semibold text-fg">{title}</p>}
        {children}
      </div>
    </div>
  );
}
