'use client';

import {
  Activity,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  NotebookPen,
  Pill,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from 'lucide-react';
import {
  useClinicalTimeline,
  type ClinicalTimelineEvent,
  type ClinicalTimelineEventType,
} from '@hubpatients/supabase';
import { useActiveProfile } from '@/components/profile-context';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/painel';

const EVENT_PRESENTATION: Record<
  ClinicalTimelineEventType,
  { label: string; icon: LucideIcon }
> = {
  vital: { label: 'Sinal vital', icon: Activity },
  diary: { label: 'Diário clínico', icon: NotebookPen },
  exam: { label: 'Exame', icon: FlaskConical },
  medication: { label: 'Medicamento', icon: Pill },
  medication_intake: { label: 'Tomada registrada', icon: Pill },
  appointment: { label: 'Consulta', icon: CalendarDays },
  condition: { label: 'Condição registrada', icon: ClipboardList },
  allergy: { label: 'Alergia registrada', icon: ShieldAlert },
  surgery: { label: 'Procedimento', icon: Stethoscope },
  vaccination: { label: 'Vacinação', icon: Syringe },
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  pending: 'Pendente',
  taken: 'Tomado',
  skipped: 'Não tomado',
  uploaded: 'Enviado',
  processing: 'Em processamento',
  processed: 'Processado',
  scheduled: 'Agendada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  resolved: 'Resolvida',
  suspected: 'Suspeita registrada',
  controlled: 'Controlada',
  mild: 'Leve',
  moderate: 'Moderada',
  severe: 'Grave',
  planned: 'Planejada',
  applied: 'Aplicada',
};

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const DATE_ONLY_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export default function LinhaDoTempoPage() {
  const { patientId, active } = useActiveProfile();
  const timeline = useClinicalTimeline(patientId || undefined);
  const events = timeline.data?.pages.flatMap((page) => page.events) ?? [];

  return (
    <main className="mx-auto max-w-5xl space-y-5 hp-page">
      <PageHeader
        eyebrow="Prontuário"
        title="Linha do tempo clínica"
        subtitle={
          active.isSelf
            ? 'Seus registros organizados pela data original.'
            : `Registros de ${active.name}, conforme suas permissões de cuidado.`
        }
        icon={ClipboardList}
        tone="azul"
      />

      <aside className="flex items-start gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-xs leading-5 text-muted">
        <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p>
          Esta visão reúne registros existentes e identifica a fonte de cada item. Ela não
          cria diagnósticos nem substitui avaliação profissional.
        </p>
      </aside>

      {timeline.isLoading ? (
        <ListSkeleton rows={5} />
      ) : timeline.isError && !timeline.data ? (
        <ErrorState
          message="Não foi possível carregar a linha do tempo."
          onRetry={() => void timeline.refetch()}
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum registro disponível"
          description="Novos registros clínicos aparecerão aqui em ordem cronológica."
        />
      ) : (
        <>
          <ol className="relative space-y-3 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-line">
            {events.map((event) => (
              <TimelineItem key={event.eventKey} event={event} />
            ))}
          </ol>

          {timeline.isFetchNextPageError && (
            <div role="alert" className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">
              A próxima página não foi carregada. Tente novamente.
            </div>
          )}

          {timeline.hasNextPage && (
            <button
              type="button"
              onClick={() => void timeline.fetchNextPage()}
              disabled={timeline.isFetchingNextPage}
              aria-busy={timeline.isFetchingNextPage}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${timeline.isFetchingNextPage ? 'animate-spin' : ''}`}
                aria-hidden
              />
              {timeline.isFetchingNextPage ? 'Carregando…' : 'Carregar registros anteriores'}
            </button>
          )}
        </>
      )}
    </main>
  );
}

function TimelineItem({ event }: { event: ClinicalTimelineEvent }) {
  const presentation = EVENT_PRESENTATION[event.eventType];
  const Icon = presentation.icon;
  const status = event.status ? (STATUS_LABELS[event.status] ?? event.status) : null;

  return (
    <li className="relative grid grid-cols-[2.5rem_1fr] gap-3">
      <span className="z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface">
        <Icon className="h-5 w-5 text-primary" aria-hidden />
      </span>
      <article className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-primary">{presentation.label}</span>
          <time dateTime={event.occurredAt} className="text-xs text-muted">
            {(event.dateOnly ? DATE_ONLY_FORMAT : DATE_FORMAT).format(new Date(event.occurredAt))}
          </time>
        </div>
        <h2 className="mt-1 text-base font-semibold text-fg">{event.title}</h2>
        {event.summary && <p className="mt-1 text-sm leading-5 text-muted">{event.summary}</p>}
        {status && (
          <span className="mt-2 inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-soft">
            {status}
          </span>
        )}
      </article>
    </li>
  );
}
