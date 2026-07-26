'use client';

import { useState } from 'react';
import { Gift, Sparkles, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { useHasPlusAccess, useRedeemVoucher } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';

/** Campo "Tenho um código" — resgata voucher e ativa o Plus. */
export function VoucherRedeem() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: hasPlus } = useHasPlusAccess(user?.id);
  const redeem = useRedeemVoucher(userId);
  const [code, setCode] = useState('');

  async function submit() {
    const c = code.trim();
    if (!c) return;
    try {
      const expires = await redeem.mutateAsync(c);
      const until = new Date(expires).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      toast.success(`Plus ativado! Aproveite até ${until}. ✨`);
      setCode('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível resgatar o código.';
      toast.error(msg.replace(/^.*:\s*/, ''));
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-status-attention-ink">
          <Ticket className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-fg">Tenho um código</h3>
          <p className="text-xs text-muted">Cortesia, convite ou voucher de campanha.</p>
        </div>
      </div>

      {hasPlus ? (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <Sparkles className="h-4 w-4" /> Você tem o HubPatients Plus ativo.
        </p>
      ) : (
        <div className="mt-4 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex.: VIDA-AMIGOS"
            aria-label="Código de cortesia"
            className="h-11 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium tracking-wide text-fg placeholder:text-faint focus:border-sky-400/50 focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={redeem.isPending || !code.trim()}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Gift className="h-4 w-4" /> {redeem.isPending ? 'Resgatando…' : 'Resgatar'}
          </button>
        </div>
      )}
    </div>
  );
}
