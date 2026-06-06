'use client';

import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useVidaLogClient } from '@vidalog/supabase';

/** 2FA (TOTP) via Supabase Auth MFA — enroll com QR, verificar e remover. */
export function TwoFactorSection() {
  const supabase = useVidaLogClient();
  const [enabled, setEnabled] = useState(false);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    setEnabled((data?.totp?.length ?? 0) > 0);
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function startEnroll() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setLoading(false);
    if (error || !data) {
      toast.error('Não foi possível iniciar o 2FA.');
      return;
    }
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code });
  }

  async function confirmEnroll() {
    if (!enrolling) return;
    setLoading(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (challenge.error || !challenge.data) {
      setLoading(false);
      toast.error('Falha ao gerar o desafio.');
      return;
    }
    const verify = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: challenge.data.id,
      code,
    });
    setLoading(false);
    if (verify.error) {
      toast.error('Código inválido.');
      return;
    }
    toast.success('2FA ativado!');
    setEnrolling(null);
    setCode('');
    refresh();
  }

  async function disable() {
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.[0];
    if (!factor) return;
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
    toast.success('2FA desativado.');
    refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <KeyRound className="h-4 w-4 text-primary" />
          <p className="text-sm text-fg">Verificação em duas etapas (2FA)</p>
          {enabled && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"><ShieldCheck className="h-3 w-3" /> Ativo</span>}
        </div>
        {enabled ? (
          <button onClick={disable} className="text-xs text-rose-300 hover:underline">Desativar</button>
        ) : !enrolling ? (
          <button onClick={startEnroll} disabled={loading} className="rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-sky-500/25">Ativar</button>
        ) : null}
      </div>

      {enrolling && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-4">
          <p className="mb-2 text-xs text-muted">Escaneie com seu app autenticador (Google Authenticator, Authy…):</p>
          {/* qr_code é um SVG (data URI ou markup) retornado pelo Supabase */}
          <div className="mx-auto w-fit rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: enrolling.qr }} />
          <div className="mt-3 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de 6 dígitos" inputMode="numeric" className="h-10 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg" />
            <button onClick={confirmEnroll} disabled={loading} className="rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white">Confirmar</button>
          </div>
        </div>
      )}
    </div>
  );
}
