'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Gift, ShieldX, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { useCommunityMember, useVouchers, useCreateVoucher } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminVouchersPage() {
  const { user } = useAuth();
  const { data: me, isLoading: loadingMe } = useCommunityMember(user?.id);
  const isAdmin = me?.staff_role === 'admin';

  const { data: vouchers, isLoading } = useVouchers();
  const create = useCreateVoucher();

  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'plus_trial' | 'plus_full'>('plus_trial');
  const [durationDays, setDurationDays] = useState(90);
  const [maxUses, setMaxUses] = useState(1);

  if (loadingMe) {
    return <div className="mx-auto max-w-3xl"><div className="h-40 animate-pulse rounded-2xl bg-surface-2" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShieldX className="mx-auto h-10 w-10 text-status-alert-ink" />
        <h1 className="mt-3 text-lg font-bold text-fg">Acesso restrito</h1>
        <p className="mt-1 text-sm text-muted">Esta área é exclusiva de administradores.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar</Link>
      </div>
    );
  }

  async function submit() {
    if (!code.trim()) return;
    try {
      await create.mutateAsync({ code: code.trim(), kind, durationDays, maxUses });
      toast.success('Voucher criado.');
      setCode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/^.*:\s*/, '') : 'Falha ao criar voucher.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 hp-page">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-status-attention-ink">
          <Ticket className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Vouchers</h1>
          <p className="text-sm text-muted">Cortesia do Plus para familiares, amigos e investidores.</p>
        </div>
      </header>

      {/* Criar */}
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-fg">Gerar voucher</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted">
            Código
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VIDA-AMIGOS" className="mt-1 h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium tracking-wide text-fg" />
          </label>
          <label className="text-xs font-medium text-muted">
            Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value as 'plus_trial' | 'plus_full')} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface-2 px-2 text-sm text-fg">
              <option value="plus_trial">Plus — trial</option>
              <option value="plus_full">Plus — completo</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Duração (dias)
            <input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg" />
          </label>
          <label className="text-xs font-medium text-muted">
            Máximo de usos
            <input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg" />
          </label>
        </div>
        <button onClick={submit} disabled={create.isPending || !code.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 text-sm font-semibold text-white disabled:opacity-60">
          <Gift className="h-4 w-4" /> {create.isPending ? 'Gerando…' : 'Gerar voucher'}
        </button>
      </section>

      {/* Lista */}
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : !vouchers || vouchers.length === 0 ? (
        <EmptyState icon={Ticket} title="Nenhum voucher ainda" description="Gere o primeiro código acima." />
      ) : (
        <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface">
          {vouchers.map((v) => {
            const expired = v.expires_at && new Date(v.expires_at) < new Date();
            const exhausted = v.uses_count >= v.max_uses;
            return (
              <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <span className="font-mono tracking-wide">{v.code}</span>
                    <Badge tone={v.kind === 'plus_full' ? 'primary' : 'info'}>{v.kind === 'plus_full' ? 'completo' : 'trial'}</Badge>
                    {!v.active && <Badge tone="neutral">inativo</Badge>}
                    {expired && <Badge tone="danger">expirado</Badge>}
                    {exhausted && <Badge tone="warning">esgotado</Badge>}
                  </p>
                  <p className="text-xs text-muted">{v.duration_days} dias · {v.uses_count}/{v.max_uses} usos</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
