import { cookies } from 'next/headers';
import Link from 'next/link';
import { PasswordResetForm } from './password-reset-form';

export default async function ResetPasswordPage() {
  const cookieStore = await cookies();
  const recoveryVerified = cookieStore.get('hp-password-recovery')?.value === 'verified';

  if (!recoveryVerified) {
    return (
      <section aria-labelledby="invalid-recovery-title">
        <h1
          id="invalid-recovery-title"
          className="text-3xl font-bold tracking-tight text-neutral-900"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Link inválido ou expirado
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          Solicite um novo link para redefinir sua senha com segurança.
        </p>
        <Link
          href="/auth/recuperar-senha"
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white shadow-sm transition hover:bg-trust-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Solicitar novo link
        </Link>
      </section>
    );
  }

  return <PasswordResetForm />;
}
