'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { loginSchema, type LoginInput } from '@vidalog/core';
import { useVidaLogClient } from '@vidalog/supabase';
import { GoogleIcon, GovBrButton, SocialButton } from '@/components/auth-social';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-neutral-100" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const supabase = useVidaLogClient();
  const router = useRouter();
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

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
    router.replace(params.get('next') ?? '/dashboard');
    router.refresh();
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) toast.info('Login com Google ainda não está configurado neste ambiente.');
  }

  return (
    <div className="vl-rise">
      <div className="mb-7">
        <h1
          className="text-3xl font-bold tracking-tight text-neutral-900"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Bem-vindo de volta
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">Acesse seu prontuário com segurança.</p>
      </div>

      <div className="space-y-2.5">
        <GovBrButton onClick={() => toast.info('Login gov.br chega na Fase 5. Em breve!')} />
        <SocialButton icon={<GoogleIcon />} label="Continuar com Google" onClick={signInWithGoogle} />
      </div>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">ou</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@email.com"
              className="h-12 w-full rounded-xl border border-neutral-200 pl-10 pr-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary focus:ring-4 focus:ring-trust-100"
              {...register('email')}
            />
          </div>
        </Field>

        <Field
          label="Senha"
          htmlFor="password"
          error={errors.password?.message}
          aside={
            <Link href="/login" className="text-xs font-medium text-primary hover:underline">
              Esqueceu a senha?
            </Link>
          }
        >
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-12 w-full rounded-xl border border-neutral-200 pl-10 pr-10 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary focus:ring-4 focus:ring-trust-100"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-400 hover:text-neutral-700"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white shadow-sm transition hover:bg-trust-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
        <ShieldCheck className="h-3.5 w-3.5 text-health-500" />
        Criptografado · Conformidade LGPD
      </div>

      <p className="mt-6 text-center text-sm text-neutral-500">
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
        <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-semaphore-alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
