'use client';

import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useHubPatientsClient } from '@hubpatients/supabase';

/** 2FA (TOTP) via Supabase Auth MFA — enroll com QR, verificar e remover. */
export function TwoFactorSection() {
  const supabase = useHubPatientsClient();
  const [enabled, setEnabled] = useState(false);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [password, setPassword] = useState('');

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    setEnabled((data?.totp?.length ?? 0) > 0);
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function logSecurity(event: string) {
    // Trilha de auditoria (RPC SECURITY DEFINER — grava só para o próprio usuário).
    try {
      await supabase.rpc('log_self_security_event', {
        p_resource_type: 'two_factor',
        p_metadata: { event },
      });
    } catch {
      // auditoria não deve bloquear o fluxo do usuário
    }
  }

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
    await logSecurity('enabled');
    toast.success('2FA ativado! Guarde o acesso ao seu app autenticador.');
    setEnrolling(null);
    setCode('');
    refresh();
  }

  /** Remove o 2FA — exige reautenticação por senha e trata o erro de verdade. */
  async function confirmDisable() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) {
        toast.error('Sessão inválida. Entre novamente.');
        return;
      }
      // Reautenticação: confirma a senha antes de remover a proteção.
      const reauth = await supabase.auth.signInWithPassword({ email, password });
      if (reauth.error) {
        toast.error('Senha incorreta.');
        return;
      }
      const { data } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp?.[0];
      if (!factor) {
        setEnabled(false);
        return;
      }
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) {
        toast.error('Não foi possível remover o 2FA. Tente novamente.');
        return;
      }
      await logSecurity('disabled');
      toast.success('2FA desativado.');
      setConfirmingDisable(false);
      setPassword('');
      refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <KeyRound className="h-4 w-4 text-primary" />
          <p className="text-sm text-fg">Verificação em duas etapas (2FA)</p>
          {enabled && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"><ShieldCheck className="h-3 w-3" /> Ativo</span>}
        </div>
        {enabled ? (
          <button onClick={() => setConfirmingDisable((v) => !v)} className="text-xs text-rose-700 dark:text-rose-300 hover:underline">Desativar</button>
        ) : !enrolling ? (
          <button onClick={startEnroll} disabled={loading} className="rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-sky-500/25 disabled:opacity-60">Ativar</button>
        ) : null}
      </div>

      {/* Confirmação de remoção com reautenticação */}
      {enabled && confirmingDisable && (
        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-4">
          <p className="mb-2 text-xs text-fg-soft">Para sua segurança, confirme sua senha para remover o 2FA.</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              autoComplete="current-password"
              className="h-10 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
            />
            <button onClick={confirmDisable} disabled={loading || !password} className="rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
              {loading ? 'Removendo…' : 'Remover'}
            </button>
          </div>
        </div>
      )}

      {enrolling && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-4">
          <p className="mb-2 text-xs text-muted">Escaneie com seu app autenticador (Google Authenticator, Authy…):</p>
          {/* qr_code do Supabase é uma data URI — renderizar como imagem (sem injeção de HTML). */}
          <img src={enrolling.qr} alt="QR code para configurar o 2FA" className="mx-auto h-44 w-44 rounded-lg bg-white p-2" />
          <p className="mt-2 text-[11px] text-muted">
            Guarde bem o acesso ao app autenticador — ele é necessário para entrar. Sem 2FA por SMS.
          </p>
          <div className="mt-3 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de 6 dígitos" inputMode="numeric" className="h-10 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg" />
            <button onClick={confirmEnroll} disabled={loading} className="rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white disabled:opacity-60">Confirmar</button>
          </div>
        </div>
      )}
    </div>
  );
}
