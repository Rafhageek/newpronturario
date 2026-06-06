'use client';

import { useState } from 'react';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConsents, useSetConsent, useExportData } from '@vidalog/supabase';
import { CONSENT_SCOPES, DATA_CATEGORY_LABELS } from '@vidalog/core';
import { useAuth } from '@/components/auth-provider';
import { AccessLog } from '@/components/consent/access-log';
import { DeleteAccountModal } from '@/components/consent/delete-account-modal';

export default function ConsentimentoPage() {
  const { user } = useAuth();
  const patientId = user?.id ?? '';
  const { data: consents } = useConsents(user?.id);
  const setConsent = useSetConsent(patientId);
  const exportData = useExportData(patientId);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const granted = (purpose: string) => consents?.find((c) => c.purpose === purpose)?.granted ?? false;

  function toggle(purpose: (typeof CONSENT_SCOPES)[number]['purpose'], data: string[]) {
    const next = !granted(purpose);
    setConsent.mutate({ purpose, granted: next, scope: { data } });
  }

  async function handleExport() {
    try {
      const data = await exportData.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vidalog-meus-dados.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Seus dados foram exportados (JSON).');
    } catch {
      toast.error('Não foi possível exportar agora.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Consentimento</h1>
          <p className="mt-1 text-sm text-muted">
            Você controla quem vê seus dados. Cada permissão é granular e revogável a qualquer momento (LGPD).
          </p>
        </div>
      </header>

      {/* Escopos */}
      <div className="space-y-3">
        {CONSENT_SCOPES.map((scope) => {
          const on = granted(scope.purpose);
          return (
            <div key={scope.purpose} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">{scope.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{scope.description}</p>
                </div>
                <Toggle on={on} onChange={() => toggle(scope.purpose, scope.defaultData)} />
              </div>
              {on && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {scope.defaultData.map((d) => (
                    <span key={d} className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] text-primary">{DATA_CATEGORY_LABELS[d]}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Log de acessos */}
      <AccessLog patientId={patientId} />

      {/* Direitos LGPD */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={handleExport} disabled={exportData.isPending} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-primary/40 disabled:opacity-60">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-primary"><Download className="h-[18px] w-[18px]" /></span>
          <div>
            <p className="text-sm font-semibold text-fg">{exportData.isPending ? 'Exportando…' : 'Exportar meus dados'}</p>
            <p className="text-xs text-muted">JSON · LGPD Art. 18. E-mail/ZIP na Fase 4.</p>
          </div>
        </button>
        <button onClick={() => setDeleteOpen(true)} className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-left transition hover:border-rose-500/40">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300"><Trash2 className="h-[18px] w-[18px]" /></span>
          <div>
            <p className="text-sm font-semibold text-fg">Excluir minha conta</p>
            <p className="text-xs text-muted">Soft-delete com carência de 30 dias.</p>
          </div>
        </button>
      </div>

      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={onChange} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-white/15'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}
