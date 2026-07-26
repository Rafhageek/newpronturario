import { NextResponse } from 'next/server';
import { getSafeNextPath } from '@hubpatients/core';
import { createClient } from '@/lib/supabase/server';

/**
 * Callback de OAuth (Google e Apple). O fluxo PKCE do @supabase/ssr
 * retorna aqui com `?code=...`; trocamos por uma sessão (grava os cookies) e
 * redirecionamos para o destino interno. Erros voltam ao /login com aviso.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');
  const requestedNext = searchParams.get('next');
  const recoveryTarget = '/auth/redefinir-senha';
  const isPasswordRecovery = requestedNext === recoveryTarget;
  // Só permite redirecionamento interno conhecido (evita open redirect).
  // Recuperação é uma exceção exata e não amplia a allowlist de rotas privadas.
  const next = isPasswordRecovery ? recoveryTarget : getSafeNextPath(requestedNext);

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}${isPasswordRecovery ? '/auth/recuperar-senha?error=invalid_link' : '/login?error=oauth'}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      if (isPasswordRecovery) {
        // Impede que uma sessão comum abra diretamente o formulário de troca.
        // O cookie é curto, HttpOnly e restrito à rota de redefinição.
        response.cookies.set('hp-password-recovery', 'verified', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 10 * 60,
          path: recoveryTarget,
        });
      }
      return response;
    }
  }

  return NextResponse.redirect(
    `${origin}${isPasswordRecovery ? '/auth/recuperar-senha?error=invalid_link' : '/login?error=oauth'}`,
  );
}
