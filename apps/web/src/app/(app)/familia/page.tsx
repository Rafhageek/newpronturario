'use client';

import { useState } from 'react';
import { HeartHandshake, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProfile, useRelationships, useSentInvites, useInvitesForMe, useFamilyMutations,
} from '@vidalog/supabase';
import { CARE_KIND_LABELS, type CaregiverPermissions } from '@vidalog/core';
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
          {!isPlus && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">PLUS</span>}
        </button>
      </header>

      {/* Convites para mim */}
      {(forMe ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-300">Convites para você</h2>
          {(forMe ?? []).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
              <div className="flex min-w-0 items-center gap-3">
                <Mail className="h-5 w-5 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-amber-100">
                    <span className="font-semibold">{inv.inviter_name ?? 'Alguém'}</span> convidou você ({CARE_KIND_LABELS[inv.kind]}).
                  </p>
                  <p className="text-xs text-muted">{inv.role === 'i_am_caregiver' ? 'Para cuidar de você' : 'Para você cuidar'}</p>
                </div>
              </div>
              <button onClick={() => handleAccept(inv.token)} className="shrink-0 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25">Aceitar</button>
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

      {/* Convites enviados */}
      {(sent ?? []).length > 0 && (
        <Section icon={Mail} title={`Convites enviados (${(sent ?? []).length})`}>
          {(sent ?? []).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm">
              <span className="text-fg-soft">{inv.invitee_email}</span>
              <span className="text-xs text-amber-300">pendente</span>
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
