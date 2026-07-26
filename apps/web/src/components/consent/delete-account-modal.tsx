'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { deleteAccountSchema } from '@hubpatients/core';
import { useDeleteAccount } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { Modal } from '@/components/ui/modal';

export function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const deletionRequest = useDeleteAccount();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pwId = useId();
  const confirmId = useId();

  async function onSubmit() {
    setError(null);
    const parsed = deleteAccountSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os campos.');
      return;
    }
    try {
      await deletionRequest.mutateAsync({ email: user?.email ?? '', password });
      await signOut();
      toast.success('Solicitação registrada. Sua sessão foi encerrada.');
      router.replace('/login');
    } catch {
      setError('Não foi possível confirmar sua identidade ou registrar a solicitação.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Solicitar exclusão da conta" className="max-w-md">
      <div className="-mt-1 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-alert-ink" />
        <p className="text-sm text-fg-soft">
          A solicitação será registrada com segurança e sua sessão será encerrada. Os dados não são
          apagados imediatamente: o processamento considera obrigações legais de guarda e será confirmado
          quando concluído.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor={pwId} className="mb-1 block text-sm text-fg-soft">
            Sua senha
          </label>
          <input
            id={pwId}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${pwId}-error` : undefined}
            className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg focus:border-rose-400/50 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor={confirmId} className="mb-1 block text-sm text-fg-soft">
            Digite <span className="font-mono font-bold text-rose-700 dark:text-rose-300">EXCLUIR</span> para confirmar
          </label>
          <input
            id={confirmId}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg focus:border-rose-400/50 focus:outline-none"
          />
        </div>
        {error && (
          <p id={`${pwId}-error`} role="alert" className="text-xs text-status-alert-ink">
            {error}
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2"
        >
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          disabled={deletionRequest.isPending}
          className="inline-flex h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {deletionRequest.isPending ? 'Solicitando…' : 'Enviar solicitação'}
        </button>
      </div>
    </Modal>
  );
}
