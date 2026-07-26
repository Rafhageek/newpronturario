// ============================================================================
// HubPatients — Edge Function: directions
//
// Traça a rota (origem → destino) para desenhar no mapa do app. Usa a Google
// DIRECTIONS API com a chave NO SERVIDOR (secret GOOGLE_PLACES_KEY) — a chave
// pública do app (Android) NÃO autoriza chamadas REST, por isso vai pelo servidor.
// Qualquer usuário autenticado pode usar (não precisa ser admin). NÃO grava nada.
//
// Habilitar no Google Cloud: "Directions API" + permitir a chave a usá-la.
// Deploy: supabase functions deploy directions
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { logSafeFailure } from '../_shared/observability.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GOOGLE_KEY = Deno.env.get('GOOGLE_PLACES_KEY') ?? '';

const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401);

    const body = await req.json().catch(() => null);
    const oLat = num(body?.originLat);
    const oLng = num(body?.originLng);
    const dLat = num(body?.destLat);
    const dLng = num(body?.destLng);
    const mode = typeof body?.mode === 'string' ? body.mode : 'driving';
    if (oLat == null || oLng == null || dLat == null || dLng == null) {
      return json({ error: 'Coordenadas inválidas.' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData.user?.id) return json({ error: 'Não autenticado.' }, 401);

    if (!GOOGLE_KEY) return json({ error: 'Rotas não configuradas.', code: 'no_key' }, 503);

    const url =
      `${DIRECTIONS_URL}?origin=${oLat},${oLng}&destination=${dLat},${dLng}` +
      `&mode=${encodeURIComponent(mode)}&language=pt-BR&region=br&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => null);

    const status = data?.status as string | undefined;
    if (status === 'OK' && Array.isArray(data.routes) && data.routes[0]) {
      const route = data.routes[0];
      const leg = Array.isArray(route.legs) ? route.legs[0] : null;
      return json(
        {
          ok: true,
          polyline: route.overview_polyline?.points ?? '',
          distanceText: leg?.distance?.text ?? null,
          durationText: leg?.duration?.text ?? null,
          distanceMeters: leg?.distance?.value ?? null,
        },
        200,
      );
    }
    if (status === 'ZERO_RESULTS') {
      return json({ error: 'Sem rota disponível.', code: 'no_route' }, 404);
    }
    // REQUEST_DENIED / OVER_QUERY_LIMIT / etc. — sem vazar mensagem do provedor.
    const errorId = crypto.randomUUID();
    logSafeFailure('directions_provider_failed', errorId, {
      httpStatus: res.status,
      providerStatus: status,
    });
    return json(
      {
        error: 'O serviço de rotas está temporariamente indisponível.',
        code: 'provider_error',
        id: errorId,
      },
      502,
    );
  } catch (e) {
    const errorId = crypto.randomUUID();
    logSafeFailure('directions_failed', errorId, { error: e });
    return json({ error: 'Erro interno.', id: errorId }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
