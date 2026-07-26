import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  Activity,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  NotebookPen,
  Pill,
  ShieldAlert,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from 'lucide-react-native';
import {
  useClinicalTimeline,
  type ClinicalTimelineEvent,
  type ClinicalTimelineEventType,
} from '@hubpatients/supabase';
import { useActiveProfile } from '@/lib/active-profile';
import { AppHeader, Badge, Button, Card, EmptyState, ErrorState, Screen } from '@/components/ui';
import { SkeletonList } from '@/components/feedback';
import { fonts, useColors } from '@/theme';

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

const MESES_ABREV = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/**
 * Formatação MANUAL de propósito.
 *
 * Aqui havia `new Intl.DateTimeFormat('pt-BR', { dateStyle, timeStyle })` no
 * escopo do MÓDULO. O Hermes não implementa `dateStyle`/`timeStyle`/`timeZone`,
 * e por estar no escopo do módulo o erro acontecia no import — ou seja, o app
 * fechava ao ABRIR esta tela, sem chance de a tela de erro aparecer.
 * O resto do app já evita `Intl` pelo mesmo motivo: ver os avisos em
 * `compartilhar.tsx`, `notificacoes.tsx` e `(tabs)/medicamentos.tsx`.
 */
function formatEventDate(event: ClinicalTimelineEvent): string {
  const d = new Date(event.occurredAt);
  if (Number.isNaN(d.getTime())) return '—';
  if (event.dateOnly) {
    // Data sem hora: ler em UTC para não voltar um dia por causa do fuso.
    const mes = MESES_ABREV[d.getUTCMonth()] ?? '';
    return `${d.getUTCDate()} de ${mes} de ${d.getUTCFullYear()}`;
  }
  const mes = MESES_ABREV[d.getMonth()] ?? '';
  return `${d.getDate()} de ${mes} de ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function LinhaDoTempoScreen() {
  const colors = useColors();
  const { patientId, active } = useActiveProfile();
  const timeline = useClinicalTimeline(patientId || undefined);
  const events = timeline.data?.pages.flatMap((page) => page.events) ?? [];
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await timeline.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Linha do tempo"
        subtitle={active.isSelf ? 'Seus registros clínicos' : `Registros de ${active.name}`}
        back
      />
      <Screen onRefresh={() => void refresh()} refreshing={refreshing}>
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3">
          <HeartPulse size={17} color={colors.primary} style={{ marginTop: 2 }} />
          <Text
            maxFontSizeMultiplier={1.6}
            style={{ fontFamily: fonts.regular }}
            className="flex-1 text-[13px] leading-5 text-muted"
          >
            Reunimos registros existentes e mantemos a fonte de cada item. Esta visão não
            cria diagnósticos nem substitui avaliação profissional.
          </Text>
        </View>

        {timeline.isLoading ? (
          <SkeletonList rows={5} />
        ) : timeline.isError && !timeline.data ? (
          <ErrorState
            title="Não conseguimos carregar a linha do tempo"
            onRetry={() => void timeline.refetch()}
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhum registro disponível"
            subtitle="Novos registros clínicos aparecerão aqui em ordem cronológica."
          />
        ) : (
          <View className="gap-3">
            {events.map((event) => (
              <TimelineItem key={event.eventKey} event={event} />
            ))}

            {timeline.isFetchNextPageError ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                style={{ fontFamily: fonts.regular }}
                className="text-center text-[13px] text-semaphore-alert"
              >
                A próxima página não foi carregada. Tente novamente.
              </Text>
            ) : null}

            {timeline.hasNextPage ? (
              <Button
                label={timeline.isFetchingNextPage ? 'Carregando…' : 'Carregar registros anteriores'}
                variant="outline"
                loading={timeline.isFetchingNextPage}
                onPress={() => void timeline.fetchNextPage()}
              />
            ) : null}
          </View>
        )}
      </Screen>
    </View>
  );
}

function TimelineItem({ event }: { event: ClinicalTimelineEvent }) {
  const colors = useColors();
  const presentation = EVENT_PRESENTATION[event.eventType];
  const Icon = presentation.icon;
  const status = event.status ? (STATUS_LABELS[event.status] ?? event.status) : null;
  const spoken = [
    presentation.label,
    event.title,
    event.summary,
    status,
    formatEventDate(event),
  ].filter(Boolean).join('. ');

  return (
    <View accessible accessibilityLabel={spoken}>
      <Card className="gap-2">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-2xl bg-trust-100">
            <Icon size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-primary">
              {presentation.label}
            </Text>
            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
              {formatEventDate(event)}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.semibold }} className="text-[16px] text-fg">
          {event.title}
        </Text>
        {event.summary ? (
          <Text
            maxFontSizeMultiplier={1.6}
            style={{ fontFamily: fonts.regular }}
            className="text-[13px] leading-5 text-muted"
          >
            {event.summary}
          </Text>
        ) : null}
        {status ? <Badge tone="neutral">{status}</Badge> : null}
      </Card>
    </View>
  );
}
