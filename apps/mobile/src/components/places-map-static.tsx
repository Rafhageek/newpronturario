import { useState, type ReactNode } from 'react';
import { View, Image, Pressable, Text, Linking, StyleSheet } from 'react-native';
import { MapPin, Plus, Minus, LocateFixed, Maximize2 } from 'lucide-react-native';
import { useColors, fonts, cardShadow } from '@/theme';
import type { PlacesMapProps } from './places-map';

/**
 * Fallback de mapa para o Expo Go (onde o mapa interativo nativo não roda): uma
 * IMAGEM do Google Static Maps com os pinos. Como é imagem, o "zoom" troca o
 * nível (parâmetro `zoom`) e recarrega — dá a sensação de aproximar/afastar.
 *
 * - Abre enquadrando TODOS os pinos (sem center/zoom → o Static Maps auto-ajusta).
 * - Botões: aproximar (+), afastar (−), centralizar em mim (⌖), ver todos (⤢).
 * - Pino do usuário em azul; o selecionado (tocou no card) fica verde e centralizado.
 * - Tocar na imagem abre o Google Maps. Sem chave/pinos → não renderiza (só a lista).
 */
const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

const ZOOM_MIN = 10;
const ZOOM_MAX = 18;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

type Pin = { id: string; name: string; lat: number; lng: number };

export function PlacesMapStatic({
  places,
  userCoords,
  selectedId,
  onClearSelect,
  height = 260,
  fill = false,
  route = null,
}: PlacesMapProps) {
  const colors = useColors();
  // null = enquadrar todos (deixa o Static Maps auto-ajustar). número = zoom manual.
  const [zoom, setZoom] = useState<number | null>(null);

  const pins: Pin[] = places
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ id: p.id, name: p.name, lat: p.lat as number, lng: p.lng as number }));

  // Sem chave, ou sem nada p/ mostrar (nenhum pino E nenhuma rota) → não renderiza.
  if (!MAPS_KEY || (pins.length === 0 && !route?.encoded)) return null;

  const firstPin = pins[0] ?? null;
  const selPin = pins.find((p) => p.id === selectedId) ?? null;
  const others = pins.filter((p) => p.id !== selPin?.id).slice(0, 24);

  // Cada estilo de pino precisa do seu próprio parâmetro `markers`.
  const markerParts: string[] = [];
  if (others.length > 0) {
    markerParts.push(`markers=color:0x0284c7%7C${others.map((p) => `${p.lat},${p.lng}`).join('%7C')}`);
  }
  if (selPin) {
    markerParts.push(`markers=size:mid%7Ccolor:0x059669%7C${selPin.lat},${selPin.lng}`);
  }
  if (userCoords) {
    markerParts.push(`markers=size:mid%7Ccolor:0x2563eb%7C${userCoords.lat},${userCoords.lng}`);
  }
  const markers = markerParts.join('&');

  // Linha da rota (path codificado). Com rota, deixamos o Static Maps enquadrar
  // tudo sozinho (sem center/zoom) p/ a linha aparecer inteira.
  const path = route?.encoded ? `&path=color:0x0284c7ff%7Cweight:5%7Cenc:${encodeURIComponent(route.encoded)}` : '';

  // Centro/zoom: pino selecionado tem prioridade; senão zoom manual em mim/1º pino;
  // senão sem center/zoom → o Static Maps enquadra todos os pinos/rota sozinho.
  const target = selPin ?? userCoords ?? firstPin;
  const centerZoom =
    route?.encoded
      ? ''
      : selPin != null
        ? `center=${selPin.lat},${selPin.lng}&zoom=${zoom ?? 16}&`
        : zoom != null && target
          ? `center=${target.lat},${target.lng}&zoom=${zoom}&`
          : '';

  const url =
    `https://maps.googleapis.com/maps/api/staticmap?size=640x360&scale=2&${centerZoom}${markers}${path}&key=${MAPS_KEY}`;

  function openMaps() {
    const c = selPin ?? userCoords ?? firstPin ?? route?.coords[0] ?? null;
    if (!c) return;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`);
  }

  const zoomBy = (delta: number) => setZoom((z) => clampZoom((z ?? 13) + delta));
  const fitAll = () => {
    onClearSelect?.();
    setZoom(null);
  };
  const centerMe = () => {
    onClearSelect?.();
    if (userCoords) setZoom(15);
  };

  // Em tela cheia a lista cobre a base → controles vão pro topo (sempre visíveis).
  const ctrlTop = fill ? 48 : undefined;
  const ctrlBottom = fill ? undefined : 10;

  return (
    <Pressable
      onPress={openMaps}
      accessibilityRole="button"
      accessibilityLabel="Abrir no Google Maps"
      style={
        fill
          ? StyleSheet.absoluteFillObject
          : { height, borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' }
      }
    >
      <Image source={{ uri: url }} style={{ flex: 1, width: '100%' }} resizeMode="cover" />

      {/* Badge "abrir no mapa" (canto superior direito) */}
      <View
        style={{ position: 'absolute', top: 8, right: 8 }}
        className="flex-row items-center gap-1 rounded-full bg-fg/70 px-2.5 py-1"
      >
        <MapPin size={12} color="#ffffff" />
        <Text style={{ fontFamily: fonts.semibold, color: '#ffffff', fontSize: 11 }}>Abrir no mapa</Text>
      </View>

      {/* Zoom */}
      <View style={{ position: 'absolute', right: 10, top: ctrlTop, bottom: ctrlBottom, gap: 8 }}>
        <Ctrl onPress={() => zoomBy(1)} label="Aproximar">
          <Plus size={18} color={colors.fg} />
        </Ctrl>
        <Ctrl onPress={() => zoomBy(-1)} label="Afastar">
          <Minus size={18} color={colors.fg} />
        </Ctrl>
      </View>

      {/* Centralizar em mim + ver todos */}
      <View style={{ position: 'absolute', left: 10, top: ctrlTop, bottom: ctrlBottom, gap: 8 }}>
        {userCoords ? (
          <Ctrl onPress={centerMe} label="Centralizar na minha localização">
            <LocateFixed size={18} color={colors.primary} />
          </Ctrl>
        ) : null}
        <Ctrl onPress={fitAll} label="Ver todos">
          <Maximize2 size={18} color={colors.fg} />
        </Ctrl>
      </View>
    </Pressable>
  );
}

function Ctrl({
  children,
  onPress,
  label,
}: {
  children: ReactNode;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{
        height: 42,
        width: 42,
        borderRadius: 14,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.96)',
        ...cardShadow,
      }}
    >
      {children}
    </Pressable>
  );
}
