'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { HeartHandshake } from 'lucide-react';
import { toast } from 'sonner';
import { useFamilyMutations } from '@vidalog/supabase';
import { useAuth } from '@/components/auth-provider';

export default function AceitarConvitePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md text-center text-sm text-muted">Carregando…</div>}>
      <AceitarConvite />
    </Suspense>
  );
}

function AceitarConvite() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const { accept } = useFamilyMutations(user?.id ?? '');
  const [done, setDone] = useState(false);

  async function handleAccept() {
    try {
      await accept.mutateAsync(token);
      setDone(true);
      toast.success('Convite aceito!');
      setTimeout(() => router.replace('/familia'), 1200);
    } catch {
      toast.error('Convite inválido, expirado ou não é para a sua conta.');
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/15 text-primary"><HeartHandshake className="h-7 w-7" /></span>
      <h1 className="mt-5 text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Convite de cuidado</h1>
      {!token ? (
        <p className="mt-3 text-sm text-muted">Link de convite inválido.</p>
      ) : done ? (
        <p className="mt-3 text-sm text-emerald-300">Vínculo criado! Redirecionando…</p>
      ) : (
        <>
          <p className="mt-3 max-w-sm text-sm text-muted">Ao aceitar, será criado um vínculo de cuidado conforme as permissões definidas por quem te convidou.</p>
          <button onClick={handleAccept} disabled={accept.isPending} className="mt-6 inline-flex h-11 items-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-6 text-sm font-semibold text-white disabled:opacity-60">
            {accept.isPending ? 'Aceitando…' : 'Aceitar convite'}
          </button>
          <Link href="/familia" className="mt-3 text-xs text-muted hover:underline">Agora não</Link>
        </>
      )}
    </div>
  );
}
