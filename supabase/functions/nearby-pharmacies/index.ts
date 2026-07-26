// ============================================================================
// HubPatients — Edge Function: nearby-pharmacies
//
// Busca farmácias próximas via Google Places API (New) — searchNearby. A CHAVE
// do Google fica NO SERVIDOR (secret GOOGLE_PLACES_KEY), nunca no app, p/ não
// vazar e não gerar custo por abuso. O app só envia lat/lng e recebe a lista
// normalizada. Usa ANON KEY + JWT do usuário só p/ autenticar quem chama
// (sem service_role). NÃO grava nada.
//
// Secret: supabase secrets set GOOGLE_PLACES_KEY=xxxx
// Deploy:  supabase functions deploy nearby-pharmacies
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { logSafeFailure } from '../_shared/observability.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GOOGLE_KEY = Deno.env.get('GOOGLE_PLACES_KEY') ?? '';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.currentOpeningHours.openNow',
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber',
  'places.googleMapsUri',
].join(',');

// Distância em metros (Haversine).
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401);

    const body = await req.json().catch(() => null);
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ error: 'Coordenadas inválidas.' }, 400);
    }
    const radius = Math.min(Math.max(Number(body?.radius) || 4000, 500), 50000);
    const openNow = body?.openNow === true;

    // Autentica quem chama (sem privilégio elevado).
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData.user?.id) return json({ error: 'Não autenticado.' }, 401);

    if (!GOOGLE_KEY) {
      return json(
        { error: 'Busca de farmácias não configurada (sem chave).', code: 'no_key' },
        503,
      );
    }

    const res = await fetch(PLACES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: ['pharmacy'],
        maxResultCount: 20,
        rankPreference: 'DISTANCE',
        languageCode: 'pt-BR',
        regionCode: 'BR',
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
      }),
    });

    if (!res.ok) {
      const errorId = crypto.randomUUID();
      // Não ler/logar o corpo: ele pode ecoar detalhes da requisição.
      logSafeFailure('nearby_pharmacies_provider_failed', errorId, { httpStatus: res.status });
      return json({ error: 'Falha ao buscar farmácias.', id: errorId }, 502);
    }

    const data = await res.json();
    const origin = { lat, lng };
    type Place = {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      currentOpeningHours?: { openNow?: boolean };
      rating?: number;
      userRatingCount?: number;
      nationalPhoneNumber?: string;
      googleMapsUri?: string;
    };
    let places = ((data?.places ?? []) as Place[]).map((p) => {
      const plat = p.location?.latitude ?? lat;
      const plng = p.location?.longitude ?? lng;
      return {
        id: p.id ?? `${plat},${plng}`,
        name: p.displayName?.text ?? 'Farmácia',
        address: p.formattedAddress ?? '',
        lat: plat,
        lng: plng,
        distanceM: distanceM(origin, { lat: plat, lng: plng }),
        openNow: p.currentOpeningHours?.openNow ?? null,
        rating: p.rating ?? null,
        ratingCount: p.userRatingCount ?? null,
        phone: p.nationalPhoneNumber ?? null,
        mapsUri: p.googleMapsUri ?? null,
      };
    });

    if (openNow) places = places.filter((p) => p.openNow === true);
    places.sort((a, b) => a.distanceM - b.distanceM);

    return json({ ok: true, places }, 200);
  } catch (e) {
    const errorId = crypto.randomUUID();
    logSafeFailure('nearby_pharmacies_failed', errorId, { error: e });
    return json({ error: 'Erro interno.', id: errorId }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
