import { Skeleton, ListSkeleton } from '@/components/ui/skeleton';

/**
 * UI de carregamento da área logada. O App Router troca o conteúdo por este
 * skeleton IMEDIATAMENTE ao navegar (a sidebar/topbar do layout permanecem),
 * o que faz a navegação parecer instantânea em vez de "travada". A barra fina
 * no topo dá o feedback de progresso enquanto a rota carrega.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <span className="vl-route-bar" aria-hidden />
      {/* cabeçalho */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* faixa de métricas (dashboard-like) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <ListSkeleton rows={3} />
      <span className="sr-only" role="status">
        Carregando…
      </span>
    </div>
  );
}
