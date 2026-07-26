import { NextResponse } from 'next/server';
import { createSupabaseAnonClient } from '@hubpatients/supabase';

/**
 * GET /api/v1/me — leitura do prontuário do próprio titular autenticada por PAT.
 * O contrato HTTP v1 permanece compatível: Authorization: Bearer <token>.
 *
 * O bearer é validado e hasheado dentro de `api_me_bundle_v2`; o hash persistido
 * nunca funciona como bearer. Rate limit, last_used e auditoria ficam no banco.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível.' },
      { status: 503, headers: CORS },
    );
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!/^vlk_[A-Za-z0-9_-]{43,128}$/.test(token)) {
    return NextResponse.json(
      { error: 'Credencial ausente ou inválida.' },
      { status: 401, headers: CORS },
    );
  }

  const supabase = createSupabaseAnonClient(url, anon);
  type PatRpc = (
    functionName: string,
    params: { p_token: string },
  ) => PromiseLike<{ data: unknown; error: unknown | null }>;
  const callPatRpc = supabase.rpc.bind(supabase) as unknown as PatRpc;
  const { data, error } = await callPatRpc('api_me_bundle_v2', { p_token: token });

  if (error) {
    return NextResponse.json(
      { error: 'Credencial ausente ou inválida.' },
      { status: 401, headers: CORS },
    );
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    '_error' in data &&
    data._error === 'rate_limit_exceeded'
  ) {
    return NextResponse.json(
      { error: 'Limite de requisições excedido. Tente novamente em instantes.' },
      { status: 429, headers: { ...CORS, 'Retry-After': '60' } },
    );
  }

  return NextResponse.json(data, { headers: CORS });
}
