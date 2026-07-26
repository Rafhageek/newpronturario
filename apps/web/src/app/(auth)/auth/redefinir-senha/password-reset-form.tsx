'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { passwordSchema } from '@hubpatients/core';
import { useHubPatientsClient } from '@hubpatients/supabase';

export function PasswordResetForm() {
  const supabase = useHubPatientsClient();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Escolha uma senha mais segura.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não conferem.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data });
    if (updateError) {
      setSubmitting(false);
      setError('Não foi possível atualizar a senha. Solicite um novo link e tente novamente.');
      return;
    }

    await supabase.auth.signOut({ scope: 'local' });
    router.replace('/login?reset=success');
    router.refresh();
  }

  return (
    <div className="vl-rise">
      <div className="mb-7">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-trust-50 text-primary">
          <LockKeyhole className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1
          className="text-3xl font-bold tracking-tight text-neutral-900"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Crie uma nova senha
        </h1>
        <p id="password-rules" className="mt-2 text-sm leading-6 text-neutral-500">
          Use pelo menos 8 caracteres, com uma letra e um número.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <PasswordField
          id="new-password"
          label="Nova senha"
          value={password}
          onChange={setPassword}
          show={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
          autoComplete="new-password"
          describedBy={error ? 'reset-error password-rules' : 'password-rules'}
          invalid={Boolean(error)}
        />
        <PasswordField
          id="confirm-password"
          label="Confirmar nova senha"
          value={confirmation}
          onChange={setConfirmation}
          show={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
          autoComplete="new-password"
          describedBy={error ? 'reset-error' : undefined}
          invalid={Boolean(error)}
        />

        {error ? (
          <p id="reset-error" className="text-xs text-semaphore-alert" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white shadow-sm transition hover:bg-trust-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Atualizando…
            </span>
          ) : (
            'Atualizar senha'
          )}
        </button>
      </form>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  describedBy,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: 'new-password';
  describedBy?: string;
  invalid: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="h-12 w-full rounded-xl border border-line-strong px-3 pr-11 text-sm text-neutral-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-trust-100"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          aria-label={show ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        >
          {show ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
