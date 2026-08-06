'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, Package, Pill, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useMedications,
  useRecentIntakes,
  useRegisterIntake,
  useDrugInteractions,
  useDoseAdherence,
  useRecordDoseEvent,
} from '@hubpatients/supabase';
import {
  adherenceByHour,
  adherenceRate,
  dailyDosesFromMed,
  expectedDosesInDays,
  findFarmaciaPopularItem,
  stockForecast,
  ADHERENCE_DISCLAIMER,
  type Medication,
} from '@hubpatients/core';
import { useActiveProfile } from '@/components/profile-context';
import { MedicationCard } from '@/components/meds/medication-card';
import { FarmaciaPopularBadge } from '@/components/meds/farmacia-popular-badge';
import { InteractionBanner } from '@/components/meds/interaction-banner';
import { NewMedicationModal } from '@/components/meds/new-medication-modal';
import { StockModal } from '@/components/meds/stock-modal';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui';
import { PageHeader } from '@/components/ui/painel';
import { scheduledAtToday } from '@/lib/time';

/** Janela do painel de adesão e do alerta de reposição (paridade com o mobile). */
const ADHERENCE_DAYS = 30;
const STOCK_ALERT_DAYS = 7;

const dayWord = (n: number) => (n === 1 ? 'dia' : 'dias');

/** 'AAAA-MM-DD' -> 'DD/MM'. */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return month && day ? `${day}/${month}` : isoDate;
}

export default function MedicamentosPage() {
  const { patientId, ownId, active: activeProfile } = useActiveProfile();
  const { data: meds } = useMedications(patientId || undefined);
  const { data: intakes, refetch: refetchIntakes } = useRecentIntakes(patientId || undefined);
  const registerIntake = useRegisterIntake(patientId);

  // dose_events é owner-only (RLS user_id = auth.uid()): só no próprio perfil.
  const selfView = activeProfile.isSelf;
  const { data: doseSummary } = useDoseAdherence(selfView && ownId ? ownId : undefined, ADHERENCE_DAYS);
  const recordDose = useRecordDoseEvent(selfView && ownId ? ownId : undefined);

  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [stockMed, setStockMed] = useState<Medication | null>(null);

  const active = useMemo(() => (meds ?? []).filter((m) => m.active), [meds]);
  const inactive = useMemo(() => (meds ?? []).filter((m) => !m.active), [meds]);
  const shown = tab === 'active' ? active : inactive;

  // Reposição de estoque: quando acaba, pelo consumo cadastrado. Alerta se falta
  // menos de uma semana OU se o limiar configurado pela pessoa já foi atingido.
  const stockAlerts = useMemo(() => {
    return active
      .map((med) => ({
        med,
        forecast: stockForecast({
          stockCount: med.stock_count,
          dosesPerDay: dailyDosesFromMed(med.frequency, med.times),
        }),
      }))
      .filter(({ med, forecast }) => {
        const days = forecast.daysRemaining;
        return days != null && (days < STOCK_ALERT_DAYS || days <= med.stock_low_threshold_days);
      })
      .sort((a, b) => (a.forecast.daysRemaining ?? 0) - (b.forecast.daysRemaining ?? 0));
  }, [active]);

  const firstAlert = stockAlerts[0];

  const activeNames = active.map((m) => m.name);
  const {
    data: interactions,
    isLoading: interactionsLoading,
    isError: interactionsError,
  } = useDrugInteractions(activeNames, activeNames.length > 1);

  function handleNew() {
    setModalOpen(true);
  }

  /**
   * Espelha a confirmação em `dose_events` para a adesão contar tanto o que veio
   * da ação da notificação (celular) quanto o que foi marcado aqui. Silencioso:
   * a tomada já foi registrada, uma falha aqui não vira erro na tela.
   */
  function mirrorDoseEvent(medicationId: string, scheduledFor: string) {
    if (!selfView || !ownId) return;
    recordDose
      .mutateAsync({
        medication_id: medicationId,
        scheduled_for: scheduledFor,
        status: 'taken',
        source: 'app',
      })
      .catch(() => undefined);
  }

  async function handleRegister(medicationId: string, time: string) {
    const scheduledFor = scheduledAtToday(time);
    try {
      await registerIntake.mutateAsync({
        patient_id: patientId,
        medication_id: medicationId,
        status: 'taken',
        scheduled_for: scheduledFor,
        taken_at: new Date().toISOString(),
      });
      mirrorDoseEvent(medicationId, scheduledFor);
      await refetchIntakes();
      toast.success('Tomada registrada. 👏');
    } catch {
      toast.error('Não foi possível registrar.');
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 hp-page">
      <PageHeader
        eyebrow="Meu prontuário"
        title="Medicamentos"
        subtitle="Organize horários, confirme tomadas e acompanhe quando será necessário repor o estoque."
        icon={Pill}
        tone="azul"
        right={
          <button
            type="button"
            onClick={handleNew}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo
          </button>
        }
      />

      {/* Lembrete de reposição: quando acaba e em que data. */}
      {firstAlert && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
          <Package className="h-5 w-5 shrink-0 text-status-alert-ink" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">
              {`Seu estoque de ${firstAlert.med.name} acaba em ${firstAlert.forecast.daysRemaining} ${dayWord(firstAlert.forecast.daysRemaining ?? 0)}.`}
            </p>
            <p className="text-xs text-rose-700/80 dark:text-rose-200/80">
              {firstAlert.forecast.runsOutOn
                ? `Previsão pelo consumo cadastrado: por volta de ${shortDate(firstAlert.forecast.runsOutOn)}.`
                : 'Previsão pelo consumo cadastrado.'}
              {stockAlerts.length > 1 ? ` Outros ${stockAlerts.length - 1} também estão acabando.` : ''}
            </p>
          </div>
          <button
            onClick={() => setStockMed(firstAlert.med)}
            className="shrink-0 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Comprei mais
          </button>
        </div>
      )}

      {/* Adesão dos últimos 30 dias (só no próprio perfil — dose_events é owner-only). */}
      {selfView && <AdherencePanel meds={active} summary={doseSummary} />}

      {/* Checador de interações */}
      {active.length > 1 && (
        <InteractionBanner
          interactions={interactions ?? []}
          isLoading={interactionsLoading}
          isError={interactionsError}
        />
      )}

      {/* Abas */}
      <Tabs<'active' | 'inactive'>
        ariaLabel="Filtrar medicamentos"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'active', label: `Ativos (${active.length})` },
          { key: 'inactive', label: `Inativos (${inactive.length})` },
        ]}
      />

      {/* Lista */}
      {shown.length > 0 ? (
        <div className="space-y-3">
          {shown.map((m) => {
            // Etiqueta informativa: o princípio ativo consta no elenco gratuito do
            // Farmácia Popular. Não é indicação nem promessa de direito adquirido.
            const farmaciaPopular = findFarmaciaPopularItem(m.name);
            return (
              <div key={m.id}>
                <MedicationCard
                  medication={m}
                  intakes={(intakes ?? []).filter((i) => i.medication_id === m.id)}
                  onRegister={(time) => handleRegister(m.id, time)}
                  onStock={() => setStockMed(m)}
                />
                {farmaciaPopular && (
                  <div className="mt-2 pl-1">
                    <FarmaciaPopularBadge item={farmaciaPopular} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : tab === 'active' ? (
        <EmptyState
          icon={Pill}
          title="Nenhum medicamento ativo"
          description="Cadastre seus remédios para receber lembretes e registrar as tomadas."
          action={
            <Button onClick={handleNew}>
              <Plus className="mr-1.5 h-4 w-4" /> Adicionar primeiro medicamento
            </Button>
          }
        />
      ) : (
        <EmptyState icon={Pill} title="Nenhum medicamento inativo" />
      )}

      <p className="text-center text-xs text-muted">
        Lembrete básico e registro de tomada são gratuitos, sempre. 💙
      </p>

      <NewMedicationModal open={modalOpen} onClose={() => setModalOpen(false)} patientId={patientId} />
      {stockMed && (
        <StockModal open={Boolean(stockMed)} onClose={() => setStockMed(null)} medication={stockMed} patientId={patientId} />
      )}
    </div>
  );
}

/* ──────────────────────────── Adesão · 30 dias ──────────────────────────── */

/** Formato mínimo do agregado (evita depender do tipo exportado do pacote). */
type DoseSummaryLike = {
  taken: number;
  snoozed: number;
  skipped: number;
  registered: number;
  events: { scheduled_for: string; status: 'taken' | 'snoozed' | 'skipped' }[];
};

/**
 * Doses confirmadas nos últimos 30 dias — pela ação da notificação no celular
 * ou marcadas aqui. É contagem, não avaliação: nada de "adesão ruim". Quem lê
 * o tratamento é a equipe de saúde.
 */
function AdherencePanel({ meds, summary }: { meds: Medication[]; summary: DoseSummaryLike | undefined }) {
  const timesPerDay = meds.reduce((sum, m) => sum + m.times.length, 0);
  const expected = expectedDosesInDays(timesPerDay, ADHERENCE_DAYS);
  const events = summary?.events ?? [];
  const rate = adherenceRate(events, expected);

  // Padrão por horário: ajuda a pessoa a ver sozinha qual dose costuma escapar.
  const byHour = adherenceByHour(events).filter((b) => b.total >= 3);
  const lowest = byHour.length > 1 ? byHour.reduce((a, b) => ((b.rate ?? 100) < (a.rate ?? 100) ? b : a)) : null;
  const weakest = lowest && lowest.rate != null && lowest.rate < 100 ? lowest : null;

  if (meds.length === 0) return null;

  return (
    <section className="space-y-2 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 shrink-0 text-status-info-ink" />
        <h2 className="flex-1 text-sm font-semibold text-fg">Doses confirmadas · {ADHERENCE_DAYS} dias</h2>
        {rate != null && <span className="text-lg font-bold text-status-info-ink">{rate}%</span>}
      </div>

      {rate != null ? (
        <>
          <div
            role="progressbar"
            aria-valuenow={rate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Doses confirmadas nos últimos ${ADHERENCE_DAYS} dias`}
            className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${rate}%` }} />
          </div>
          <p className="text-xs text-fg-soft">
            {`Você confirmou ${summary?.taken ?? 0} de ${expected} doses previstas nos últimos ${ADHERENCE_DAYS} dias.`}
          </p>
        </>
      ) : (
        <p className="text-xs text-fg-soft">
          Cadastre os horários dos seus remédios para acompanhar as doses confirmadas.
        </p>
      )}

      {weakest && (
        <p className="text-xs text-muted">
          {`Por horário: às ${String(weakest.hour).padStart(2, '0')}h você confirmou ${weakest.taken} de ${weakest.total} vezes.`}
        </p>
      )}

      {((summary?.snoozed ?? 0) > 0 || (summary?.skipped ?? 0) > 0) && (
        <p className="text-[11px] text-muted">
          {`Adiadas: ${summary?.snoozed ?? 0} · marcadas como puladas: ${summary?.skipped ?? 0}.`}
        </p>
      )}

      <p className="text-[11px] leading-4 text-muted">{ADHERENCE_DISCLAIMER}</p>
    </section>
  );
}
