'use client';

import { useMemo, useState } from 'react';
import { Pill, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useMedications, useRecentIntakes, useRegisterIntake, useDrugInteractions } from '@vidalog/supabase';
import { FREE_MEDICATION_LIMIT } from '@vidalog/core';
import { useActiveProfile } from '@/components/profile-context';
import { MedicationCard } from '@/components/meds/medication-card';
import { InteractionBanner } from '@/components/meds/interaction-banner';
import { NewMedicationModal } from '@/components/meds/new-medication-modal';
import { UpgradeModal, type UpgradeReason } from '@/components/ui/upgrade-modal';

export default function MedicamentosPage() {
  const { patientId } = useActiveProfile();
  const { data: meds } = useMedications(patientId || undefined);
  const { data: intakes, refetch: refetchIntakes } = useRecentIntakes(patientId || undefined);
  const registerIntake = useRegisterIntake(patientId);

  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [upgrade, setUpgrade] = useState<UpgradeReason | null>(null);

  const isPlus = false;

  const active = useMemo(() => (meds ?? []).filter((m) => m.active), [meds]);
  const inactive = useMemo(() => (meds ?? []).filter((m) => !m.active), [meds]);
  const shown = tab === 'active' ? active : inactive;

  const activeNames = active.map((m) => m.name);
  const { data: interactions } = useDrugInteractions(activeNames, isPlus);

  function handleNew() {
    if (!isPlus && active.length >= FREE_MEDICATION_LIMIT) {
      setUpgrade('unlimited_medications');
      return;
    }
    setModalOpen(true);
  }

  async function handleRegister(medicationId: string, time: string) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await registerIntake.mutateAsync({
        patient_id: patientId,
        medication_id: medicationId,
        status: 'taken',
        scheduled_for: new Date(`${today}T${time}`).toISOString(),
        taken_at: new Date().toISOString(),
      });
      await refetchIntakes();
      toast.success('Tomada registrada. 👏');
    } catch {
      toast.error('Não foi possível registrar.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Medicamentos</h1>
        <div className="flex items-center gap-3">
          {!isPlus && (
            <span className="text-xs text-muted">
              {active.length}/{FREE_MEDICATION_LIMIT} medicamentos
            </span>
          )}
          <button
            onClick={handleNew}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo
          </button>
        </div>
      </header>

      {/* Checador de interações */}
      {active.length > 1 && (
        <InteractionBanner isPlus={isPlus} interactions={interactions ?? []} onUpgrade={() => setUpgrade('interactions')} />
      )}

      {/* Abas */}
      <div className="flex w-fit rounded-xl border border-line bg-surface p-1">
        <Tab active={tab === 'active'} onClick={() => setTab('active')}>Ativos ({active.length})</Tab>
        <Tab active={tab === 'inactive'} onClick={() => setTab('inactive')}>Inativos ({inactive.length})</Tab>
      </div>

      {/* Lista */}
      {shown.length > 0 ? (
        <div className="space-y-3">
          {shown.map((m) => (
            <MedicationCard
              key={m.id}
              medication={m}
              intakes={(intakes ?? []).filter((i) => i.medication_id === m.id)}
              onRegister={(time) => handleRegister(m.id, time)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-16 text-center">
          <Pill className="h-8 w-8 text-faint" />
          <p className="mt-3 text-sm text-muted">
            {tab === 'active' ? 'Nenhum medicamento ativo.' : 'Nenhum medicamento inativo.'}
          </p>
        </div>
      )}

      <p className="text-center text-xs text-muted">
        Lembrete básico e registro de tomada são gratuitos, sempre. 💙
      </p>

      <NewMedicationModal open={modalOpen} onClose={() => setModalOpen(false)} patientId={patientId} />
      <UpgradeModal open={upgrade !== null} reason={upgrade ?? 'generic'} onClose={() => setUpgrade(null)} />
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${active ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'}`}
    >
      {children}
    </button>
  );
}
