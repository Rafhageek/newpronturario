// ============================================================================
// HubPatients — Edge Function: geocode-address
//
// Converte um ENDEREÇO em coordenadas (lat/lng) para o admin cadastrar locais
// de saúde. Usa a Google GEOCODING API (a API canônica p/ endereço→coords),
// com a chave NO SERVIDOR (secret GOOGLE_PLACES_KEY). Só admin usa. NÃO grava.
//
// Habilitar no Google Cloud: "Geocoding API" + permitir a chave a usá-la.
// Deploy: supabase functions deploy geocode-address
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { logSafeFailure } from '../_shared/observability.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GOOGLE_KEY = Deno.env.get('GOOGLE_PLACES_KEY') ?? '';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401);

    const body = await req.json().catch(() => null);
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    if (address.length < 4) return json({ error: 'Informe um endereço.' }, 400);

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (authErr || !uid) return json({ error: 'Não autenticado.' }, 401);

    const { data: isAdmin } = await supabase.rpc('is_admin', { uid });
    if (isAdmin !== true) return json({ error: 'Apenas administradores.' }, 403);

    if (!GOOGLE_KEY) return json({ error: 'Geocodificação não configurada.', code: 'no_key' }, 503);

    const url =
      `${GEOCODE_URL}?address=${encodeURIComponent(address)}` +
      `&region=br&language=pt-BR&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => null);

    const status = data?.status as string | undefined;
    if (status === 'OK' && Array.isArray(data.results) && data.results[0]) {
      const r = data.results[0];
      const lat = r.geometry?.location?.lat;
      const lng = r.geometry?.location?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return json({ ok: true, lat, lng, formattedAddress: r.formatted_address ?? address }, 200);
      }
    }
    if (status === 'ZERO_RESULTS') {
      return json({ error: 'Endereço não encontrado.', code: 'not_found' }, 404);
    }
    // REQUEST_DENIED / OVER_QUERY_LIMIT / etc. — sem vazar mensagem do provedor.
    const errorId = crypto.randomUUID();
    logSafeFailure('geocode_provider_failed', errorId, {
      httpStatus: res.status,
      providerStatus: status,
    });
    return json(
      {
        error: 'O serviço de endereços está temporariamente indisponível.',
        code: 'provider_error',
        id: errorId,
      },
      502,
    );
  } catch (e) {
    const errorId = crypto.randomUUID();
    logSafeFailure('geocode_failed', errorId, { error: e });
    return json({ error: 'Erro interno.', id: errorId }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
