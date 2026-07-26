import type { SupabaseClient } from '@supabase/supabase-js';
import type { Coords } from './pharmacies';

/**
 * Rotas para desenhar no mapa. A rota vem da Edge Function `directions` (Google
 * Directions API, chave no servidor). Retorna o polyline codificado (p/ o Static
 * Maps usar em `path=enc:`) e já decodificado em coordenadas (p/ o <Polyline>).
 *
 * Degrada com elegância: se a função não estiver publicada / API não habilitada,
 * retorna null e a tela cai no "abrir no Google Maps" (que já funciona).
 */
export type RouteResult = {
  encoded: string;
  coords: Coords[];
  distanceText: string | null;
  durationText: string | null;
};

/** Decodifica um polyline do Google (algoritmo padrão) em lista de coordenadas. */
export function decodePolyline(encoded: string): Coords[] {
  const points: Coords[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = encoded.length;

  while (index < len) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export async function getDirections(
  client: SupabaseClient,
  origin: Coords,
  dest: Coords,
): Promise<RouteResult | null> {
  const { data, error } = await client.functions.invoke('directions', {
    body: { originLat: origin.lat, originLng: origin.lng, destLat: dest.lat, destLng: dest.lng },
  });
  if (error) return null;

  const d = data as
    | { ok?: boolean; polyline?: string; distanceText?: string | null; durationText?: string | null }
    | null;
  if (!d?.ok || !d.polyline) return null;

  return {
    encoded: d.polyline,
    coords: decodePolyline(d.polyline),
    distanceText: d.distanceText ?? null,
    durationText: d.durationText ?? null,
  };
}
