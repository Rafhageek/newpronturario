'use client';

import { useState } from 'react';
import { Download, Info, Scale, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConsents, useSetConsent, useExportData } from '@hubpatients/supabase';
import {
  CONSENT_TEXT_VERSION,
  DATA_CATEGORY_LABELS,
  NO_DATA_FOR_BENEFIT_NOTICE,
  SECTOR_CONSENT_NOTICE,
  SECTOR_LABELS,
  SECTOR_ORDER,
  SHARING_MODE_LABELS,
  scopesBySector,
  type ConsentScope,
} from '@hubpatients/core';
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

  function toggle(scope: ConsentScope) {
    const next = !granted(scope.purpose);
    // `version` guarda QUAL texto a pessoa leu ao decidir — é a prova de
    // consentimento exigida pelo art. 8º, §1º (o RPC também grava no audit_log).
    setConsent.mutate({
      purpose: scope.purpose,
      granted: next,
      scope: { data: scope.defaultData, sharing: scope.sharing, legalBasis: scope.legalBasis },
      version: CONSENT_TEXT_VERSION,
    });
  }

  async function handleExport() {
    try {
      const data = await exportData.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hubpatients-meus-dados.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Seus dados foram exportados (JSON).');
    } catch {
      toast.error('Não foi possível exportar agora.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 hp-page hp-page--privacy">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-status-ok-ink">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Consentimento</h1>
          <p className="mt-1 text-sm text-muted">
            Você controla quem vê seus dados. Cada permissão é granular e revogável a qualquer momento (LGPD).
          </p>
        </div>
      </header>

      {/* Nada é enviado automaticamente — dizer isso é obrigação de
          transparência, e prometer compartilhamento inexistente seria informação
          falsa ao titular (LGPD art. 9º). */}
      <p
        role="note"
        className="flex items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3 text-xs leading-relaxed text-fg-soft"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        {SECTOR_CONSENT_NOTICE}
      </p>

      {/* Escopos agrupados por setor */}
      <div className="space-y-6">
        {SECTOR_ORDER.map((sector) => {
          const scopes = scopesBySector(sector);
          if (scopes.length === 0) return null;
          return (
            <section key={sector} aria-labelledby={`setor-${sector}`} className="space-y-3">
              <h2 id={`setor-${sector}`} className="text-sm font-semibold text-fg-soft">
                {SECTOR_LABELS[sector]}
              </h2>
              {scopes.map((scope) => {
                const on = granted(scope.purpose);
                return (
                  <div key={scope.purpose} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-fg">{scope.label}</p>
                        <p className="mt-0.5 text-xs text-muted">{scope.description}</p>
                      </div>
                      <Toggle label={scope.label} on={on} onChange={() => toggle(scope)} />
                    </div>

                    {/* O que sai daqui — visível SEMPRE, não só quando ligado:
                        a pessoa precisa saber antes de decidir, não depois. */}
                    <p className="mt-2.5 text-[11px] text-muted">{SHARING_MODE_LABELS[scope.sharing]}</p>

                    {scope.limit && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-fg-soft">{scope.limit}</p>
                    )}

                    {on && scope.defaultData.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {scope.defaultData.map((d) => (
                          <span
                            key={d}
                            className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] text-primary"
                          >
                            {DATA_CATEGORY_LABELS[d]}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="mt-2 text-[10px] text-hint">{scope.legalBasis}</p>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      {/* Por que não existe "dados em troca de desconto" — é expectativa
          razoável de quem lê a tela, e merece resposta em vez de silêncio. */}
      <p
        role="note"
        className="flex items-start gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-fg-soft"
      >
        <Scale className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        {NO_DATA_FOR_BENEFIT_NOTICE}
      </p>

      {/* Log de acessos */}
      <AccessLog patientId={patientId} />

      {/* Direitos LGPD */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={handleExport} disabled={exportData.isPending} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-primary/40 disabled:opacity-60">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-primary"><Download className="h-[18px] w-[18px]" /></span>
          <div>
            <p className="text-sm font-semibold text-fg">{exportData.isPending ? 'Exportando…' : 'Exportar meus dados'}</p>
            <p className="text-xs text-muted">JSON completo, paginado e com manifesto de integridade.</p>
          </div>
        </button>
        <button onClick={() => setDeleteOpen(true)} className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] p-4 text-left transition hover:border-rose-500/40">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300"><Trash2 className="h-[18px] w-[18px]" /></span>
          <div>
            <p className="text-sm font-semibold text-fg">Excluir minha conta</p>
            <p className="text-xs text-muted">Solicitação auditável, processada conforme retenção legal.</p>
          </div>
        </button>
      </div>

      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={on}
      onClick={onChange}
      className="relative h-11 w-12 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <span
        aria-hidden
        className={`absolute left-0.5 top-2.5 h-6 w-11 rounded-full transition-colors duration-150 ${on ? 'bg-emerald-500' : 'bg-line'}`}
      />
      <span
        aria-hidden
        className={`absolute top-3 h-5 w-5 rounded-full bg-white shadow-sm transition-[left] duration-150 ${on ? 'left-[25px]' : 'left-1'}`}
      />
    </button>
  );
}
