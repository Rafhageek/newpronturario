'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PAINEL — visão geral
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Primeira tela reescrita sobre a fundação (docs/DESIGN.md). Ela não inventa
 * vocabulário: cartão, chip, botão, estado vazio e cabeçalho vêm todos de
 * `@/components/ui/painel`. Se você precisou de um hex, um `fontSize` ou um raio
 * AQUI, a peça está faltando na fundação — abra lá, não aqui.
 *
 * TRÊS COISAS QUE ESTA TELA PROTEGE (e que um redesenho desfaz sem querer):
 *
 * 1. NÃO AFIRMAR O QUE NÃO SE SABE. Quem decide se a tela pode dizer "nenhuma
 *    alergia registrada" é `estadoSecao`/`estadoAgregado`, não `isLoading`. As
 *    duas flags do React Query são `false` juntas enquanto `patientId` está
 *    vazio (`enabled: false`), e foi assim que a tela já afirmou ausência de
 *    alergia sobre um paciente que ainda não tinha sido identificado. Falha de
 *    carregamento vira `ErrorState` com "tentar de novo" — nunca "não há nada".
 *
 * 2. A DICA SEGUE O ESTADO. O mockup trazia "Nenhuma registrada" com "Informado
 *    por você" logo embaixo. Se não há registro, ninguém informou: quando o
 *    cartão está vazio a dica vira um caminho ("Você pode informar no perfil"),
 *    e nunca uma atribuição de autoria.
 *
 * 3. COR NUNCA NO CORPO DO PACIENTE. A faixa da pressão sai em PALAVRAS
 *    (`leituraDaFaixa`) + seta neutra (`Trend`); os chips dos cartões são de
 *    CATEGORIA e a paleta não tem verde, âmbar nem vermelho para escolher. O
 *    humor usa `<MoodScale>`/`<MoodMark>`: forma + rótulo, um matiz só. Âmbar e
 *    vermelho aparecem apenas em status de AGENDA (`SystemStatusChip`), que é
 *    domínio do sistema. Trava: `packages/core/src/utils/regra-cor-clinica.test.ts`.
 *
 * Datas e horas são formatadas pelos utilitários PT-BR do `@hubpatients/core`,
 * sem `Intl` — o mobile roda em Hermes, e paridade também é ter um formatador só.
 */

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Droplets,
  FileHeart,
  FlaskConical,
  HeartPulse,
  History,
  Hospital,
  NotebookPen,
  Pill,
  QrCode,
  Scale,
  Send,
  Share2,
  ShieldCheck,
  Smile,
  Stethoscope,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useAllergies,
  useAppointments,
  useClinicalTimeline,
  useConditions,
  useCreateDiaryEntry,
  useDashboard,
  useDiaryEntries,
  useDiarySummary,
  useNextAppointment,
  useProfile,
  useRegisterIntake,
  useVitals,
  useVitalsRange,
} from '@hubpatients/supabase';
import {
  APPOINTMENT_KIND_LABELS,
  DIAS_SEMANA_PT,
  DISCLAIMERS,
  MEDICATION_FORM_LABELS,
  MEDICATION_FREQUENCY_LABELS,
  classifyBloodPressure,
  computeBMI,
  dataDoDia,
  diaEMes,
  diaLocal,
  estadoAgregado,
  estadoSecao,
  formatVital,
} from '@hubpatients/core';
import { useActiveProfile } from '@/components/profile-context';
import { ConstancyCard } from '@/components/dashboard/constancy-card';
import { WaterCard } from '@/components/dashboard/water-card';
import { TrendChip } from '@/components/dashboard/trend-chip';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/error-state';
import { SystemStatusChip, Trend } from '@/components/dashboard/metric-cards';
import { leituraDaFaixa } from '@/components/dashboard/clinical-range-chip';
import {
  IlustracaoAgenda,
  IlustracaoDiario,
  IlustracaoRemedio,
} from '@/components/dashboard/empty-illustrations';
import {
  EmptyState,
  IconChip,
  MoodMark,
  MoodScale,
  PageHeader,
  PanelButton,
  PanelCard,
  QuickActions,
  Seal,
  SectionHeader,
  StatCard,
  StatRow,
  type QuickAction,
} from '@/components/ui/painel';
import { toast } from 'sonner';

const BloodPressureChart = dynamic(
  () => import('@/components/dashboard/bp-chart').then((module) => module.BloodPressureChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-60 animate-pulse rounded-card bg-surface-2" role="status">
        <span className="sr-only">Carregando gráfico de pressão arterial</span>
      </div>
    ),
  },
);

const TIMELINE_ICONS = {
  appointment: CalendarDays,
  exam: FlaskConical,
  surgery: Hospital,
} satisfies Partial<Record<string, LucideIcon>>;

const TIMELINE_STATUS: Record<string, string> = {
  scheduled: 'Agendada',
  completed: 'Concluído',
  cancelled: 'Cancelada',
  processed: 'Concluído',
  processing: 'Em análise',
  error: 'Requer atenção',
  active: 'Ativo',
  resolved: 'Resolvido',
};

const ACOES_RAPIDAS: QuickAction[] = [
  { label: 'Anotar no diário', icon: NotebookPen, href: '/diario/novo', tone: 'azul' },
  { label: 'Registrar dor', icon: Activity, href: '/diario/dor', tone: 'ardosia' },
  { label: 'Adicionar exame', icon: FlaskConical, href: '/exames', tone: 'violeta' },
  { label: 'Mostrar ao médico', icon: QrCode, href: '/compartilhar', tone: 'turquesa' },
];

/* ── Formatação PT-BR, sem `Intl` (paridade com o mobile) ────────────────── */

/** "5 de agosto" a partir de um instante ISO, no fuso de quem está lendo. */
function dataCurta(iso: string): string {
  return diaEMes(diaLocal(new Date(iso)));
}

/** "14:30". Concatenação, porque `toLocaleTimeString` é `Intl` por baixo. */
function horaLocal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Número com vírgula decimal. "78.4" no banco é "78,4" na tela. */
function numeroBR(valor: number, casas = 1): string {
  return valor.toFixed(casas).replace('.', ',');
}

export default function DashboardPage() {
  const { patientId, ownId, active, isViewingDependent, isPatientKnown } = useActiveProfile();
  const profileQuery = useProfile(patientId || undefined);
  const dashboardQuery = useDashboard(patientId || undefined);
  const bpQuery = useVitalsRange(patientId || undefined, 'blood_pressure', 30);
  const weightQuery = useVitals(patientId || undefined, 'weight');
  const appointmentQuery = useNextAppointment(patientId || undefined);
  const appointmentsQuery = useAppointments(patientId || undefined);
  const wellbeingQuery = useDiarySummary(patientId || undefined);
  const diaryQuery = useDiaryEntries(patientId || undefined);
  const allergiesQuery = useAllergies(patientId || undefined);
  const conditionsQuery = useConditions(patientId || undefined);
  const timelineQuery = useClinicalTimeline(patientId || undefined, 12);
  const registerIntake = useRegisterIntake(patientId);
  const criarEntradaDiario = useCreateDiaryEntry(patientId);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [humorDeHoje, setHumorDeHoje] = useState<number | null>(null);

  const dashboardQueries = [
    profileQuery,
    dashboardQuery,
    bpQuery,
    weightQuery,
    appointmentQuery,
    appointmentsQuery,
    wellbeingQuery,
    diaryQuery,
    allergiesQuery,
    conditionsQuery,
    timelineQuery,
  ];
  /*
   * Este painel escreve "Nenhuma registrada" em Alergias e em Condições de
   * saúde. Antes ele decidia isso com `isLoading`/`isError`, e as duas flags
   * são `false` ao mesmo tempo enquanto `patientId` está vazio (consulta
   * `enabled: false` no React Query v5) — ou seja, as duas travas eram
   * contornadas juntas, em TODO carregamento do painel, e a tela afirmava
   * ausência de alergia sobre um paciente que ainda não tinha sido
   * identificado. Quem decide agora é `estadoSecao`, que trata "não sei de
   * quem é" como estado próprio. Regra e testes em
   * `packages/core/src/utils/estado-secao.ts`.
   */
  const estado = estadoAgregado(
    dashboardQueries.map((query) =>
      estadoSecao({
        sujeitoConhecido: isPatientKnown,
        isSuccess: query.isSuccess,
        isError: query.isError,
      }),
    ),
  );

  if (estado === 'sujeito-indefinido' || estado === 'carregando') {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center"
        role="status"
        aria-label="Carregando o resumo de saúde"
      >
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (estado === 'falhou') {
    return (
      <ErrorState
        message="Não foi possível carregar todo o seu resumo. Nenhuma ausência de informação será tratada como resultado normal."
        onRetry={() => {
          void Promise.all(dashboardQueries.map((query) => query.refetch()));
        }}
        className="min-h-[50vh]"
      />
    );
  }

  const hoje = diaLocal();
  const dataDeHoje = dataDoDia(hoje);
  const diaDaSemana = dataDeHoje ? DIAS_SEMANA_PT[dataDeHoje.getDay()] ?? '' : '';
  const dataPorExtenso = diaDaSemana
    ? `${diaDaSemana.charAt(0).toUpperCase()}${diaDaSemana.slice(1)}, ${diaEMes(hoje)}`
    : diaEMes(hoje);

  const profile = profileQuery.data;
  const data = dashboardQuery.data;
  const bp = data?.latestBloodPressure ?? null;
  const meds = data?.activeMedications ?? [];
  const upcoming = data?.upcomingIntakes ?? [];
  const allergies = allergiesQuery.data ?? [];
  const activeConditions = (conditionsQuery.data ?? []).filter(
    (condition) => condition.status !== 'resolved',
  );
  const range = bpQuery.data ?? [];
  const nextAppt = appointmentQuery.data;
  const wellbeing = wellbeingQuery.data;
  const entradasDoDiario = diaryQuery.data ?? [];
  const registroDeHoje = entradasDoDiario.find((entrada) => entrada.entry_date === hoje) ?? null;
  const humorRegistrado = humorDeHoje ?? registroDeHoje?.mood ?? null;

  const latestWeight =
    (weightQuery.data ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
      )[0] ?? null;
  const bmi = computeBMI(latestWeight?.value_primary ?? null, profile?.height_cm ?? null);
  const alturaEmMetros = profile?.height_cm ? numeroBR(profile.height_cm / 100, 2) : null;

  const timelineEvents = (timelineQuery.data?.pages ?? [])
    .flatMap((page) => page.events)
    .filter((event) => ['appointment', 'exam', 'surgery'].includes(event.eventType))
    .slice(0, 3);
  const previousAppointments = (appointmentsQuery.data ?? [])
    .filter((appointment) => appointment.status === 'completed')
    .slice(-2)
    .reverse();

  const bpStatus =
    bp && bp.value_secondary != null
      ? classifyBloodPressure(bp.value_primary, bp.value_secondary)
      : null;
  const trend: 'up' | 'down' | 'flat' = (() => {
    if (range.length < 2) return 'flat';
    const previous = range[range.length - 2]!.value_primary;
    const current = range[range.length - 1]!.value_primary;
    return current > previous ? 'up' : current < previous ? 'down' : 'flat';
  })();

  const temTipoSanguineo = Boolean(profile?.blood_type && profile.blood_type !== 'unknown');
  const primeiroNome = (profile?.full_name ?? active.name).trim().split(' ')[0] || 'você';
  const saudacao = isViewingDependent
    ? `Prontuário de ${primeiroNome}`
    : `Olá, ${primeiroNome}! 👋`;

  async function handleRegisterPending(intake: (typeof upcoming)[number]) {
    if (registeringId) return;
    setRegisteringId(intake.id);
    try {
      await registerIntake.mutateAsync({
        patient_id: patientId,
        medication_id: intake.medication_id,
        schedule_id: intake.schedule_id,
        scheduled_for: intake.scheduled_for,
        status: 'taken',
        taken_at: new Date().toISOString(),
      });
      toast.success('Tomada registrada.');
    } catch {
      toast.error('Não foi possível registrar.');
    } finally {
      setRegisteringId(null);
    }
  }

  /**
   * Registra o humor de hoje. Só aparece quando NÃO existe entrada para o dia:
   * a tabela aceita várias por data, e um segundo toque criaria um registro
   * duplicado que depois puxaria a média da semana. Para corrigir, o caminho é
   * o diário, onde a entrada inteira pode ser editada.
   */
  async function registrarHumor(valor: number) {
    if (criarEntradaDiario.isPending) return;
    setHumorDeHoje(valor);
    try {
      await criarEntradaDiario.mutateAsync({
        patient_id: patientId,
        entry_date: hoje,
        mood: valor,
      });
      toast.success('Registrado. Obrigado por contar como você está.');
    } catch {
      setHumorDeHoje(null);
      toast.error('Não foi possível registrar agora.');
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow={dataPorExtenso}
        title={saudacao}
        subtitle="Aqui está seu resumo de saúde, organizado para uma leitura rápida."
        right={
          /* O selo é informação FIXA — não muda de cor, não alerta. Continua
             clicável porque era um atalho real para o painel de permissões, e
             tirar o caminho seria uma regressão silenciosa. */
          <Link
            href="/consentimento"
            aria-label="Dados protegidos • LGPD — ver e ajustar suas permissões"
            className="inline-flex min-h-11 items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Seal icon={ShieldCheck}>Dados protegidos • LGPD</Seal>
          </Link>
        }
      />

      <StatRow>
        <StatCard
          icon={HeartPulse}
          tone="azul"
          label="Pressão arterial"
          href="/analise"
          clinical={Boolean(bp)}
          value={
            bp ? (
              <span className="inline-flex items-center gap-2">
                {formatVital(bp)}
                <Trend direction={trend} />
              </span>
            ) : (
              'Sem registro'
            )
          }
          /* Faixa de referência em PALAVRAS. Nada de semáforo: o app exibe e
             organiza, quem interpreta é o médico. */
          hint={bpStatus ? leituraDaFaixa(bpStatus.zone) : 'Você pode registrar em Indicadores'}
        />

        <StatCard
          icon={Scale}
          tone="turquesa"
          label="Peso e altura"
          href="/composicao-corporal"
          clinical={Boolean(latestWeight)}
          value={latestWeight ? `${numeroBR(latestWeight.value_primary)} kg` : 'Sem registro'}
          hint={
            [
              alturaEmMetros ? `${alturaEmMetros} m` : null,
              bmi ? `IMC ${numeroBR(bmi)}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Você pode completar no perfil'
          }
        />

        <StatCard
          icon={Droplets}
          tone="ameixa"
          label="Tipo sanguíneo"
          href="/perfil"
          clinical={temTipoSanguineo}
          value={temTipoSanguineo ? profile?.blood_type : 'Não informado'}
          /* A dica segue o ESTADO: sem registro, ninguém "informou" nada. */
          hint={temTipoSanguineo ? 'Informado por você' : 'Você pode informar no perfil'}
        />

        <StatCard
          icon={FileHeart}
          tone="indigo"
          label="Condições de saúde"
          href="/perfil"
          value={
            activeConditions.length > 0
              ? activeConditions
                  .slice(0, 2)
                  .map((condition) => condition.name)
                  .join(', ')
              : 'Nenhuma registrada'
          }
          hint={
            activeConditions.length > 0
              ? `${activeConditions.length} ${activeConditions.length === 1 ? 'registro ativo' : 'registros ativos'}`
              : 'Você pode adicionar no perfil'
          }
        />

        <StatCard
          icon={AlertTriangle}
          tone="violeta"
          label="Alergias"
          href="/perfil"
          value={
            allergies.length > 0
              ? allergies
                  .slice(0, 2)
                  .map((allergy) => allergy.substance)
                  .join(', ')
              : 'Nenhuma registrada'
          }
          hint={
            allergies.length === 0
              ? 'Você pode adicionar no perfil'
              : allergies.some((allergy) => allergy.severity === 'severe')
                ? 'Contém alergia marcada como grave'
                : `${allergies.length} ${allergies.length === 1 ? 'registrada' : 'registradas'}`
          }
        />
      </StatRow>

      {/* Corpo em duas colunas ≈2/3 + 1/3 (layout.bodyColumns). */}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <PanelCard as="section" className="vl-rise p-5">
            <SectionHeader
              title="Medicamentos de hoje"
              icon={Pill}
              tone="azul"
              href="/medicamentos"
            />
            {meds.length === 0 ? (
              <EmptyState
                className="mt-4"
                illustration={<IlustracaoRemedio />}
                title="Nenhum medicamento por aqui ainda"
                description="Quando você cadastrar, os horários do dia aparecem nesta lista e dá para marcar a tomada com um toque."
                actionLabel="Adicionar medicamento"
                actionHref="/medicamentos"
              />
            ) : (
              <>
                <ul className="mt-2 divide-y divide-line">
                  {meds.slice(0, 4).map((medication, index) => {
                    const intake = upcoming.find(
                      (candidate) => candidate.medication_id === medication.id,
                    );
                    const scheduledTime =
                      horaLocal(intake?.scheduled_for ?? null) ??
                      medication.times[index % Math.max(medication.times.length, 1)] ??
                      null;
                    const busy = intake ? registeringId === intake.id : false;
                    return (
                      <li key={medication.id} className="flex items-center gap-3 py-3">
                        <IconChip icon={Pill} tone="azul" size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-semibold text-fg">
                            {medication.name}
                            {medication.dosage ? ` · ${medication.dosage}` : ''}
                          </p>
                          <p className="mt-0.5 truncate text-caption text-muted">
                            {MEDICATION_FORM_LABELS[medication.form]} ·{' '}
                            {MEDICATION_FREQUENCY_LABELS[medication.frequency]}
                          </p>
                        </div>
                        {intake ? (
                          <PanelButton
                            className="shrink-0"
                            size="sm"
                            icon={Check}
                            onClick={() => void handleRegisterPending(intake)}
                            disabled={busy || registeringId !== null}
                            aria-label={`Registrar tomada de ${medication.name}${
                              scheduledTime ? ` das ${scheduledTime}` : ''
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className="hidden sm:inline">
                                {busy ? 'Registrando…' : 'Registrar'}
                              </span>
                              {scheduledTime ? (
                                <span className="hp-num">{scheduledTime}</span>
                              ) : null}
                            </span>
                          </PanelButton>
                        ) : (
                          <span className="hp-num shrink-0 rounded-full bg-surface-3 px-3 py-1.5 text-caption font-semibold text-muted">
                            {scheduledTime ?? 'Sem horário'}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <PanelButton
                  className="mt-4 w-full"
                  variant="secondary"
                  size="sm"
                  href="/medicamentos"
                >
                  Adicionar ou atualizar medicamento
                </PanelButton>
              </>
            )}
          </PanelCard>

          <PanelCard as="section" className="vl-rise p-5">
            <SectionHeader
              title="Consultas, exames e procedimentos"
              icon={CalendarDays}
              tone="indigo"
              href="/linha-do-tempo"
              actionLabel="Linha do tempo"
            />
            {timelineEvents.length === 0 && !nextAppt && previousAppointments.length === 0 ? (
              <EmptyState
                className="mt-4"
                illustration={<IlustracaoAgenda />}
                title="Sua linha do tempo começa aqui"
                description="Consultas, exames e procedimentos registrados ficam em ordem cronológica — fácil de mostrar numa consulta."
                actionLabel="Registrar consulta"
                actionHref="/consultas"
              />
            ) : (
              <>
                <ul className="mt-2 divide-y divide-line">
                  {nextAppt ? (
                    <TimelineRow
                      icon={CalendarDays}
                      title={`${nextAppt.specialty ?? 'Consulta'} · ${nextAppt.doctor_name}`}
                      description={`${dataCurta(nextAppt.scheduled_at)}${
                        horaLocal(nextAppt.scheduled_at) ? `, ${horaLocal(nextAppt.scheduled_at)}` : ''
                      } · ${APPOINTMENT_KIND_LABELS[nextAppt.kind]}`}
                      status="Próxima"
                      tone="attention"
                    />
                  ) : null}
                  {timelineEvents
                    .filter(
                      (event) =>
                        !nextAppt ||
                        event.eventId !== nextAppt.id ||
                        event.eventType !== 'appointment',
                    )
                    .slice(0, nextAppt ? 2 : 3)
                    .map((event) => (
                      <TimelineRow
                        key={event.eventKey}
                        icon={
                          TIMELINE_ICONS[event.eventType as keyof typeof TIMELINE_ICONS] ?? History
                        }
                        title={event.title}
                        description={`${dataCurta(event.occurredAt)}${
                          !event.dateOnly && horaLocal(event.occurredAt)
                            ? `, ${horaLocal(event.occurredAt)}`
                            : ''
                        }${event.summary ? ` · ${event.summary}` : ''}`}
                        status={
                          event.status ? TIMELINE_STATUS[event.status] ?? event.status : 'Registrado'
                        }
                        tone={event.status === 'error' ? 'alert' : 'ok'}
                      />
                    ))}
                  {timelineEvents.length === 0
                    ? previousAppointments.slice(0, nextAppt ? 2 : 3).map((appointment) => (
                        <TimelineRow
                          key={appointment.id}
                          icon={Stethoscope}
                          title={`${appointment.specialty ?? 'Consulta'} · ${appointment.doctor_name}`}
                          description={`${dataCurta(appointment.scheduled_at)} · ${APPOINTMENT_KIND_LABELS[appointment.kind]}`}
                          status="Realizada"
                          tone="ok"
                        />
                      ))
                    : null}
                </ul>
                <PanelButton className="mt-4 w-full" variant="secondary" size="sm" href="/consultas">
                  Agendar ou registrar consulta
                </PanelButton>
              </>
            )}
          </PanelCard>
        </div>

        <div className="space-y-5">
          <PanelCard as="section" className="vl-rise p-5">
            <SectionHeader title="Compartilhar dados" icon={Share2} tone="violeta" />
            <p className="mt-3 text-body-sm leading-relaxed text-muted">
              Você escolhe o que compartilhar, com quem e por quanto tempo.
            </p>
            <ul className="mt-4 space-y-2">
              <li>
                <ShareOption
                  icon={Stethoscope}
                  title="Profissional de saúde"
                  description="Resumo para uma consulta"
                />
              </li>
              <li>
                <ShareOption
                  icon={Building2}
                  title="Hospital ou laboratório"
                  description="Acesso temporário"
                />
              </li>
            </ul>
            <PanelButton className="mt-4 w-full" icon={Send} href="/compartilhar">
              Criar compartilhamento seguro
            </PanelButton>
          </PanelCard>

          <PanelCard as="section" className="vl-rise p-5">
            <SectionHeader
              title="Bem-estar · 7 dias"
              icon={Smile}
              tone="turquesa"
              href="/analise"
              actionLabel="Ver indicadores"
            />

            {/*
              Humor e energia são AUTORRELATO. Sem semáforo, sem carinha
              vermelha: a escala e o marcador vêm da fundação, num matiz só,
              com a ordem na FORMA e no RÓTULO (DESIGN.md §5).
            */}
            {wellbeing?.wellbeing != null ? (
              <div className="mt-4 flex items-center gap-4 rounded-card border border-line bg-surface-2 p-4">
                {wellbeing.mood != null ? (
                  <MoodMark value={Math.round(wellbeing.mood)} className="shrink-0" />
                ) : null}
                <div className="min-w-0">
                  <p className="hp-num text-title font-semibold text-fg">
                    {numeroBR(wellbeing.wellbeing)}
                    <span className="text-body-sm font-normal text-muted">/5</span>
                  </p>
                  <p className="text-caption text-muted">
                    Humor {wellbeing.mood != null ? numeroBR(wellbeing.mood) : '—'} · energia{' '}
                    {wellbeing.energy != null ? numeroBR(wellbeing.energy) : '—'}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState
                className="mt-4 py-8"
                illustration={<IlustracaoDiario className="h-20 w-auto" />}
                title="Sem registros nesta semana"
                description="Contar como você está leva alguns segundos — e é o que faz esta média existir."
              />
            )}

            <div className="mt-4 border-t border-line pt-4">
              {registroDeHoje || humorRegistrado != null ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 text-body-sm text-fg-soft">
                    Hoje você registrou{' '}
                    {humorRegistrado != null ? (
                      <MoodMark value={humorRegistrado} className="align-middle" />
                    ) : (
                      'seu diário'
                    )}
                  </p>
                  <Link
                    href="/diario"
                    className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-caption font-semibold text-primary hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Abrir diário
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              ) : (
                <MoodScale
                  name="humor-de-hoje"
                  value={humorRegistrado}
                  onChange={(valor) => void registrarHumor(valor)}
                  disabled={criarEntradaDiario.isPending}
                />
              )}
            </div>
          </PanelCard>
        </div>
      </div>

      {/* ── Acompanhamento ─────────────────────────────────────────────── */}
      <section aria-labelledby="acompanhamento-titulo" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption font-semibold uppercase tracking-wider text-primary">
              Acompanhamento
            </p>
            <h2 id="acompanhamento-titulo" className="mt-1 font-display text-title text-fg">
              Seus hábitos e indicadores
            </h2>
          </div>
          <PanelButton href="/analise" variant="quiet" size="sm">
            Ver indicadores
          </PanelButton>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className={isViewingDependent ? 'lg:col-span-3' : 'lg:col-span-2'}>
            <ConstancyCard patientId={patientId || undefined} />
          </div>
          {!isViewingDependent ? (
            <WaterCard patientId={ownId} dateOfBirth={profile?.date_of_birth} />
          ) : null}
        </div>

        <PanelCard as="section" className="p-5">
          <SectionHeader
            title="Pressão arterial · 30 dias"
            icon={HeartPulse}
            tone="azul"
            action={
              <TrendChip values={range.map((vital) => vital.value_primary)} label="Sistólica" />
            }
          />
          <p className="mt-1 text-caption text-hint">Histórico informado por você</p>
          <div className="mt-4">
            <BloodPressureChart vitals={range} />
          </div>
          <p className="mt-3 text-caption leading-relaxed text-muted">
            {DISCLAIMERS.examInterpretation}
          </p>
        </PanelCard>
      </section>

      <QuickActions actions={ACOES_RAPIDAS} />
    </div>
  );
}

/* ══════════════════════════════ Peças locais ══════════════════════════════ */

function TimelineRow({
  icon: Icon,
  title,
  description,
  status,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  status: string;
  /* Status de AGENDA/SISTEMA ("Próxima", "Realizada", falha de importação) —
     é o domínio em que âmbar/vermelho são permitidos. Nunca dado do corpo. */
  tone: 'ok' | 'attention' | 'alert';
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <IconChip icon={Icon} seed={title} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-semibold text-fg">{title}</p>
        <p className="mt-0.5 truncate text-caption text-muted">{description}</p>
      </div>
      <span className="shrink-0">
        <SystemStatusChip tone={tone} label={status} />
      </span>
    </li>
  );
}

function ShareOption({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
}) {
  return (
    <Link
      href="/compartilhar"
      className="group flex min-h-11 items-center gap-3 rounded-card border border-line bg-surface-2 px-3 py-3 transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <IconChip icon={icon} seed={title} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block truncate text-caption text-muted">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-hint" aria-hidden />
    </Link>
  );
}
