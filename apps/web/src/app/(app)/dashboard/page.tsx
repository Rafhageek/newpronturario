'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
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
  Pill,
  Scale,
  Send,
  Share2,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useAllergies,
  useAppointments,
  useClinicalTimeline,
  useConditions,
  useDashboard,
  useDiarySummary,
  useNextAppointment,
  useProfile,
  useRegisterIntake,
  useVitals,
  useVitalsRange,
} from '@hubpatients/supabase';
import {
  APPOINTMENT_KIND_LABELS,
  MEDICATION_FORM_LABELS,
  MEDICATION_FREQUENCY_LABELS,
  classifyBloodPressure,
  computeBMI,
  DISCLAIMERS,
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
import { ClinicalRangeChip } from '@/components/dashboard/clinical-range-chip';
import { toast } from 'sonner';

const BloodPressureChart = dynamic(
  () => import('@/components/dashboard/bp-chart').then((module) => module.BloodPressureChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-60 animate-pulse rounded-xl bg-surface-2" role="status">
        <span className="sr-only">Carregando gráfico de pressão arterial</span>
      </div>
    ),
  },
);

const overviewContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

const overviewItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
};

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

function formatDate(value: string, withTime = false): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function formatTime(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const { patientId, ownId, isViewingDependent, isPatientKnown } = useActiveProfile();
  const profileQuery = useProfile(patientId || undefined);
  const dashboardQuery = useDashboard(patientId || undefined);
  const bpQuery = useVitalsRange(patientId || undefined, 'blood_pressure', 30);
  const weightQuery = useVitals(patientId || undefined, 'weight');
  const appointmentQuery = useNextAppointment(patientId || undefined);
  const appointmentsQuery = useAppointments(patientId || undefined);
  const wellbeingQuery = useDiarySummary(patientId || undefined);
  const allergiesQuery = useAllergies(patientId || undefined);
  const conditionsQuery = useConditions(patientId || undefined);
  const timelineQuery = useClinicalTimeline(patientId || undefined, 12);
  const registerIntake = useRegisterIntake(patientId);
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  const dashboardQueries = [
    profileQuery,
    dashboardQuery,
    bpQuery,
    weightQuery,
    appointmentQuery,
    appointmentsQuery,
    wellbeingQuery,
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

  const now = new Date();
  const dateLabel = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
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
  const latestWeight =
    (weightQuery.data ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
      )[0] ?? null;
  const bmi = computeBMI(latestWeight?.value_primary ?? null, profile?.height_cm ?? null);
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


  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm capitalize text-muted">{dateLabel}</p>
          <h1
            className="mt-0.5 text-3xl font-bold tracking-tight text-fg"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Seu prontuário
          </h1>
          <p className="mt-1 text-sm text-muted">
            Aqui está seu resumo de saúde, organizado para uma leitura rápida.
          </p>
        </div>
        {/* @cor-do-sistema — verde de garantia de PRIVACIDADE (estado do sistema),
            não avaliação de nenhum dado do corpo. */}
        <Link
          href="/consentimento"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-status-ok-tint px-4 text-sm font-semibold text-status-ok-ink transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Dados protegidos · LGPD
        </Link>
        {/* @fim-cor-do-sistema */}
      </header>

      <motion.section
        aria-label="Resumo clínico"
        variants={overviewContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5"
      >
        <OverviewCard
          icon={HeartPulse}
          iconTone="blue"
          label="Pressão arterial"
          href="/analise"
          value={
            bp ? (
              <span className="inline-flex items-center gap-2">
                <ClinicalNumber>{formatVital(bp)}</ClinicalNumber>
                <Trend direction={trend} />
              </span>
            ) : (
              'Sem registro'
            )
          }
          detail={
            bpStatus ? (
              /* `neutro` + seta + texto: a faixa da pressão NÃO é semáforo.
                 Ver clinical-range-chip.tsx. */
              <ClinicalRangeChip zone={bpStatus.zone} />
            ) : (
              'Toque para registrar'
            )
          }
        />
        <OverviewCard
          icon={Scale}
          iconTone="teal"
          label="Peso / altura"
          href="/composicao-corporal"
          value={
            latestWeight || profile?.height_cm ? (
              <span className="flex flex-wrap items-baseline gap-x-2">
                {latestWeight ? (
                  <ClinicalNumber>{latestWeight.value_primary} kg</ClinicalNumber>
                ) : (
                  <span className="text-base">Peso não informado</span>
                )}
                {profile?.height_cm ? (
                  <span className="text-sm font-semibold text-fg-soft">
                    {`${(profile.height_cm / 100).toFixed(2).replace('.', ',')} m`}
                  </span>
                ) : null}
              </span>
            ) : (
              'Não informado'
            )
          }
          detail={bmi ? `IMC ${bmi.toFixed(1).replace('.', ',')}` : 'Complete seus dados'}
        />
        <OverviewCard
          icon={Droplets}
          iconTone="violet"
          label="Tipo sanguíneo"
          href="/perfil"
          value={
            profile?.blood_type && profile.blood_type !== 'unknown'
              ? <ClinicalNumber>{profile.blood_type}</ClinicalNumber>
              : 'Não informado'
          }
          detail="Informado por você"
        />
        <OverviewCard
          icon={FileHeart}
          iconTone="neutro"
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
          detail={
            activeConditions.length > 0
              ? `${activeConditions.length} ${activeConditions.length === 1 ? 'registro ativo' : 'registros ativos'}`
              : 'Gerencie no perfil'
          }
        />
        <OverviewCard
          icon={AlertTriangle}
          iconTone="neutro"
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
          detail={
            allergies.some((allergy) => allergy.severity === 'severe')
              ? 'Contém alergia marcada como grave'
              : 'Informado por você'
          }
        />
      </motion.section>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <DashboardSection
            icon={Pill}
            title="Medicamentos de hoje"
            actionLabel="Ver todos"
            actionHref="/medicamentos"
          >
            {meds.length === 0 ? (
              <EmptySummary
                icon={Pill}
                title="Nenhum medicamento ativo"
                description="Cadastre seus medicamentos para acompanhar horários e tomadas."
                href="/medicamentos"
                action="Adicionar medicamento"
              />
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {meds.slice(0, 4).map((medication, index) => {
                    const intake = upcoming.find(
                      (candidate) => candidate.medication_id === medication.id,
                    );
                    const scheduledTime =
                      formatTime(intake?.scheduled_for ?? null) ??
                      medication.times[index % Math.max(medication.times.length, 1)] ??
                      null;
                    const busy = intake ? registeringId === intake.id : false;
                    return (
                      <li
                        key={medication.id}
                        className="flex min-h-[66px] items-center gap-3 py-3"
                      >
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            intake ? 'bg-primary' : 'bg-status-neutro-mark'
                          }`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-fg">
                            {medication.name}
                            {medication.dosage ? ` · ${medication.dosage}` : ''}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted">
                            {MEDICATION_FORM_LABELS[medication.form]} ·{' '}
                            {MEDICATION_FREQUENCY_LABELS[medication.frequency]}
                          </p>
                        </div>
                        {intake ? (
                          <button
                            type="button"
                            onClick={() => handleRegisterPending(intake)}
                            disabled={busy || registeringId !== null}
                            aria-busy={busy || undefined}
                            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" aria-hidden />
                            )}
                            <span className="hidden sm:inline">
                              {busy ? 'Registrando…' : 'Registrar'}
                            </span>
                            {scheduledTime ? (
                              <span className="font-mono">{scheduledTime}</span>
                            ) : null}
                          </button>
                        ) : (
                          <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1.5 font-mono text-xs font-bold text-muted">
                            {scheduledTime ?? 'Sem horário'}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <DashedLink href="/medicamentos">
                  Adicionar ou atualizar medicamento
                </DashedLink>
              </>
            )}
          </DashboardSection>

          <DashboardSection
            icon={CalendarDays}
            title="Consultas, exames e procedimentos"
            actionLabel="Linha do tempo"
            actionHref="/linha-do-tempo"
          >
            {timelineEvents.length === 0 && !nextAppt && previousAppointments.length === 0 ? (
              <EmptySummary
                icon={History}
                title="Sua linha do tempo começa aqui"
                description="Registre consultas, exames e procedimentos para encontrá-los em ordem cronológica."
                href="/consultas"
                action="Registrar consulta"
              />
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {nextAppt ? (
                    <TimelineRow
                      icon={CalendarDays}
                      title={`${nextAppt.specialty ?? 'Consulta'} · ${nextAppt.doctor_name}`}
                      description={`${formatDate(nextAppt.scheduled_at, true)} · ${APPOINTMENT_KIND_LABELS[nextAppt.kind]}`}
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
                          TIMELINE_ICONS[
                            event.eventType as keyof typeof TIMELINE_ICONS
                          ] ?? History
                        }
                        title={event.title}
                        description={`${formatDate(event.occurredAt, !event.dateOnly)}${event.summary ? ` · ${event.summary}` : ''}`}
                        status={
                          event.status
                            ? TIMELINE_STATUS[event.status] ?? event.status
                            : 'Registrado'
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
                          description={`${formatDate(appointment.scheduled_at, true)} · ${APPOINTMENT_KIND_LABELS[appointment.kind]}`}
                          status="Realizada"
                          tone="ok"
                        />
                      ))
                    : null}
                </ul>
                <DashedLink href="/consultas">
                  Agendar ou registrar consulta
                </DashedLink>
              </>
            )}
          </DashboardSection>
        </div>

        <aside className="space-y-5 xl:col-span-4" aria-label="Ações e bem-estar">
          <DashboardSection icon={Share2} title="Compartilhar dados">
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Você escolhe o que compartilhar, com quem e por quanto tempo.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <ShareOption
                icon={Stethoscope}
                title="Profissional de saúde"
                description="Resumo para uma consulta"
              />
              <ShareOption
                icon={Building2}
                title="Hospital ou laboratório"
                description="Acesso temporário"
              />
            </div>
            <Link
              href="/compartilhar"
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-sm font-bold text-fg transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Send className="h-4 w-4" aria-hidden />
              Criar compartilhamento seguro
            </Link>
          </DashboardSection>

          <DashboardSection icon={Smile} title="Bem-estar · 7 dias">
            {wellbeing?.wellbeing != null ? (
              <div className="flex items-center gap-4 rounded-xl bg-status-info-tint p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-status-info-ink">
                  <Smile className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-mono text-xl font-bold text-fg">
                    {wellbeing.wellbeing.toFixed(1).replace('.', ',')}
                    <span className="text-sm text-muted">/5</span>
                  </p>
                  <p className="text-xs text-muted">
                    Humor {wellbeing.mood?.toFixed(1).replace('.', ',') ?? '—'} ·
                    energia {wellbeing.energy?.toFixed(1).replace('.', ',') ?? '—'}
                  </p>
                </div>
              </div>
            ) : (
              <Link
                href="/diario/novo"
                className="flex min-h-[76px] items-center gap-3 rounded-xl bg-status-info-tint p-4 transition hover:brightness-95"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-status-info-ink">
                  <Smile className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-sm text-muted">
                  Sem registros nesta semana. Conte como está se sentindo.
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              </Link>
            )}
          </DashboardSection>
        </aside>
      </div>

      <section aria-labelledby="acompanhamento-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Acompanhamento
            </p>
            <h2
              id="acompanhamento-title"
              className="mt-1 text-xl font-bold text-fg"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Seus hábitos e indicadores
            </h2>
          </div>
          <Link
            href="/analise"
            className="hidden min-h-11 items-center gap-1 text-sm font-bold text-primary hover:underline sm:inline-flex"
          >
            Ver indicadores <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className={isViewingDependent ? 'lg:col-span-3' : 'lg:col-span-2'}>
            <ConstancyCard patientId={patientId || undefined} />
          </div>
          {!isViewingDependent ? (
            <WaterCard patientId={ownId} dateOfBirth={profile?.date_of_birth} />
          ) : null}
        </div>

        <section className="vl-rise mt-5 rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-info-tint text-status-info-ink">
                <HeartPulse className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-bold text-fg">Pressão arterial · 30 dias</h3>
                <p className="text-xs text-muted">Histórico informado por você</p>
              </div>
            </div>
            <TrendChip
              values={range.map((vital) => vital.value_primary)}
              label="Sistólica"
            />
          </div>
          <BloodPressureChart vitals={range} />
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {DISCLAIMERS.examInterpretation}
          </p>
        </section>
      </section>
    </div>
  );
}

function ClinicalNumber({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xl font-bold text-fg">{children}</span>;
}

function OverviewCard({
  icon: Icon,
  iconTone,
  label,
  value,
  detail,
  href,
}: {
  icon: LucideIcon;
  iconTone: 'blue' | 'teal' | 'violet' | 'neutro';
  label: string;
  value: ReactNode;
  detail: ReactNode;
  href: string;
}) {
  /**
   * Tinta do ícone — DECORATIVA: identifica a CATEGORIA do cartão, nunca a
   * gravidade do dado.
   *
   * Antes, "Pressão arterial" e "Alergias" vinham em `rose` (vermelho) e
   * "Condições de saúde" em `amber`, fixos — o cartão nascia "grave" antes de
   * qualquer valor ser lido. Isso quebra a regra do design system (`status` em
   * `packages/ui-tokens/src/index.ts`): vermelho e âmbar são do SISTEMA, nunca
   * do corpo do paciente. A paleta abaixo é a neutra-clínica dos gráficos
   * (`--chart-*`, sem verde nem vermelho) mais o `neutro` do sistema de status.
   */
  const tone = {
    blue: 'bg-status-info-tint text-status-info-ink',
    teal: 'bg-[color-mix(in_srgb,var(--chart-2)_12%,transparent)] text-[var(--chart-2)]',
    violet: 'bg-[color-mix(in_srgb,var(--chart-3)_14%,transparent)] text-[var(--chart-3)]',
    neutro: 'bg-status-neutro-tint text-status-neutro-ink',
  }[iconTone];

  return (
    <motion.article
      variants={overviewItem}
      className="group relative min-h-[136px] overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-xs transition last:col-span-2 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-paper lg:last:col-span-1"
    >
      <Link
        href={href}
        className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
        aria-label={`${label}: abrir detalhes`}
      />
      <div className="relative pointer-events-none">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <p className="mt-3 text-xs font-semibold text-muted">{label}</p>
        <div className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug text-fg">
          {value}
        </div>
        <div className="mt-1 line-clamp-1 text-xs text-muted">{detail}</div>
      </div>
    </motion.article>
  );
}

function DashboardSection({
  icon: Icon,
  title,
  actionLabel,
  actionHref,
  children,
}: {
  icon: LucideIcon;
  title: string;
  actionLabel?: string;
  actionHref?: string;
  children: ReactNode;
}) {
  return (
    <section className="vl-rise rounded-2xl border border-line bg-surface p-5 shadow-xs">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-status-info-tint text-status-info-ink">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <h2 className="truncate text-base font-bold text-fg">{title}</h2>
        </div>
        {actionLabel && actionHref ? (
          <Link
            href={actionHref}
            aria-label={actionLabel}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold text-primary hover:underline"
          >
            <span className="hidden sm:inline">{actionLabel}</span>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function DashedLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-dashed border-line-strong px-4 text-sm font-semibold text-muted transition hover:border-primary hover:bg-status-info-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Sparkles className="mr-2 h-4 w-4" aria-hidden />
      {children}
    </Link>
  );
}

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
     é o domínio em que âmbar/vermelho são permitidos. */
  tone: 'ok' | 'attention' | 'alert';
}) {
  return (
    <li className="flex min-h-[66px] items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-fg">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{description}</p>
      </div>
      <SystemStatusChip tone={tone} label={status} />
    </li>
  );
}

function ShareOption({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href="/compartilhar"
      className="group flex min-h-[88px] items-start gap-3 rounded-xl border border-line bg-surface-2 p-3 transition hover:border-primary/40 hover:bg-status-info-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-primary">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-fg">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">{description}</span>
      </span>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
    </Link>
  );
}

function EmptySummary({
  icon: Icon,
  title,
  description,
  href,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-surface-2 px-5 py-7 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-muted">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-bold text-fg">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      <Link
        href={href}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
      >
        {action}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
