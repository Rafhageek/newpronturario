import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';

/** Stub elegante para seções planejadas em fases futuras. */
export function ComingSoon({
  icon: Icon,
  title,
  description,
  phase,
  plus,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase?: number;
  plus?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface-2 text-primary">
        <Icon className="h-7 w-7" />
      </span>
      <div className="mt-5 flex items-center gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-fg" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h2>
        {plus && (
          <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Plus
          </span>
        )}
      </div>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      <span className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <Sparkles className="h-3.5 w-3.5" />
        {phase ? `Em desenvolvimento · Fase ${phase}` : 'Em desenvolvimento'}
      </span>
    </div>
  );
}
