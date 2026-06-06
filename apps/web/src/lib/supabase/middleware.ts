import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@vidalog/supabase/clients/server';
import { getSupabaseEnv } from '../env';

const PUBLIC_PATHS = ['/login', '/cadastro', '/auth'];

/**
 * Refresca a sessão Supabase a cada request e protege as rotas privadas.
 * Padrão recomendado pelo @supabase/ssr para Next.js App Router.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  // Sem credenciais configuradas ainda: não há backend para proteger.
  // Libera todas as rotas para visualizar a UI antes de preencher o .env.local.
  const env = getSupabaseEnv();
  if (!env.configured) {
    return response;
  }
  const { url, anonKey } = env;

  const supabase = createSupabaseServerClient(url, anonKey, {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  });

  // getUser pode falhar se o backend estiver inacessível — trata como deslogado.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Não logado tentando acessar rota privada -> login.
  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Logado acessando login/cadastro -> dashboard.
  if (user && (pathname === '/login' || pathname === '/cadastro')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
