'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { loginSchema, getSafeNextPath, type LoginInput } from '@hubpatients/core';
import { useHubPatientsClient } from '@hubpatients/supabase';
import { GoogleIcon, AppleButton, SocialButton } from '@/components/auth-social';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-[620px] animate-pulse rounded-2xl bg-neutral-100" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const supabase = useHubPatientsClient();
  const router = useRouter();
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Surfaces erros vindos do callback de OAuth (?error=oauth).
  useEffect(() => {
    if (params.get('error') === 'oauth') {
      toast.error('Não foi possível concluir o login social. Tente novamente.');
    }
    if (params.get('reset') === 'success') {
      toast.success('Senha atualizada. Entre novamente com sua nova senha.');
    }
  }, [params]);

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      toast.error('E-mail ou senha incorretos.');
      return;
    }
    toast.success('Bem-vindo de volta!');
    router.replace(getSafeNextPath(params.get('next')));
    router.refresh();
  }

  async function signInWithProvider(provider: 'google' | 'apple', label: string) {
    const next = getSafeNextPath(params.get('next'));
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) toast.error(`Não foi possível conectar com o ${label}. Tente novamente.`);
  }
  const signInWithGoogle = () => signInWithProvider('google', 'Google');

  return (
    <div className="vl-rise">
      <div className="mb-7 text-center">
        <div className="mb-6 flex justify-center lg:hidden">
          <img
            src="/wordmark.png"
            alt="Hub Pacients"
            className="h-14 w-auto object-contain"
          />
        </div>
        <h1
          className="text-[1.85rem] font-bold tracking-[-0.035em] text-neutral-950 sm:text-[2.1rem]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Bem-vindo de volta
        </h1>
        <p className="mt-2 text-[15px] text-neutral-500">
          Acesse seu prontuário com segurança.
        </p>
      </div>

      <div className="space-y-2.5">
        <SocialButton icon={<GoogleIcon />} label="Continuar com Google" onClick={signInWithGoogle} />
        <AppleButton onClick={() => toast.info('Login com Apple chega em breve — estamos implementando! 🍎')} />
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">ou</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-500" aria-hidden />
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-required="true"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              placeholder="você@email.com"
              className="h-[54px] w-full rounded-xl border border-neutral-300 bg-white pl-12 pr-4 text-[15px] text-neutral-950 outline-none transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-primary focus:ring-4 focus:ring-trust-100"
              {...register('email')}
            />
          </div>
        </Field>

        <Field
          label="Senha"
          htmlFor="password"
          error={errors.password?.message}
          aside={
            <Link
              href="/auth/recuperar-senha"
              className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Esqueceu a senha?
            </Link>
          }
        >
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-500" aria-hidden />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              placeholder="••••••••"
              className="h-[54px] w-full rounded-xl border border-neutral-300 bg-white pl-12 pr-14 text-[15px] text-neutral-950 outline-none transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-primary focus:ring-4 focus:ring-trust-100"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              aria-label={showPassword ? 'Ocultar caracteres digitados' : 'Exibir caracteres digitados'}
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </Field>

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting || undefined}
          className="h-[54px] w-full rounded-xl bg-primary text-[15px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(4,66,191,0.75)] transition hover:bg-trust-700 hover:shadow-[0_10px_24px_-8px_rgba(4,66,191,0.8)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Entrando…
            </span>
          ) : (
            'Entrar'
          )}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-neutral-500">
        <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden />
        Acesso protegido · Privacidade conforme a LGPD
      </div>

      <p className="mt-5 text-center text-sm text-neutral-500">
        Não tem conta?{' '}
        <Link href="/cadastro" className="font-semibold text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  aside,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-neutral-700">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-semaphore-alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
