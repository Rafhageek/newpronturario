import { Linking } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Farmácias próximas — usa expo-location p/ a posição do usuário e a Edge
 * Function `nearby-pharmacies` (proxy do Google Places, chave no servidor).
 * Favoritos ficam no SecureStore. Helpers de "abrir no mapa"/"rotas"/"ligar"
 * via deep link funcionam sem nenhuma chave (abrem o Google Maps do aparelho).
 */

export type Pharmacy = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceM: number;
  openNow: boolean | null;
  rating: number | null;
  ratingCount: number | null;
  phone: string | null;
  mapsUri: string | null;
};

export type Coords = { lat: number; lng: number };

/** Pede permissão e retorna a posição atual (ou null se negar/falhar). */
export async function getUserLocation(): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export type NearbyResult = { places: Pharmacy[]; code?: 'no_key' | 'error' };

/** Busca farmácias próximas via Edge Function. */
export async function fetchNearbyPharmacies(
  client: SupabaseClient,
  params: { lat: number; lng: number; openNow?: boolean; radius?: number },
): Promise<NearbyResult> {
  const { data, error } = await client.functions.invoke('nearby-pharmacies', { body: params });
  if (error) {
    // 503 sem chave configurada → sinaliza p/ a tela mostrar o fallback "abrir no Maps".
    const code = (data as { code?: string } | null)?.code === 'no_key' ? 'no_key' : 'error';
    return { places: [], code };
  }
  const places = ((data as { places?: Pharmacy[] } | null)?.places ?? []) as Pharmacy[];
  return { places };
}

/* ── Deep links (Google Maps do aparelho) — funcionam sem chave ── */

export function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Abre o Google Maps com a busca "farmácia" perto das coordenadas. */
export function openMapsNearby(c?: Coords | null): void {
  const at = c ? `/@${c.lat},${c.lng},15z` : '';
  void Linking.openURL(`https://www.google.com/maps/search/farmácia${at}`);
}

/** Abre a rota até a farmácia no app de mapas (universal: web/Android/iOS). */
export function openDirections(p: { lat: number; lng: number; name?: string }): void {
  const dest = `${p.lat},${p.lng}`;
  void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`);
}

export function callPhone(phone: string): void {
  void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
}

/* ── Favoritos (SecureStore: lista de ids) ── */

const FAV_KEY = 'hubpatients.pharm.favs';

export async function loadFavoritePharmacyIds(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(FAV_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr.filter((x) => typeof x === 'string') as string[]) : [];
  } catch {
    return [];
  }
}

export async function toggleFavoritePharmacy(id: string): Promise<string[]> {
  const cur = await loadFavoritePharmacyIds();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  try {
    await SecureStore.setItemAsync(FAV_KEY, JSON.stringify(next));
  } catch {
    // não-crítico
  }
  return next;
}
