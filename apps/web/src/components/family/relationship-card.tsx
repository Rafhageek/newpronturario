'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, HeartHandshake, ShieldCheck, UserMinus } from 'lucide-react';
import type { RelationshipView } from '@vidalog/supabase';
import { CARE_KIND_LABELS, DEFAULT_CAREGIVER_PERMISSIONS, type CaregiverPermissions } from '@vidalog/core';
import { PermissionsEditor } from './permissions-editor';

export function RelationshipCard({
  view,
  onRevoke,
  onUpdatePermissions,
}: {
  view: RelationshipView;
  onRevoke: () => void;
  onUpdatePermissions: (p: CaregiverPermissions) => void;
}) {
  const [open, setOpen] = useState(false);
  const iCareForThem = view.direction === 'i_care_for';
  const perms = { ...DEFAULT_CAREGIVER_PERMISSIONS, ...(view.relationship.permissions as Partial<CaregiverPermissions>) };
  const pending = view.relationship.status === 'pending';
  // Só o paciente (quem é cuidado) controla as permissões dos seus cuidadores.
  const canEdit = !iCareForThem;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-400 text-sm font-bold text-white">
            {view.other.full_name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{view.other.full_name}</p>
            <p className="text-xs text-muted">
              {iCareForThem ? 'Você cuida' : 'Cuida de você'} · {CARE_KIND_LABELS[view.relationship.kind]}
              {pending && <span className="ml-1.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-300">pendente</span>}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-emerald-300">
          {iCareForThem ? <HeartHandshake className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
          Permissões <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={onRevoke} className="ml-auto inline-flex items-center gap-1.5 text-xs text-rose-300 hover:underline">
          <UserMinus className="h-3.5 w-3.5" /> Remover vínculo
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 border-t border-line pt-3">
              <PermissionsEditor value={perms} onChange={canEdit ? onUpdatePermissions : undefined} readOnly={!canEdit} />
              {!canEdit && <p className="mt-2 text-[11px] text-muted">As permissões são definidas pela pessoa cuidada.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
