import type { HubPatientsClient } from '../types';

/**
 * Diretório de locais de saúde curado pelo admin (tabela health_places).
 * Admin cadastra/edita; usuário lê. Distância calculada no cliente. As
 * coordenadas vêm da Edge Function geocode-address (a partir do endereço).
 *
 * Compartilhado entre web e mobile. A tabela é nova e ainda não está nos tipos
 * gerados do Supabase, então o acesso é feito via cast controlado até regenerar.
 */

export type Coords = { lat: number; lng: number };

export type PlaceType = 'pharmacy' | 'hospital' | 'lab' | 'clinic';

export const PLACE_TYPES: PlaceType[] = ['pharmacy', 'hospital', 'lab', 'clinic'];

export const PLACE_TYPE_LABEL: Record<PlaceType, string> = {
  pharmacy: 'Farmácia',
  hospital: 'Hospital',
  lab: 'Laboratório',
  clinic: 'Clínica',
};

export type HealthPlace = {
  id: string;
  type: PlaceType;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  hours_text: string | null;
  is_24h: boolean;
  lat: number | null;
  lng: number | null;
  link: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

export type HealthPlaceInput = {
  type: PlaceType;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  hours_text?: string | null;
  is_24h?: boolean;
  lat?: number | null;
  lng?: number | null;
  link?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type HealthPlaceWithDistance = HealthPlace & { distanceM: number | null };

export function isPlaceType(value: string | undefined | null): value is PlaceType {
  return value != null && (PLACE_TYPES as string[]).includes(value);
}

// Acesso à tabela ainda não tipada nos Database types gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(client: HubPatientsClient): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from('health_places');
}

export async function listHealthPlaces(
  client: HubPatientsClient,
  type: PlaceType,
  opts?: { includeInactive?: boolean },
): Promise<HealthPlace[]> {
  let q = table(client).select('*').eq('type', type).order('name');
  if (!opts?.includeInactive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HealthPlace[];
}

export async function createHealthPlace(client: HubPatientsClient, input: HealthPlaceInput): Promise<void> {
  const { error } = await table(client).insert(input);
  if (error) throw error;
}

export async function updateHealthPlace(
  client: HubPatientsClient,
  id: string,
  input: Partial<HealthPlaceInput>,
): Promise<void> {
  const { error } = await table(client).update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteHealthPlace(client: HubPatientsClient, id: string): Promise<void> {
  const { error } = await table(client).delete().eq('id', id);
  if (error) throw error;
}

export type GeocodeResult =
  | { ok: true; lat: number; lng: number; formattedAddress: string }
  | { ok: false; reason: string };

/** Geocodifica um endereço via Edge Function, com motivo claro em caso de falha. */
export async function geocodeAddress(client: HubPatientsClient, address: string): Promise<GeocodeResult> {
  const { data, error } = await client.functions.invoke('geocode-address', { body: { address } });

  if (error) {
    let reason = 'Falha ao buscar coordenadas.';
    try {
      const ctx = (error as { context?: Response }).context;
      const status = ctx?.status;
      const body = (await ctx?.json?.()) as { error?: string; code?: string } | undefined;
      if (status === 404 && !body?.code) {
        reason = 'A função "geocode-address" não está publicada. Rode: supabase functions deploy geocode-address';
      } else if (body?.code === 'no_key') {
        reason = 'Chave do Google não configurada no servidor (secret GOOGLE_PLACES_KEY).';
      } else if (body?.code === 'not_found') {
        reason = 'Endereço não encontrado. Revise e tente de novo.';
      } else if (status === 403) {
        reason = 'Sem permissão (sua conta precisa ser admin).';
      } else if (body?.error) {
        reason = body.error;
      }
    } catch {
      // mantém o motivo genérico
    }
    return { ok: false, reason };
  }

  const d = data as { lat?: number; lng?: number; formattedAddress?: string } | null;
  if (d && typeof d.lat === 'number' && typeof d.lng === 'number') {
    return { ok: true, lat: d.lat, lng: d.lng, formattedAddress: d.formattedAddress ?? address };
  }
  return { ok: false, reason: 'Endereço não encontrado. Revise e tente de novo.' };
}

/** Distância em metros (Haversine). */
export function haversineM(a: Coords, b: Coords): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Anexa distância (se houver local do usuário e coords do lugar) e ordena. */
export function withDistance(places: HealthPlace[], coords: Coords | null): HealthPlaceWithDistance[] {
  const out = places.map((p) => ({
    ...p,
    distanceM: coords && p.lat != null && p.lng != null ? haversineM(coords, { lat: p.lat, lng: p.lng }) : null,
  }));
  out.sort((a, b) => {
    if (a.distanceM == null) return 1;
    if (b.distanceM == null) return -1;
    return a.distanceM - b.distanceM;
  });
  return out;
}

/** Formata distância em metros para "443 m" / "1,2 km" (pt-BR). */
export function formatDistance(m: number | null): string {
  if (m == null || !Number.isFinite(m) || m < 0) return '';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
