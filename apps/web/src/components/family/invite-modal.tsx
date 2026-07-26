'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  CARE_KIND_LABELS,
  DEFAULT_CAREGIVER_PERMISSIONS,
  inviteSchema,
  type CaregiverInviteRole,
  type CaregiverPermissions,
  type CareRelationshipKind,
} from '@hubpatients/core';
import { useFamilyMutations } from '@hubpatients/supabase';
import { Field, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { PermissionsEditor } from './permissions-editor';

export function InviteModal({
  open,
  onClose,
  userId,
  inviterName,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  inviterName: string;
}) {
  const { invite } = useFamilyMutations(userId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CaregiverInviteRole>('i_am_caregiver');
  const [kind, setKind] = useState<CareRelationshipKind>('family');
  const [permissions, setPermissions] = useState<CaregiverPermissions>(DEFAULT_CAREGIVER_PERMISSIONS);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit() {
    const parsed = inviteSchema.safeParse({ email, role, kind, permissions });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Verifique os dados.');
      return;
    }
    try {
      const created = await invite.mutateAsync({ inviterName, email, role, kind, permissions });
      const url = `${window.location.origin}/familia/aceitar?token=${created.token}`;
      setLink(url);
      toast.success('Convite criado! Copie o link e envie.');
    } catch {
      toast.error('Não foi possível criar o convite.');
    }
  }

  function reset() {
    setEmail(''); setRole('i_am_caregiver'); setKind('family');
    setPermissions(DEFAULT_CAREGIVER_PERMISSIONS); setLink(null); setCopied(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Convidar para a família" className="max-w-lg">
      {(
        <>
            {link ? (
              <div className="space-y-3">
                <p className="text-sm text-fg-soft">Convite criado para <span className="font-semibold text-fg">{email}</span>. Envie este link (válido por 48h):</p>
                <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-2">
                  <input readOnly value={link} className="flex-1 bg-transparent px-2 text-xs text-fg-soft outline-none" />
                  <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-primary">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className="text-[11px] text-muted">Envio automático por e-mail entra na Fase 4.</p>
                <button onClick={handleClose} className="mt-1 h-11 w-full rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-sm font-semibold text-white">Concluir</button>
              </div>
            ) : (
              <div className="space-y-4">
                <Field label="E-mail da pessoa" htmlFor="inv-email"><Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@email.com" /></Field>

                <div>
                  <p className="mb-1.5 text-sm font-medium text-fg-soft">Qual o vínculo?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setRole('i_am_caregiver')} className={`rounded-xl border px-3 py-2.5 text-xs font-medium ${role === 'i_am_caregiver' ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted'}`}>Eu vou cuidar dessa pessoa</button>
                    <button onClick={() => setRole('i_am_patient')} className={`rounded-xl border px-3 py-2.5 text-xs font-medium ${role === 'i_am_patient' ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted'}`}>Essa pessoa vai me cuidar</button>
                  </div>
                </div>

                <Field label="Relação" htmlFor="inv-kind">
                  <select id="inv-kind" value={kind} onChange={(e) => setKind(e.target.value as CareRelationshipKind)} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
                    {Object.entries(CARE_KIND_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </Field>

                <div>
                  <p className="mb-2 text-sm font-medium text-fg-soft">Permissões {role === 'i_am_caregiver' ? 'que terei' : 'que concedo'}</p>
                  <PermissionsEditor value={permissions} onChange={setPermissions} />
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={handleClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">Cancelar</button>
                  <button onClick={onSubmit} disabled={invite.isPending} className="inline-flex h-11 items-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-white disabled:opacity-60">{invite.isPending ? 'Criando…' : 'Criar convite'}</button>
                </div>
              </div>
            )}
        </>
      )}
    </Modal>
  );
}
