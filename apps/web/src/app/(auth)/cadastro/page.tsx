'use client';

import { forwardRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { signupSchema, type SignupInput, DISCLAIMERS } from '@vidalog/core';
import { useVidaLogClient } from '@vidalog/supabase';

export default function CadastroPage() {
  const supabase = useVidaLogClient();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupInput) {
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName } },
    });
    setSubmitting(false);
    if (error) {
      toast.error('Não foi possível criar a conta. Tente outro e-mail.');
      return;
    }
    toast.success('Conta criada! Você já pode usar o VidaLog.');
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <div className="vl-rise">
      <div className="mb-7">
        <h1
          className="text-3xl font-bold tracking-tight text-neutral-900"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Criar conta
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Comece a organizar sua saúde em poucos segundos.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Nome completo" htmlFor="fullName" error={errors.fullName?.message}>
          <IconInput icon={<User className="h-4 w-4" />} id="fullName" autoComplete="name" placeholder="Seu nome" {...register('fullName')} />
        </Field>

        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <IconInput icon={<Mail className="h-4 w-4" />} id="email" type="email" autoComplete="email" placeholder="voce@email.com" {...register('email')} />
        </Field>

        <Field label="Senha" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
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

        <Field label="Confirmar senha" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <IconInput
            icon={<Lock className="h-4 w-4" />}
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register('confirmPassword')}
          />
        </Field>

        <label className="flex items-start gap-2.5 text-sm text-neutral-600">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary" {...register('acceptedTerms')} />
          <span>
            Li e aceito os termos de uso e a política de privacidade (LGPD).
            {errors.acceptedTerms ? (
              <span className="mt-1 block text-xs text-semaphore-alert" role="alert">
                {errors.acceptedTerms.message}
              </span>
            ) : null}
          </span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white shadow-sm transition hover:bg-trust-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          {submitting ? 'Criando…' : 'Criar conta'}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
        <ShieldCheck className="h-3.5 w-3.5 text-health-500" />
        {DISCLAIMERS.dataSharing}
      </div>

      <p className="mt-5 text-center text-sm text-neutral-500">
        Já tem conta?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-semaphore-alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const IconInput = forwardRef<
  HTMLInputElement,
  { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>
>(function IconInput({ icon, ...props }, ref) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
        {icon}
      </span>
      <input
        ref={ref}
        className="h-12 w-full rounded-xl border border-neutral-200 pl-10 pr-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary focus:ring-4 focus:ring-trust-100"
        {...props}
      />
    </div>
  );
});
