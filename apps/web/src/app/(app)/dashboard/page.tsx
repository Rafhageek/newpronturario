'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Brain,
  CalendarDays,
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
} from '@vidalog/supabase';
import {
  APPOINTMENT_KIND_LABELS,
  classifyBloodPressure,
  DISCLAIMERS,
  formatVital,
  MEDICATION_FORM_LABELS,
} from '@vidalog/core';
import { useActiveProfile } from '@/components/profile-context';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { BloodPressureChart } from '@/components/dashboard/bp-chart';
import { UpgradeModal } from '@/components/ui/upgrade-modal';
import { container, MetricCard, StatusChip, Trend } from '@/components/dashboard/metric-cards';
import { toast } from 'sonner';

function greeting(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardPage() {
  const { patientId } = useActiveProfile();
  const { data: profile } = useProfile(patientId || undefined);
  const { data } = useDashboard(patientId || undefined);
  const { data: bpRange } = useVitalsRange(patientId || undefined, 'blood_pressure', 30);
  const { data: nextAppt } = useNextAppointment(patientId || undefined);
  const { data: wellbeing } = useDiarySummary(patientId || undefined);
  const { data: allergies } = useAllergies(patientId || undefined);
  const registerIntake = useRegisterIntake(patientId);

  const [upgrade, setUpgrade] = useState(false);

  const now = new Date();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Paciente';
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const bp = data?.latestBloodPressure ?? null;
  const meds = data?.activeMedications ?? [];
  const upcoming = data?.upcomingIntakes ?? [];
  const nextMed = meds[0] ?? null;
  const severeAllergies = (allergies ?? []).filter((a) => a.severity === 'severe');

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

  async function handleRegisterIntake() {
    if (!nextMed) return;
    try {
      await registerIntake.mutateAsync({
        patient_id: patientId,
        medication_id: nextMed.id,
        status: 'taken',
        taken_at: new Date().toISOString(),
      });
      toast.success('Tomada registrada. 👏');
    } catch {
      toast.error('Não foi possível registrar.');
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Hero */}
      <section className="vl-rise relative overflow-hidden rounded-2xl border border-line bg-surface p-7">
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">{dateLabel}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-fg" style={{ fontFamily: 'var(--font-display)' }}>
              {greeting(now.getHours())},{' '}
              <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">{firstName}</span>
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              Sua saúde, registrada com cuidado e clareza. Tudo o que importa, num só lugar.
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 sm:flex">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-fg">Dados protegidos</p>
              <p className="text-xs text-emerald-300/80">Conforme a LGPD</p>
            </div>
          </div>
        </div>
      </section>

      {/* Métricas */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Próxima medicação */}
        <MetricCard icon={Pill} accent="#38BDF8" label="Próxima medicação">
          {nextMed ? (
            <>
              <p className="truncate text-lg font-bold text-fg">{nextMed.name}</p>
              <p className="text-xs text-muted">
                {nextMed.dosage ?? MEDICATION_FORM_LABELS[nextMed.form]}
              </p>
              <button
                onClick={handleRegisterIntake}
                disabled={registerIntake.isPending}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-60"
              >
                <Clock className="h-3.5 w-3.5" /> Registrar tomada
              </button>
            </>
          ) : (
            <p className="text-sm text-muted">Nenhum medicamento ativo.</p>
          )}
        </MetricCard>

        {/* Última PA */}
        <MetricCard icon={HeartPulse} accent="#FB7185" label="Última pressão">
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
        <MetricCard icon={CalendarDays} accent="#FBBF24" label="Próxima consulta">
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
        <MetricCard icon={Smile} accent="#34D399" label="Bem-estar (7 dias)">
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

      {/* Gráfico de PA 30 dias */}
      <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HeartPulse className="h-5 w-5 text-rose-400" />
            <h3 className="text-sm font-semibold text-fg">Pressão arterial · 30 dias</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <Legend color="#10B981" label="referência" />
            <Legend color="#F59E0B" label="atenção" />
            <Legend color="#EF4444" label="acima" />
          </div>
        </div>
        <BloodPressureChart vitals={range} />
        <p className="mt-2 text-[11px] text-muted">{DISCLAIMERS.examInterpretation}</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
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
              {upcoming.slice(0, 5).map((intake) => (
                <li key={intake.id} className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2">
                  <span className="text-sm text-fg">Medicação pendente</span>
                  <span className="text-xs text-muted">
                    {intake.scheduled_for ? new Date(intake.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Alertas */}
        <section className="vl-rise rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-fg">Alertas</h3>
          </div>
          {severeAllergies.length === 0 ? (
            <p className="text-sm text-muted">Nenhum alerta no momento.</p>
          ) : (
            <ul className="space-y-2">
              {severeAllergies.map((a) => (
                <li key={a.id} className="flex items-center gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span className="text-sm text-rose-200">
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

      {/* Insight da semana (Plus) */}
      <section className="vl-rise relative overflow-hidden rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-primary">
            <Brain className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-fg">Insight da semana</h3>
            <p className="text-xs text-muted">Um resumo inteligente da sua saúde, atualizado toda semana.</p>
          </div>
        </div>
        <div className="relative mt-4">
          <div className="space-y-2 blur-sm select-none" aria-hidden>
            <div className="h-3 w-3/4 rounded bg-white/10" />
            <div className="h-3 w-2/3 rounded bg-white/10" />
            <div className="h-3 w-5/6 rounded bg-white/10" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/15 text-primary ring-1 ring-sky-400/30">
              <Lock className="h-5 w-5" />
            </span>
            <p className="text-center text-sm text-fg-soft">
              Esse recurso faz parte do <span className="font-semibold text-fg">VidaLog Plus</span>.
            </p>
            <button
              onClick={() => setUpgrade(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90"
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
