'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { deleteAccountSchema } from '@vidalog/core';
import { useDeleteAccount } from '@vidalog/supabase';
import { useAuth } from '@/components/auth-provider';

export function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const del = useDeleteAccount();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  async function onSubmit() {
    const parsed = deleteAccountSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Confira os campos.');
      return;
    }
    try {
      await del.mutateAsync({ email: user?.email ?? '', password });
      toast.success('Conta marcada para exclusão. Você tem 30 dias para reverter entrando de novo.');
      router.replace('/login');
    } catch {
      toast.error('Senha incorreta ou falha ao excluir.');
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" className="relative w-full max-w-md overflow-hidden rounded-2xl border border-rose-500/30 bg-surface p-6 shadow-2xl"
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }}>
            <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar"><X className="h-4 w-4" /></button>
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              <h2 className="text-lg font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Excluir minha conta</h2>
            </div>
            <p className="mt-2 text-sm text-muted">
              Sua conta será desativada e excluída em <span className="font-semibold text-fg">30 dias</span>. Você pode reverter entrando novamente nesse período.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-fg-soft">Sua senha</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg focus:border-rose-400/50 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-fg-soft">Digite <span className="font-mono font-bold text-rose-300">EXCLUIR</span> para confirmar</label>
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg focus:border-rose-400/50 focus:outline-none" />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">Cancelar</button>
              <button onClick={onSubmit} disabled={del.isPending} className="inline-flex h-11 items-center rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60">
                {del.isPending ? 'Excluindo…' : 'Excluir conta'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
