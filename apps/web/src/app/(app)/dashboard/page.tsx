'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Brain,
  CalendarDays,
  Check,
  Clock,
  HeartPulse,
  Lock,
  Pill,
  ShieldCheck,
  Smile,
  Sparkles,
  Video,
} from 'lucide-react';
import {
  useDashboard,
  useProfile,
  useVitalsRange,
  useNextAppointment,
  useDiarySummary,
  useAllergies,
  useRegisterIntake,
} from '@hubpatients/supabase';
import {
  APPOINTMENT_KIND_LABELS,
  classifyBloodPressure,
  DISCLAIMERS,
  formatVital,
} from '@hubpatients/core';
import { useActiveProfile } from '@/components/profile-context';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { ConstancyCard } from '@/components/dashboard/constancy-card';
import { WaterCard } from '@/components/dashboard/water-card';
import { TrendChip } from '@/components/dashboard/trend-chip';
import { UpgradeModal } from '@/components/ui/upgrade-modal';
import { container, MetricCard, StatusChip, Trend } from '@/components/dashboard/metric-cards';
import { SetupChecklist } from '@/components/dashboard/setup-checklist';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/error-state';
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

function greeting(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardPage() {
  const { patientId, ownId, isViewingDependent } = useActiveProfile();
  const profileQuery = useProfile(patientId || undefined);
  const dashboardQuery = useDashboard(patientId || undefined);
  const bpQuery = useVitalsRange(patientId || undefined, 'blood_pressure', 30);
  const appointmentQuery = useNextAppointment(patientId || undefined);
  const wellbeingQuery = useDiarySummary(patientId || undefined);
  const allergiesQuery = useAllergies(patientId || undefined);
  const { data: profile } = profileQuery;
  const { data } = dashboardQuery;
  const { data: bpRange } = bpQuery;
  const { data: nextAppt } = appointmentQuery;
  const { data: wellbeing } = wellbeingQuery;
  const { data: allergies } = allergiesQuery;
  const registerIntake = useRegisterIntake(patientId);

  const [upgrade, setUpgrade] = useState(false);
  // Qual lembrete está sendo registrado (spinner só na linha tocada).
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  const dashboardQueries = [
    profileQuery,
    dashboardQuery,
    bpQuery,
    appointmentQuery,
    wellbeingQuery,
    allergiesQuery,
  ];
  const isInitialLoading = Boolean(patientId) && dashboardQueries.some((query) => query.isLoading);
  const hasLoadError = dashboardQueries.some((query) => query.isError);

  if (isInitialLoading) {
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

  if (hasLoadError) {
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
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Paciente';
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const bp = data?.latestBloodPressure ?? null;
  const meds = data?.activeMedications ?? [];
  const upcoming = data?.upcomingIntakes ?? [];
  const severeAllergies = (allergies ?? []).filter((a) => a.severity === 'severe');
  // Nome do medicamento por id (lembretes só trazem medication_id).
  const medNameById = (id: string): string => meds.find((m) => m.id === id)?.name ?? 'Medicação';

  const bpStatus =
    bp && bp.value_secondary != null
      ? classifyBloodPressure(bp.value_primary, bp.value_secondary)
      : null;

  // mini-tendência (sistólica)
  const range = bpRange ?? [];
  const trend: 'up' | 'down' | 'flat' = (() => {
    if (range.length < 2) return 'flat';
    const a = range[range.length - 2]!.value_primary;
    const b = range[range.length - 1]!.value_primary;
    return b > a ? 'up' : b < a ? 'down' : 'flat';
  })();

  // Registra uma tomada pendente específica (com schedule_id/scheduled_for).
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
      toast.success('Tomada registrada. 👏');
    } catch {
      toast.error('Não foi possível registrar.');
    } finally {
      setRegisteringId(null);
    }
  }

  const setupSteps = [
    {
      label: 'Complete seu perfil (nascimento e sexo)',
      href: '/perfil',
      done: Boolean(profile?.date_of_birth) && profile?.biological_sex !== 'unspecified',
    },
    { label: 'Registre suas alergias', href: '/perfil', done: (allergies?.length ?? 0) > 0 },
    { label: 'Adicione um medicamento', href: '/medicamentos', done: meds.length > 0 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <SetupChecklist steps={setupSteps} />

      {/* Hero */}
      <section className="vl-rise relative overflow-hidden rounded-2xl border border-line bg-surface p-7">
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">{dateLabel}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-fg" style={{ fontFamily: 'var(--font-display)' }}>
              {greeting(now.getHours())},{' '}
              {/* Era degradê sky→cyan em bg-clip-text: 2,1:1 sobre o canvas
                  creme, e o nome do usuário é conteúdo, não enfeite. */}
              <span className="text-primary">{firstName}</span>
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              Sua saúde, registrada com cuidado e clareza. Tudo o que importa, num só lugar.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg-soft">
              {severeAllergies.length === 0 && upcoming.length === 0 ? (
                <><Smile className="h-3.5 w-3.5 text-status-ok-ink" /> Tudo tranquilo por aqui hoje 💙</>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {upcoming.length > 0 && `${upcoming.length} ${upcoming.length === 1 ? 'tomada' : 'tomadas'} pendente${upcoming.length === 1 ? '' : 's'}`}
                  {upcoming.length > 0 && severeAllergies.length > 0 && ' · '}
                  {severeAllergies.length > 0 && `${severeAllergies.length} alerta${severeAllergies.length === 1 ? '' : 's'}`}
                </>
              )}
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2.5 rounded-xl border border-status-ok-mark bg-status-ok-tint px-4 py-3 sm:flex">
            <ShieldCheck className="h-5 w-5 text-status-ok-ink" />
            <div>
              <p className="text-sm font-semibold text-fg">Dados protegidos</p>
              <p className="text-xs text-status-ok-ink">Conforme a LGPD</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className={isViewingDependent ? 'lg:col-span-3' : 'lg:col-span-2'}>
          <ConstancyCard patientId={patientId || undefined} />
        </div>
        {/* Hidratação é bem-estar OWNER-ONLY (RLS user_id = auth.uid()): usa o próprio
            id (ownId) e só aparece no seu perfil — nunca no de um dependente. */}
        {!isViewingDependent && (
          <WaterCard patientId={ownId} dateOfBirth={profile?.date_of_birth} />
        )}
      </div>

      {/* Resumo de hoje — 3 cartões de leitura (pressão · consulta · bem-estar) */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Última PA */}
        {/* Acentos vêm da paleta neutra-clínica (`--chart-*`): eram rosa/âmbar/
            verde crus, que além de fora do sistema sugeriam semáforo. */}
        <MetricCard icon={HeartPulse} accent="var(--chart-1)" label="Última pressão">
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-fg">{bp ? formatVital(bp) : '—'}</p>
            {bp && <Trend direction={trend} />}
          </div>
          {bpStatus ? (
            <div className="mt-1.5">
              <StatusChip tone={bpStatus.zone} label={bpStatus.label} />
            </div>
          ) : (
            <p className="text-xs text-muted">Sem registros</p>
          )}
        </MetricCard>

        {/* Próxima consulta */}
        <MetricCard icon={CalendarDays} accent="var(--chart-4)" label="Próxima consulta">
          {nextAppt ? (
            <>
              <p className="truncate text-lg font-bold text-fg">{nextAppt.doctor_name}</p>
              <p className="truncate text-xs text-muted">{nextAppt.specialty ?? 'Consulta'}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                {nextAppt.kind === 'telehealth' ? <Video className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
                {new Date(nextAppt.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {' · '}
                {APPOINTMENT_KIND_LABELS[nextAppt.kind]}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Nenhuma agendada</p>
          )}
        </MetricCard>

        {/* Bem-estar */}
        <MetricCard icon={Smile} accent="var(--chart-2)" label="Bem-estar (7 dias)">
          {wellbeing?.wellbeing != null ? (
            <>
              <p className="text-2xl font-bold text-fg">
                <AnimatedCounter value={wellbeing.wellbeing} decimals={1} />
                <span className="text-sm font-medium text-muted">/5</span>
              </p>
              <p className="text-xs text-muted">
                humor {wellbeing.mood?.toFixed(1) ?? '—'} · energia {wellbeing.energy?.toFixed(1) ?? '—'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Registre no Diário</p>
          )}
        </MetricCard>
      </motion.div>

      {/* Bento: gráfico (2/3) + coluna de lembretes/alertas (1/3) */}
      <div className="grid gap-5 lg:grid-cols-3">
      {/* Gráfico de PA 30 dias */}
      <section className="vl-rise rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HeartPulse className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-fg">Pressão arterial · 30 dias</h3>
          </div>
          {/* O gráfico deixou de pintar zonas verde/amarelo/vermelho (semáforo
              sobre o corpo do paciente = diagnóstico disfarçado). Sobrou UMA
              faixa neutra, hachurada e rotulada dentro do próprio gráfico. */}
          <div className="flex items-center gap-3 text-caption text-muted">
            <Legend color="var(--chart-band)" label="faixa de referência" />
          </div>
        </div>
        <div className="mb-2">
          <TrendChip values={range.map((v) => v.value_primary)} label="Sistólica" />
        </div>
        <BloodPressureChart vitals={range} />
        <p className="mt-2 text-[11px] text-muted">{DISCLAIMERS.examInterpretation}</p>
      </section>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
        {/* Lembretes de hoje */}
        <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-fg">Lembretes de hoje</h3>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">
              {meds.length === 0 ? 'Cadastre medicamentos para receber lembretes.' : 'Sem tomadas pendentes. Tudo em dia 🎉'}
            </p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((intake) => {
                const time = intake.scheduled_for
                  ? new Date(intake.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : null;
                const busy = registeringId === intake.id;
                return (
                  <li
                    key={intake.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-status-info-tint text-status-info-ink">
                        <Pill className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-fg">{medNameById(intake.medication_id)}</p>
                        <p className="text-xs text-muted">{time ? `Previsto para ${time}` : 'Tomada pendente'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRegisterPending(intake)}
                      disabled={busy || registeringId !== null}
                      aria-busy={busy || undefined}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-status-ok-tint px-3 text-xs font-semibold text-status-ok-ink transition hover:brightness-95 disabled:opacity-60"
                    >
                      {busy ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      {busy ? 'Registrando…' : 'Registrar'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Alertas */}
        <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-status-attention-ink" />
            <h3 className="text-sm font-semibold text-fg">Alertas</h3>
          </div>
          {severeAllergies.length === 0 ? (
            <p className="text-sm text-muted">Nenhum alerta no momento.</p>
          ) : (
            <ul className="space-y-2">
              {severeAllergies.map((a) => (
                <li key={a.id} className="flex items-center gap-2.5 rounded-xl border border-status-alert-mark bg-status-alert-tint px-3 py-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-status-alert-ink" />
                  <span className="text-sm text-status-alert-ink">
                    Alergia grave: <span className="font-semibold">{a.substance}</span>
                    {a.reaction ? ` · ${a.reaction}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/perfil" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
            Gerenciar alergias no Perfil →
          </Link>
        </section>
      </div>
      </div>

      {/* Insight da semana (Plus) */}
      <section className="vl-rise relative overflow-hidden rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-info-tint text-status-info-ink">
            <Brain className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-fg">Insight da semana</h3>
            <p className="text-xs text-muted">Um resumo inteligente da sua saúde, atualizado toda semana.</p>
          </div>
        </div>
        <div className="relative mt-4">
          <div className="space-y-2 blur-sm select-none" aria-hidden>
            <div className="h-3 w-3/4 rounded bg-line" />
            <div className="h-3 w-2/3 rounded bg-line" />
            <div className="h-3 w-5/6 rounded bg-line" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-status-info-tint text-status-info-ink ring-1 ring-status-info-mark">
              <Lock className="h-5 w-5" />
            </span>
            <p className="text-center text-sm text-fg-soft">
              Esse recurso faz parte do <span className="font-semibold text-fg">HubPatients Plus</span>.
            </p>
            <button
              onClick={() => setUpgrade(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-paper transition hover:bg-primary-hover"
            >
              <Sparkles className="h-4 w-4" /> Desbloquear no Plus
            </button>
          </div>
        </div>
      </section>

      <UpgradeModal open={upgrade} reason="insight" onClose={() => setUpgrade(false)} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
