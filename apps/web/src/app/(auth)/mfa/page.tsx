'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { useHubPatientsClient } from '@hubpatients/supabase';
import { Spinner } from '@/components/ui/spinner';

function safeNext(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

function MfaChallengeContent() {
  const supabase = useHubPatientsClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (!active) return;
      const verified = data?.totp.find((factor) => factor.status === 'verified');
      setFactorId(verified?.id ?? null);
      setError(
        listError || !verified
          ? 'Não foi possível localizar um autenticador verificado. Entre novamente.'
          : null,
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError('Digite o código de 6 dígitos do seu aplicativo autenticador.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    setSubmitting(false);

    if (verifyError) {
      setError('Código inválido ou expirado. Gere um novo código e tente novamente.');
      return;
    }

    router.replace(safeNext(searchParams.get('next')));
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <section
        aria-labelledby="mfa-title"
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm"
      >
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-trust-50 text-primary">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </span>
        <h1 id="mfa-title" className="text-balance text-2xl font-bold text-fg">
          Confirme que é você
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Abra seu aplicativo autenticador e digite o código atual para acessar seus dados de
          saúde.
        </p>

        {loading ? (
          <div className="flex min-h-32 items-center justify-center" role="status">
            <Spinner className="h-6 w-6" />
            <span className="sr-only">Carregando segundo fator</span>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="mfa-code" className="text-sm font-medium text-fg">
                Código de 6 dígitos
              </label>
              <input
                id="mfa-code"
                name="mfa-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                spellCheck={false}
                required
                autoFocus
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'mfa-error' : 'mfa-help'}
                className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-4 text-center text-xl tracking-[0.35em] text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <p id="mfa-help" className="mt-2 text-xs text-muted">
                O código muda a cada poucos segundos.
              </p>
            </div>

            {error ? (
              <p id="mfa-error" role="alert" className="text-sm text-rose-700 dark:text-rose-300">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !factorId}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? 'Verificando…' : 'Continuar com segurança'}
            </button>
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="h-11 w-full rounded-xl border border-line text-sm font-medium text-fg-soft hover:bg-surface-2"
            >
              Sair e usar outra conta
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-screen items-center justify-center bg-bg px-4 py-10"
          role="status"
        >
          <Spinner className="h-6 w-6" />
          <span className="sr-only">Preparando verificação em duas etapas</span>
        </main>
      }
    >
      <MfaChallengeContent />
    </Suspense>
  );
}
