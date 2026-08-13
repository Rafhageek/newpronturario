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
import { calculateAge, DISCLAIMERS, estadoSecao, podeAfirmarAusencia } from '@hubpatients/core';
import { useActiveProfile } from '@/components/profile-context';
import { SectionCard } from '@/components/profile/section-card';
import { PersonalDataForm } from '@/components/profile/personal-data-form';
import { InsuranceForm } from '@/components/profile/insurance-form';
import { ConditionsSection } from '@/components/profile/conditions-section';
import { AllergiesSection } from '@/components/profile/allergies-section';
import { SurgeriesSection } from '@/components/profile/surgeries-section';
import { FamilyHistorySection } from '@/components/profile/family-history-section';
import {
  EmergencyQrModal,
  type AllergiesStatus,
  type DeclaracaoSemAlergia,
} from '@/components/profile/emergency-qr-modal';
import { UpgradeModal } from '@/components/ui/upgrade-modal';

export default function PerfilPage() {
  const { patientId } = useActiveProfile();
  /*
   * `isSuccess`/`isError` do PERFIL entram na conta porque o cartão de
   * emergência passou a falar da declaração "não tenho alergia conhecida"
   * (coluna `profiles.sem_alergia_conhecida_em`, migration 0049). Dizer que a
   * pessoa declarou — ou que NÃO declarou — é afirmar um fato; e afirmar um
   * fato exige que a leitura tenha voltado do servidor.
   */
  const {
    data: profile,
    isLoading,
    isSuccess: perfilCarregado,
    isError: perfilFalhou,
  } = useProfile(patientId || undefined);
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
    return <div className="mx-auto max-w-3xl space-y-4 hp-page">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-2" />)}</div>;
  }

  const name = profile?.full_name ?? 'Paciente';
  const initial = name.charAt(0).toUpperCase();
  const age = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null;
  const lista = allergies ?? [];
  const severe = lista.filter((a) => a.severity === 'severe');

  /*
   * As duas leituras passam pelo MESMO juiz (`estadoSecao`, a trava de
   * veracidade do core). O terceiro estado é o que as flags do React Query não
   * mostram: com `patientId` vazio a consulta fica desligada e `isLoading` e
   * `isError` são ambos `false` — sem `sujeitoConhecido`, "não sei de quem é o
   * prontuário" viraria "confirmado" sem que ninguém tivesse perguntado nada.
   */
  const estadoAlergias = estadoSecao({
    sujeitoConhecido: Boolean(patientId),
    isSuccess: allergiesLoaded,
    isError: allergiesFailed,
  });
  const allergiesStatus: AllergiesStatus =
    estadoAlergias === 'confirmada' ? 'ok' : estadoAlergias === 'falhou' ? 'erro' : 'carregando';

  const estadoPerfil = estadoSecao({
    sujeitoConhecido: Boolean(patientId),
    isSuccess: perfilCarregado,
    isError: perfilFalhou,
  });
  /*
   * `?? null` porque, enquanto a migration 0049 não estiver aplicada, a chave
   * nem vem no JSON do perfil — e `undefined` ali é indistinguível de "não
   * declarou". Quem manda é `podeAfirmarAusencia`: sem perfil confirmado, o
   * cartão recebe `desconhecida` e não afirma nem uma coisa nem outra.
   */
  const declaradoEm = profile?.sem_alergia_conhecida_em ?? null;
  const semAlergiaConhecida: DeclaracaoSemAlergia = !podeAfirmarAusencia(estadoPerfil)
    ? { estado: 'desconhecida' }
    : declaradoEm
      ? { estado: 'declarada', em: declaradoEm }
      : { estado: 'ausente' };

  function handleExport() {
    if (!isPlus) setUpgradeOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 hp-page">
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
              {insurance && <Tag icon={<CreditCard className="h-3.5 w-3.5" />}>{insurance.operator}</Tag>}
              {severe.map((a) => (
                <Tag key={a.id} tone="alert" icon={<AlertTriangle className="h-3.5 w-3.5" />}>{a.substance}</Tag>
              ))}
              {/* Sem esse aviso, a falha da consulta ficaria indistinguível de "não tem alergia grave". */}
              {allergiesFailed && (
                <Tag tone="alert" icon={<AlertTriangle className="h-3.5 w-3.5" />}>Alergias não carregadas</Tag>
              )}
            </div>
          </div>
          {/*
            Dois defeitos na mesma dupla de botões: altura `h-10` (40px, abaixo
            do piso de 44px do projeto — e "Emergência" é o botão que alguém vai
            tocar com pressa) e rótulo em `text-sm` (14px). Agora `min-h-11` e
            `text-body-sm` (15px em `rem`, que o Modo Sênior escala).
            Tinta inalterada: `--fg` sobre o fundo do cabeçalho dá 15,14:1 no
            claro e 13,22:1 no escuro.
            O selo PLUS sobe de 10px para `text-caption` (13px, o piso absoluto
            do sistema; 15px ali competiria com o próprio rótulo do botão) —
            `--primary` sobre sky-500/20 no cabeçalho: 6,10:1 claro, 5,10:1
            escuro.
          */}
          <div className="flex gap-2">
            <button onClick={() => setQrOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3.5 text-body-sm font-medium text-fg transition hover:bg-surface-2">
              <QrCode className="h-4 w-4 text-primary" aria-hidden="true" /> Emergência
            </button>
            <button onClick={handleExport} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3.5 text-body-sm font-medium text-fg transition hover:bg-surface-2">
              <FileDown className="h-4 w-4 text-primary" aria-hidden="true" /> Exportar PDF
              {!isPlus && <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-caption font-bold text-primary">PLUS</span>}
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

      {/*
        O selo de alergias graves era o MENOR texto da tela — `text-[10px]`,
        dois degraus abaixo do piso de 13px e colado no subtítulo que o cliente
        apontou com a seta. Pior: `text-[Npx]` é pixel fixo, então ele também
        não crescia no Modo Sênior. Agora `text-body-sm` (15px em `rem`), e a
        tinta subiu de rose-700 para rose-800 para ganhar folga sobre o fundo
        REAL do selo (rose-500/20 sobre `--surface`, e sobre `--surface-2` no
        hover do cabeçalho):
          claro   #9f1239 sobre #fdd9df =  6,17:1 · hover 5,83:1 (era 4,84/4,57)
          escuro  #fecdd3 sobre #431f25 = 10,19:1 · hover 9,15:1 (era 7,60/6,82)
        O vermelho aqui é alerta de segurança do SISTEMA — a contagem de
        alergias graves —, não semáforo sobre o corpo de ninguém.
      */}
      <SectionCard
        icon={ShieldAlert}
        title="Alergias"
        subtitle="Substâncias e gravidade"
        badge={severe.length > 0 ? <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-body-sm font-bold text-rose-800 dark:text-rose-200">{severe.length} grave(s)</span> : undefined}
      >
        <AllergiesSection patientId={patientId} />
      </SectionCard>

      <SectionCard icon={HeartPulse} title="Cirurgias" subtitle="Procedimentos realizados">
        <SurgeriesSection patientId={patientId} />
      </SectionCard>

      <SectionCard icon={Users} title="Antecedentes familiares" subtitle="Histórico de saúde da família">
        <FamilyHistorySection patientId={patientId} />
      </SectionCard>

      {/* Atalho medicamentos. Título saía em 14px e a explicação em 12px/--muted;
          agora seguem os mesmos degraus do cabeçalho de seção (17px + 15px), com
          --fg-soft sobre --surface: 10,40:1 no claro e 12,05:1 no escuro. */}
      <Link href="/medicamentos" className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 transition hover:border-primary/40">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-primary"><Pill className="h-[18px] w-[18px]" aria-hidden="true" /></span>
        <div className="flex-1">
          <p className="text-body font-semibold text-fg">Medicamentos de uso contínuo</p>
          <p className="text-body-sm text-fg-soft">Gerencie sua lista e registre tomadas</p>
        </div>
        <span className="text-body text-primary" aria-hidden="true">→</span>
      </Link>

      {/*
        REGRA 1 DO PRODUTO ("o app não diagnostica nem prescreve") era o texto
        MAIS APAGADO da página: `text-xs` (12px) na tinta mais fraca — 5,50:1 de
        `--muted` sobre o canvas `--bg`. A frase que sustenta a ética do produto
        não pode ser a menos legível da tela, ainda mais numa página cujo público
        é 50+.

        Agora `text-body-sm` (15px, o piso do projeto, em `rem` puro para o Modo
        Sênior levá-lo a ~19,5px) e `--fg-soft`, medido pela fórmula da WCAG 2.x
        contra o fundo REAL desta linha (`--bg` dentro de `.hp-clinical-shell`):
          claro   #354056 sobre #f5f7fb =  9,70:1  (era 5,50:1)
          escuro  #cfd4dd sobre #0d0d0d = 13,06:1  (era 8,50:1)
      */}
      <p className="text-center text-body-sm text-fg-soft">{DISCLAIMERS.notDiagnosis}</p>

      <EmergencyQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        name={name}
        bloodType={profile?.blood_type}
        allergies={severe.map((a) => a.substance)}
        /*
         * O TOTAL vai junto das graves de propósito. O cartão lista só as
         * graves, mas quem tem alergia registrada sem marca de gravidade não
         * pode cair no texto de "sem informação": alguém preencheu, e o
         * socorrista precisa saber que existe algo a perguntar.
         */
        allergiesTotal={lista.length}
        allergiesStatus={allergiesStatus}
        semAlergiaConhecida={semAlergiaConhecida}
        onRetry={() => void refetchAllergies()}
        retrying={allergiesFetching}
      />
      <UpgradeModal open={upgradeOpen} reason="pdf_export" onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}

/*
 * Os chips do cabeçalho não são enfeite: eles carregam idade, tipo sanguíneo,
 * convênio, o nome de cada ALERGIA GRAVE e o aviso de "alergias não carregadas".
 * Saíam todos em `text-xs` (12px), abaixo do piso de 13px do sistema — a
 * informação mais crítica da página na menor letra dela.
 *
 * Agora `text-body-sm` (15px em `rem`, escala no Modo Sênior). Tintas medidas
 * pela fórmula da WCAG 2.x contra o fundo REAL de cada chip:
 *   neutro  --fg-soft sobre --surface-2:  9,80:1 claro · 10,82:1 escuro
 *   alerta  rose-800/rose-200 sobre rose-500/10 no cabeçalho (#eddfea / #35252d):
 *           6,24:1 claro · 10,24:1 escuro  (antes, com rose-700/300: 4,89 e 7,64)
 * O vermelho é do SISTEMA (aviso de segurança e falha de leitura), não uma
 * leitura de cor sobre o corpo do paciente.
 */
function Tag({ children, tone, icon }: { children: React.ReactNode; tone?: 'alert'; icon?: React.ReactNode }) {
  const cls = tone === 'alert' ? 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200' : 'border-line bg-surface-2 text-fg-soft';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-body-sm font-medium ${cls}`}>
      {icon}
      {children}
    </span>
  );
}
