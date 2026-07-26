'use client';

import { useState } from 'react';
import { BellRing, HeartHandshake, Mail, Pill, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProfile, useRelationships, useSentInvites, useInvitesForMe, useFamilyMutations,
  useDoseGuardianSettings, useSaveDoseGuardianSettings, useDisableDoseGuardian,
  useMedicationsCriticality, useSetMedicationCritical, useDoseGuardianActivePatients,
  DOSE_GUARDIAN_DELAY_OPTIONS,
} from '@hubpatients/supabase';
import { CARE_KIND_LABELS, type CaregiverPermissions } from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { RelationshipCard } from '@/components/family/relationship-card';
import { InviteModal } from '@/components/family/invite-modal';
import { UpgradeModal } from '@/components/ui/upgrade-modal';

export default function FamiliaPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const isPlus = false;

  const { data: profile } = useProfile(user?.id);
  const { data: relationships } = useRelationships(user?.id);
  const { data: sent } = useSentInvites(user?.id);
  const { data: forMe } = useInvitesForMe(Boolean(user?.id));
  const { accept, revoke, updatePermissions } = useFamilyMutations(userId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [upgrade, setUpgrade] = useState(false);

  const dependents = (relationships ?? []).filter((r) => r.direction === 'i_care_for');
  const caregivers = (relationships ?? []).filter((r) => r.direction === 'cares_for_me');

  function handleInvite() {
    if (!isPlus) { setUpgrade(true); return; }
    setInviteOpen(true);
  }

  async function handleAccept(token: string) {
    try {
      await accept.mutateAsync(token);
      toast.success('Convite aceito! Vínculo criado.');
    } catch {
      toast.error('Não foi possível aceitar (convite inválido ou expirado).');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Família</h1>
          <p className="text-xs text-muted">Modo cuidador — cuide de quem você ama, com permissões que você controla.</p>
        </div>
        <button onClick={handleInvite} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90">
          <UserPlus className="h-4 w-4" /> Convidar
          {!isPlus && <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-bold">PLUS</span>}
        </button>
      </header>

      {/* Convites para mim */}
      {(forMe ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-300">Convites para você</h2>
          {(forMe ?? []).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
              <div className="flex min-w-0 items-center gap-3">
                <Mail className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-amber-100">
                    <span className="font-semibold">{inv.inviter_name ?? 'Alguém'}</span> convidou você ({CARE_KIND_LABELS[inv.kind]}).
                  </p>
                  <p className="text-xs text-muted">{inv.role === 'i_am_caregiver' ? 'Para cuidar de você' : 'Para você cuidar'}</p>
                </div>
              </div>
              <button onClick={() => handleAccept(inv.token)} className="shrink-0 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25">Aceitar</button>
            </div>
          ))}
        </section>
      )}

      {/* Dependentes */}
      <Section icon={HeartHandshake} title={`Dependentes que eu cuido (${dependents.length})`}>
        {dependents.length > 0 ? dependents.map((v) => (
          <RelationshipCard key={v.relationship.id} view={v} onRevoke={() => revoke.mutate(v.relationship.id)} onUpdatePermissions={(p: CaregiverPermissions) => updatePermissions.mutate({ id: v.relationship.id, permissions: p })} />
        )) : <Empty text="Você ainda não cuida de ninguém. Convide um familiar." />}
      </Section>

      {/* Cuidadores */}
      <Section icon={ShieldCheck} title={`Quem cuida de mim (${caregivers.length})`}>
        {caregivers.length > 0 ? caregivers.map((v) => (
          <RelationshipCard key={v.relationship.id} view={v} onRevoke={() => revoke.mutate(v.relationship.id)} onUpdatePermissions={(p: CaregiverPermissions) => updatePermissions.mutate({ id: v.relationship.id, permissions: p })} />
        )) : <Empty text="Ninguém cuida de você ainda." />}
      </Section>

      {/* Guardião de Dose — consentimento do PACIENTE para avisar seus cuidadores */}
      <DoseGuardianSection userId={userId} caregivers={caregivers} dependents={dependents} />

      {/* Convites enviados */}
      {(sent ?? []).length > 0 && (
        <Section icon={Mail} title={`Convites enviados (${(sent ?? []).length})`}>
          {(sent ?? []).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm">
              <span className="text-fg-soft">{inv.invitee_email}</span>
              <span className="text-xs text-amber-700 dark:text-amber-300">pendente</span>
            </div>
          ))}
        </Section>
      )}

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} userId={userId} inviterName={profile?.full_name ?? 'Você'} />
      <UpgradeModal open={upgrade} reason="family_mode" onClose={() => setUpgrade(false)} />
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{text}</p>;
}

/* ==========================================================================
   Guardião de Dose
   --------------------------------------------------------------------------
   LGPD: avisar um cuidador de que faltou a confirmação de uma dose é
   compartilhar dado de saúde sensível. O consentimento é do PACIENTE — quem
   liga, escolhe o prazo, escolhe QUAIS remédios entram e desliga é só ele.
   O cuidador não tem nenhum controle sobre isto (nem no banco: a policy de
   dose_guardian_settings é owner-only).
   Ética: a mensagem é neutra ("não houve confirmação"), nunca acusatória, e
   nunca vira histórico de adesão para terceiro.
   ========================================================================== */

type RelLite = {
  relationship: { id: string; status: string; permissions: unknown };
  other: { id: string; full_name: string };
};

/** Mesmas chaves que a função dose_guardian_permission_granted() checa no banco. */
function recebeAvisoDeDose(permissions: unknown): boolean {
  const p = (permissions ?? {}) as Partial<Record<string, boolean>>;
  return Boolean(p.registrar_tomada || p.receber_alertas || p.medications);
}

function formatarAtraso(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${h} h` : `${h} h ${resto} min`;
}

function DoseGuardianSection({
  userId,
  caregivers,
  dependents,
}: {
  userId: string;
  caregivers: RelLite[];
  dependents: RelLite[];
}) {
  const { data: settings } = useDoseGuardianSettings(userId || undefined);
  const { data: meds } = useMedicationsCriticality(userId || undefined);
  const { data: ativos } = useDoseGuardianActivePatients(dependents.length > 0);
  const save = useSaveDoseGuardianSettings(userId || undefined);
  const disable = useDisableDoseGuardian(userId || undefined);
  const marcar = useSetMedicationCritical(userId || undefined);

  const enabled = settings?.enabled ?? false;
  const delay = settings?.delay_minutes ?? 90;

  // Quem receberá o aviso: cuidador ACEITO e com permissão de medicamentos.
  const avisados = caregivers.filter(
    (c) => c.relationship.status === 'accepted' && recebeAvisoDeDose(c.relationship.permissions),
  );
  const criticos = (meds ?? []).filter((m) => m.is_critical);

  // Lado do cuidador: quem eu cuido e mantém o recurso ligado (transparência).
  const dependentesComGuardiao = dependents.filter((d) =>
    (ativos ?? []).some((a) => a.patient_id === d.other.id),
  );

  async function alternar(next: boolean) {
    try {
      if (next) {
        await save.mutateAsync({ enabled: true, delay_minutes: delay });
        toast.success('Guardião de Dose ativado. Você pode desligar quando quiser.');
      } else {
        await disable.mutateAsync();
        toast.success('Guardião de Dose desligado. Ninguém mais será avisado.');
      }
    } catch {
      toast.error('Não foi possível salvar. Tente de novo.');
    }
  }

  async function mudarAtraso(min: number) {
    try {
      await save.mutateAsync({ delay_minutes: min });
    } catch {
      toast.error('Não foi possível salvar o prazo.');
    }
  }

  async function alternarCritico(id: string, next: boolean) {
    try {
      await marcar.mutateAsync({ medicationId: id, isCritical: next });
    } catch {
      toast.error('Não foi possível atualizar o medicamento.');
    }
  }

  return (
    <Section icon={BellRing} title="Guardião de Dose">
      <div className="space-y-4 rounded-2xl border border-line bg-surface-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">Avisar quem cuida de mim se faltar uma confirmação</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Se você não confirmar uma dose que marcou como importante, avisamos as pessoas que
              cuidam de você — para que possam dar uma força, não para cobrar.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Ativar Guardião de Dose"
            disabled={save.isPending || disable.isPending}
            onClick={() => void alternar(!enabled)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-line'}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`}
            />
          </button>
        </div>

        {enabled ? (
          <>
            {/* Prazo de tolerância */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-fg-soft">Esperar quanto tempo antes de avisar?</p>
              <div className="flex flex-wrap gap-2">
                {DOSE_GUARDIAN_DELAY_OPTIONS.map((min) => {
                  const active = min === delay;
                  return (
                    <button
                      key={min}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={save.isPending}
                      onClick={() => void mudarAtraso(min)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        active ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-surface text-muted hover:text-fg'
                      }`}
                    >
                      {formatarAtraso(min)}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted">
                Um prazo curto demais gera alarme falso. {formatarAtraso(delay)} costuma ser um bom começo.
              </p>
            </div>

            {/* Quais remédios entram */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Pill className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-semibold text-fg-soft">Quais remédios são importantes o bastante</p>
              </div>
              {(meds ?? []).length === 0 ? (
                <p className="text-xs text-muted">
                  Você ainda não tem medicamentos ativos cadastrados. Cadastre em Medicamentos para escolher aqui.
                </p>
              ) : (
                <div className="space-y-1">
                  {(meds ?? []).map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-1.5 hover:bg-surface"
                    >
                      <span className="min-w-0 truncate text-sm text-fg-soft">
                        {m.name}
                        {m.dosage ? <span className="text-muted"> · {m.dosage}</span> : null}
                      </span>
                      <input
                        type="checkbox"
                        checked={m.is_critical}
                        disabled={marcar.isPending}
                        onChange={(e) => void alternarCritico(m.id, e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-emerald-500"
                      />
                    </label>
                  ))}
                </div>
              )}
              {criticos.length === 0 && (meds ?? []).length > 0 ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Nenhum remédio marcado ainda — enquanto isso, ninguém é avisado.
                </p>
              ) : null}
            </div>

            {/* Quem será avisado e o que a pessoa vê */}
            <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
              <p className="text-xs font-semibold text-fg">Quem vai receber o aviso</p>
              {avisados.length === 0 ? (
                <p className="text-xs text-muted">
                  Ninguém, por enquanto. Só recebem os cuidadores com vínculo aceito e com a permissão de
                  medicamentos ligada nas permissões acima.
                </p>
              ) : (
                <ul className="space-y-0.5 text-xs text-fg-soft">
                  {avisados.map((c) => (
                    <li key={c.relationship.id}>· {c.other.full_name}</li>
                  ))}
                </ul>
              )}

              <p className="pt-1 text-xs font-semibold text-fg">O que a pessoa vai ver</p>
              <div className="rounded-lg border border-line bg-surface-2 p-2.5">
                <p className="text-xs font-semibold text-fg">Sem confirmação de dose</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  Não houve confirmação da dose de {criticos.length > 0 ? (criticos[0]?.name ?? 'Losartana') : 'Losartana'} às 08:00.
                  Pode ser só o registro que faltou — se puder, mande uma mensagem carinhosa.
                </p>
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                Só isso. A pessoa nunca vê &quot;você não tomou&quot;, não recebe histórico de faltas e não vê nenhum
                outro dado seu além do que você já autorizou nas permissões.
              </p>
            </div>

            {/* Revogação */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <p className="text-[11px] leading-relaxed text-muted">
                Você pode desligar quando quiser, sem justificar. Ao desligar, os avisos param na hora.
              </p>
              <button
                type="button"
                disabled={disable.isPending}
                onClick={() => void alternar(false)}
                className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-fg-soft transition hover:bg-surface disabled:opacity-50"
              >
                Desligar agora
              </button>
            </div>
          </>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted">
            Está desligado. Nada é enviado a ninguém enquanto você não ativar.
          </p>
        )}

        {/* Transparência do outro lado: eu, cuidador, vejo que o recurso está ativo */}
        {dependentesComGuardiao.length > 0 ? (
          <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3">
            <p className="text-xs font-semibold text-fg">Você é guardião de:</p>
            <ul className="mt-1 space-y-0.5 text-xs text-fg-soft">
              {dependentesComGuardiao.map((d) => (
                <li key={d.relationship.id}>· {d.other.full_name}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              Essas pessoas ativaram o Guardião de Dose e escolheram avisar você. Elas podem desligar a
              qualquer momento — se isso acontecer, os avisos simplesmente param.
            </p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
