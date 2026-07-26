/** Placeholders de carregamento coerentes (substituem os animate-pulse soltos). */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-surface-2 ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-surface-2"
          style={{ width: i === lines - 1 ? '70%' : '100%' }}
        />
      ))}
    </div>
  );
}

/** Skeleton de um card com avatar + linhas. */
export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4" aria-hidden>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-surface-2" />
        <div className="flex-1">
          <SkeletonText lines={2} />
        </div>
      </div>
    </div>
  );
}

/** Lista de cards skeleton. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Carregando…">
      {Array.from({ length: rows }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
