'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CreditCard,
  FileDown,
  HeartPulse,
  Pill,
  QrCode,
  ShieldAlert,
  Stethoscope,
  User,
  Users,
} from 'lucide-react';
import { useProfile, useInsurance, useAllergies } from '@hubpatients/supabase';
import { calculateAge, DISCLAIMERS } from '@hubpatients/core';
import { useActiveProfile } from '@/components/profile-context';
import { SectionCard } from '@/components/profile/section-card';
import { PersonalDataForm } from '@/components/profile/personal-data-form';
import { InsuranceForm } from '@/components/profile/insurance-form';
import { ConditionsSection } from '@/components/profile/conditions-section';
import { AllergiesSection } from '@/components/profile/allergies-section';
import { SurgeriesSection } from '@/components/profile/surgeries-section';
import { FamilyHistorySection } from '@/components/profile/family-history-section';
import { EmergencyQrModal, type AllergiesStatus } from '@/components/profile/emergency-qr-modal';
import { UpgradeModal } from '@/components/ui/upgrade-modal';

export default function PerfilPage() {
  const { patientId } = useActiveProfile();
  const { data: profile, isLoading } = useProfile(patientId || undefined);
  const { data: insurance } = useInsurance(patientId || undefined);
  /*
   * O estado da consulta de alergias importa tanto quanto o resultado dela.
   *
   * `data` volta `undefined` em três situações diferentes — ainda carregando,
   * consulta falhou, ou consulta deu certo e a pessoa não tem alergia. Tratar
   * as três como lista vazia faz o cartão de emergência afirmar "Alergias
   * graves: Nenhuma" para quem talvez tenha. Por isso o cartão só é liberado
   * com `isSuccess`: ausência de dado não vira ausência de alergia.
   */
  const {
    data: allergies,
    isSuccess: allergiesLoaded,
    isError: allergiesFailed,
    isFetching: allergiesFetching,
    refetch: refetchAllergies,
  } = useAllergies(patientId || undefined);

  const [qrOpen, setQrOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const isPlus = false; // Free por padrão (Fase 2 define o plano real)

  if (isLoading) {
    return <div className="mx-auto max-w-3xl space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-2" />)}</div>;
  }

  const name = profile?.full_name ?? 'Paciente';
  const initial = name.charAt(0).toUpperCase();
  const age = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null;
  const severe = (allergies ?? []).filter((a) => a.severity === 'severe');
  const allergiesStatus: AllergiesStatus = allergiesLoaded ? 'ok' : allergiesFailed ? 'erro' : 'carregando';

  function handleExport() {
    if (!isPlus) setUpgradeOpen(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Cabeçalho */}
      <header className="vl-rise rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-2xl font-bold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>{name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {age != null && <Tag>{age} anos</Tag>}
              {profile && profile.blood_type !== 'unknown' && <Tag>{profile.blood_type}</Tag>}
              {insurance && <Tag icon={<CreditCard className="h-3 w-3" />}>{insurance.operator}</Tag>}
              {severe.map((a) => (
                <Tag key={a.id} tone="alert" icon={<AlertTriangle className="h-3 w-3" />}>{a.substance}</Tag>
              ))}
              {/* Sem esse aviso, a falha da consulta ficaria indistinguível de "não tem alergia grave". */}
              {allergiesFailed && (
                <Tag tone="alert" icon={<AlertTriangle className="h-3 w-3" />}>Alergias não carregadas</Tag>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setQrOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-sm font-medium text-fg transition hover:bg-surface-2">
              <QrCode className="h-4 w-4 text-primary" /> Emergência
            </button>
            <button onClick={handleExport} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-sm font-medium text-fg transition hover:bg-surface-2">
              <FileDown className="h-4 w-4 text-primary" /> Exportar PDF
              {!isPlus && <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">PLUS</span>}
            </button>
          </div>
        </div>
      </header>

      <SectionCard icon={User} title="Dados pessoais" subtitle="Nome, nascimento, CPF, contato e endereço" defaultOpen>
        <PersonalDataForm userId={patientId} profile={profile ?? null} />
      </SectionCard>

      <SectionCard icon={CreditCard} title="Convênio" subtitle={insurance ? insurance.operator : 'Não informado'}>
        <InsuranceForm patientId={patientId} insurance={insurance ?? null} />
      </SectionCard>

      <SectionCard icon={Stethoscope} title="Condições de saúde" subtitle="Diagnósticos e CID-10">
        <ConditionsSection patientId={patientId} />
      </SectionCard>

      <SectionCard
        icon={ShieldAlert}
        title="Alergias"
        subtitle="Substâncias e gravidade"
        badge={severe.length > 0 ? <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">{severe.length} grave(s)</span> : undefined}
      >
        <AllergiesSection patientId={patientId} />
      </SectionCard>

      <SectionCard icon={HeartPulse} title="Cirurgias" subtitle="Procedimentos realizados">
        <SurgeriesSection patientId={patientId} />
      </SectionCard>

      <SectionCard icon={Users} title="Antecedentes familiares" subtitle="Histórico de saúde da família">
        <FamilyHistorySection patientId={patientId} />
      </SectionCard>

      {/* Atalho medicamentos */}
      <Link href="/medicamentos" className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 transition hover:border-primary/40">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-primary"><Pill className="h-[18px] w-[18px]" /></span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-fg">Medicamentos de uso contínuo</p>
          <p className="text-xs text-muted">Gerencie sua lista e registre tomadas</p>
        </div>
        <span className="text-sm text-primary">→</span>
      </Link>

      <p className="text-center text-xs text-muted">{DISCLAIMERS.notDiagnosis}</p>

      <EmergencyQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        name={name}
        bloodType={profile?.blood_type}
        allergies={severe.map((a) => a.substance)}
        allergiesStatus={allergiesStatus}
        onRetry={() => void refetchAllergies()}
        retrying={allergiesFetching}
      />
      <UpgradeModal open={upgradeOpen} reason="pdf_export" onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}

function Tag({ children, tone, icon }: { children: React.ReactNode; tone?: 'alert'; icon?: React.ReactNode }) {
  const cls = tone === 'alert' ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-line bg-surface-2 text-fg-soft';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>
      {icon}
      {children}
    </span>
  );
}
