'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useProfile, useActivePregnancy, useCycleSettings, useCycleLogs } from '@hubpatients/supabase';
import {
  currentPhase,
  daysUntilNextPeriod,
  findLastPeriodStart,
} from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { PrivacyBanner } from '@/components/cycle/privacy-banner';
import { PhaseCard } from '@/components/cycle/phase-card';
import { CycleCalendar } from '@/components/cycle/cycle-calendar';
import { LogDayModal } from '@/components/cycle/log-day-modal';
import { CycleDisclaimer } from '@/components/cycle/cycle-disclaimer';

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function CicloPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const { data: pregnancy, isLoading: pregnancyLoading } = useActivePregnancy(user?.id);
  const { data: settings, isLoading: settingsLoading } = useCycleSettings(user?.id);
  const { data: logs, isLoading: logsLoading, isError } = useCycleLogs(user?.id);

  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const cycleLength = settings?.average_cycle_days ?? 28;
  const periodDays = settings?.average_period_days ?? 5;

  const { phase, daysUntil } = useMemo(() => {
    const list = logs ?? [];
    const lastStart = findLastPeriodStart(list);
    return {
      phase: currentPhase(new Date(), lastStart, cycleLength, periodDays),
      daysUntil: daysUntilNextPeriod(list, { average_cycle_days: cycleLength }, new Date()),
    };
  }, [logs, cycleLength, periodDays]);

  const loading = profileLoading || pregnancyLoading || settingsLoading || logsLoading;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    );
  }

  // Guarda de acesso: recurso para a própria pessoa que menstrua.
  if (profile && profile.biological_sex !== 'female') {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-sm text-muted">
          O acompanhamento do ciclo menstrual fica disponível no seu próprio perfil.
        </p>
      </div>
    );
  }

  // Durante gestação ativa, o acompanhamento do ciclo é pausado.
  if (pregnancy) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 hp-page hp-page--journey">
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-fg">
            Acompanhamento do ciclo pausado durante a gestação.
          </p>
          <p className="mt-1 text-xs text-muted">
            Ele volta a ficar disponível após o fim da gestação registrada.
          </p>
        </div>
        <CycleDisclaimer />
      </div>
    );
  }

  function openModal(dateISO: string) {
    setModalDate(dateISO);
    setModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 hp-page hp-page--journey">
      <PrivacyBanner />

      <div className="flex items-center justify-between gap-3">
        <h1
          className="text-xl font-bold text-fg"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Ciclo menstrual
        </h1>
        <button
          onClick={() => openModal(todayISO())}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-400 px-4 text-sm font-semibold text-white shadow-sm shadow-fuchsia-500/20 transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Registrar hoje
        </button>
      </div>

      {isError && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
          Não foi possível carregar seus registros. Tente novamente mais tarde.
        </div>
      )}

      <PhaseCard phase={phase} daysUntilNext={daysUntil} />

      <CycleCalendar
        logs={logs ?? []}
        cycleLength={cycleLength}
        periodDays={periodDays}
        onPickDay={openModal}
      />

      <CycleDisclaimer />

      <LogDayModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={userId}
        targetDate={modalDate}
      />
    </div>
  );
}
