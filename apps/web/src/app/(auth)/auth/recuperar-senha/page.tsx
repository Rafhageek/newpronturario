'use client';

import { Suspense, type FormEvent, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { emailSchema } from '@hubpatients/core';
import { useHubPatientsClient } from '@hubpatients/supabase';

function RecoverPasswordContent() {
  const supabase = useHubPatientsClient();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(
    params.get('error') === 'invalid_link'
      ? 'Este link expirou ou já foi utilizado. Solicite um novo link.'
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Informe um e-mail válido.');
      return;
    }

    setSubmitting(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/redefinir-senha')}`;
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo,
    });
    setSubmitting(false);

    if (requestError) {
      setError('Não foi possível enviar o link agora. Verifique sua conexão e tente novamente.');
      return;
    }

    // A mesma resposta é exibida para contas existentes e inexistentes.
    setSent(true);
  }

  return (
    <div className="vl-rise">
      <Link
        href="/login"
        className="mb-6 inline-flex items-center gap-1.5 rounded text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para o login
      </Link>

      {sent ? (
        <section aria-labelledby="recovery-sent-title" role="status" aria-live="polite">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1
            id="recovery-sent-title"
            className="text-3xl font-bold tracking-tight text-neutral-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Confira seu e-mail
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Se existir uma conta para <strong>{email.trim()}</strong>, enviaremos um link seguro para
            criar uma nova senha. O link tem validade limitada.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-6 h-12 w-full rounded-xl border border-line-strong text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Enviar para outro e-mail
          </button>
        </section>
      ) : (
        <>
          <div className="mb-7">
            <h1
              className="text-3xl font-bold tracking-tight text-neutral-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Recuperar acesso
            </h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Informe o e-mail da sua conta. Enviaremos um link de uso único para redefinir a senha.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="recovery-email" className="block text-sm font-medium text-neutral-700">
                E-mail
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
                  aria-hidden="true"
                />
                <input
                  id="recovery-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  autoFocus
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'recovery-error' : 'recovery-help'}
                  className="h-12 w-full rounded-xl border border-line-strong pl-10 pr-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-500 focus:border-primary focus:ring-4 focus:ring-trust-100"
                  placeholder="voce@email.com"
                />
              </div>
              <p id="recovery-help" className="text-xs leading-5 text-neutral-500">
                Por segurança, não informamos se o e-mail possui uma conta.
              </p>
              {error ? (
                <p id="recovery-error" className="text-xs text-semaphore-alert" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white shadow-sm transition hover:bg-trust-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Enviando…
                </span>
              ) : (
                'Enviar link seguro'
              )}
            </button>
          </form>
        </>
      )}

      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
        Link temporário e conexão criptografada
      </div>
    </div>
  );
}

export default function RecoverPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-48 items-center justify-center" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Preparando recuperação de acesso</span>
        </div>
      }
    >
      <RecoverPasswordContent />
    </Suspense>
  );
}
