'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BadgeCheck, Clock, ShieldAlert, Stethoscope, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useHubPatientsClient, useMyVerification, useSubmitProfessionalVerification } from '@hubpatients/supabase';
import type { Json } from '@hubpatients/core';
import { PROFESSIONAL_DISCLAIMER } from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const STATUS_META: Record<string, { label: string; tone: string; icon: typeof Clock; hint: string }> = {
  pending: {
    label: 'Em análise',
    tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    icon: Clock,
    hint: 'Recebemos seu pedido. Um administrador vai revisar seus dados em breve.',
  },
  approved: {
    label: 'Selo ativo',
    tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    icon: BadgeCheck,
    hint: 'Seu selo de médico está ativo no fórum. Revalidamos seu registro a cada 90 dias.',
  },
  rejected: {
    label: 'Não aprovado',
    tone: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    icon: ShieldAlert,
    hint: 'Não foi possível confirmar seu registro. Confira os dados e envie novamente.',
  },
  expired: {
    label: 'Expirado',
    tone: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    icon: ShieldAlert,
    hint: 'A revalidação venceu. Reenvie seus dados para reativar o selo.',
  },
};

export default function VerificacaoProfissionalPage() {
  const { user } = useAuth();
  const supabase = useHubPatientsClient();
  const userId = user?.id ?? '';
  const { data: verification, isLoading } = useMyVerification(user?.id);
  const submit = useSubmitProfessionalVerification(userId);

  const [number, setNumber] = useState('');
  const [uf, setUf] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const canResubmit =
    !verification || verification.status === 'rejected' || verification.status === 'expired';
  const status = verification ? STATUS_META[verification.status] : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!/^\d{4,6}$/.test(number.trim())) {
      toast.error('Informe o número do CRM (4 a 6 dígitos).');
      return;
    }
    if (!uf) {
      toast.error('Selecione o estado (UF) do registro.');
      return;
    }
    if (!file) {
      toast.error('Anexe um documento que comprove seu registro.');
      return;
    }
    setBusy(true);
    try {
      // 1) upload do documento no bucket privado (pasta = user id, exigida pela RLS)
      const ext = file.name.split('.').pop() ?? 'pdf';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('professional-docs')
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      // 2) consulta informativa ao verify-crm (não concede selo; vira auditoria)
      let verifyResponse: Json | null = null;
      const crm = `${number.trim()}-${uf}`;
      const { data: vData } = await supabase.functions.invoke('verify-crm', { body: { crm } });
      verifyResponse = (vData as Json) ?? null;

      // 3) cria o pedido 'pending' — aprovação é do admin
      await submit.mutateAsync({
        registryNumber: number.trim(),
        registryState: uf,
        documentPath: path,
        verifyResponse,
      });

      setNumber('');
      setUf('');
      setFile(null);
      toast.success('Pedido enviado! Avisaremos quando for revisado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/configuracoes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Configurações
      </Link>

      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-status-ok-ink">
          <Stethoscope className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Verificação profissional
          </h1>
          <p className="text-sm text-muted">
            Médicos com registro verificado ganham um selo de credibilidade no fórum.
          </p>
        </div>
      </header>

      {/* Aviso ético */}
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-3">
        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-ok-ink" />
        <p className="text-xs leading-relaxed text-fg-soft">{PROFESSIONAL_DISCLAIMER}</p>
      </div>

      {/* Status atual */}
      {isLoading ? (
        <div className="h-20 animate-pulse rounded-2xl bg-surface-2" />
      ) : status ? (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
              <status.icon className="h-3.5 w-3.5" /> {status.label}
            </span>
            {verification?.registry_number && (
              <span className="text-xs text-muted">
                CRM {verification.registry_number}-{verification.registry_state}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-fg-soft">{status.hint}</p>
        </div>
      ) : null}

      {/* Formulário */}
      {canResubmit && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="crm" className="mb-1 block text-xs font-medium text-muted">
                Número do CRM
              </label>
              <input
                id="crm"
                inputMode="numeric"
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="12345"
                className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-emerald-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="uf" className="mb-1 block text-xs font-medium text-muted">
                UF
              </label>
              <select
                id="uf"
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface-2 px-2 text-sm text-fg focus:border-emerald-400/50 focus:outline-none"
              >
                <option value="">—</option>
                {UFS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="doc" className="mb-1 block text-xs font-medium text-muted">
              Documento comprobatório (PDF ou imagem)
            </label>
            <label
              htmlFor="doc"
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line bg-surface-2 px-3 py-2.5 text-sm text-muted hover:border-emerald-400/40"
            >
              <Upload className="h-4 w-4" />
              {file ? <span className="truncate text-fg">{file.name}</span> : 'Selecionar arquivo…'}
            </label>
            <input
              id="doc"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <p className="mt-1 text-[11px] text-faint">
              Guardado em armazenamento privado, visível só para você e a moderação.
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Enviando…' : 'Enviar para verificação'}
          </button>
        </form>
      )}
    </div>
  );
}
