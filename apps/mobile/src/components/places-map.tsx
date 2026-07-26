import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import MapView, { Marker, Callout, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { Plus, Minus, LocateFixed, Clock } from 'lucide-react-native';
import { useColors, cardShadow, fonts } from '@/theme';
import { formatDistance, type Coords } from '@/lib/pharmacies';
import type { HealthPlaceWithDistance } from '@/lib/health-places';

/**
 * Mapa INTERATIVO (react-native-maps) com os locais cadastrados.
 * Só roda em dev build / APK — NÃO no Expo Go (módulo nativo). Por isso este
 * arquivo é carregado via require condicional na tela (nunca em Expo Go).
 *
 * `fill` → ocupa todo o espaço do pai (mapa em tela cheia com a lista numa folha
 * por cima). Ao abrir, enquadra VOCÊ + todas as farmácias (fitToCoordinates).
 * Botões: aproximar (+), afastar (−), centralizar em mim. Tocar num pino abre um
 * balão e seleciona o card; tocar num card centraliza/aproxima o pino.
 */
export type PlacesMapProps = {
  places: HealthPlaceWithDistance[];
  userCoords: Coords | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClearSelect?: () => void;
  height?: number;
  fill?: boolean;
  /** Rota a desenhar (origem→destino). `encoded` é usado pelo mapa estático. */
  route?: { coords: Coords[]; encoded: string } | null;
};

type Pin = HealthPlaceWithDistance & { lat: number; lng: number };

export function PlacesMap({
  places,
  userCoords,
  selectedId,
  onSelect,
  onClearSelect,
  height = 260,
  fill = false,
  route = null,
}: PlacesMapProps) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);
  const pins = places.filter((p): p is Pin => p.lat != null && p.lng != null);


  const first = pins[0];
  const centerLat = userCoords?.lat ?? first?.lat ?? -14.235; // Brasil como fallback
  const centerLng = userCoords?.lng ?? first?.lng ?? -51.925;
  const initial: Region = {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: userCoords || first ? 0.08 : 30,
    longitudeDelta: userCoords || first ? 0.08 : 30,
  };

  // Enquadra todos os pinos + a posição do usuário com uma margem confortável.
  const fitAll = useCallback(() => {
    const coords = [
      ...pins.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      ...(userCoords ? [{ latitude: userCoords.lat, longitude: userCoords.lng }] : []),
    ];
    if (coords.length === 0) return;
    if (coords.length === 1) {
      const c = coords[0]!;
      mapRef.current?.animateToRegion({ ...c, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 350);
      return;
    }
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 70, right: 56, bottom: fill ? 260 : 64, left: 56 },
      animated: true,
    });
  }, [pins.length, userCoords, fill]);

  // Centraliza/aproxima no pino selecionado quando o usuário toca num card.
  useEffect(() => {
    if (!selectedId) return;
    const p = pins.find((x) => x.id === selectedId);
    if (p) {
      mapRef.current?.animateToRegion(
        { latitude: p.lat, longitude: p.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 },
        400,
      );
    }
  }, [selectedId]);

  // Ao traçar uma rota, enquadra a linha inteira.
  useEffect(() => {
    if (!route || route.coords.length < 2) return;
    mapRef.current?.fitToCoordinates(
      route.coords.map((c) => ({ latitude: c.lat, longitude: c.lng })),
      { edgePadding: { top: 80, right: 60, bottom: fill ? 220 : 60, left: 60 }, animated: true },
    );
  }, [route]);

  const zoomBy = useCallback(async (delta: number) => {
    const cam = await mapRef.current?.getCamera();
    const current = cam?.zoom ?? 14;
    // Câmera parcial: o react-native-maps faz merge — não mutamos o objeto nativo.
    mapRef.current?.animateCamera({ zoom: Math.max(3, Math.min(20, current + delta)) }, { duration: 220 });
  }, []);

  const recenter = useCallback(() => {
    onClearSelect?.();
    if (userCoords) {
      mapRef.current?.animateToRegion(
        { latitude: userCoords.lat, longitude: userCoords.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 },
        400,
      );
    } else {
      fitAll();
    }
  }, [userCoords, fitAll, onClearSelect]);

  // Em tela cheia a lista cobre a base → controles vão pro topo (sempre visíveis).
  const ctrlTop = fill ? 12 : undefined;
  const ctrlBottom = fill ? undefined : 10;

  return (
    <View
      style={
        fill
          ? StyleSheet.absoluteFillObject
          : { height, borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' }
      }
    >
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={initial}
        showsUserLocation={!!userCoords}
        showsMyLocationButton={false}
        zoomControlEnabled={false} // usamos controles próprios (+/-) — evita duplicar os nativos do Android
        toolbarEnabled={false}
        onMapReady={fitAll}
      >
        {route && route.coords.length >= 2 ? (
          <Polyline
            coordinates={route.coords.map((c) => ({ latitude: c.lat, longitude: c.lng }))}
            strokeColor={colors.brand}
            strokeWidth={5}
          />
        ) : null}
        {pins.map((p) => {
          const sel = p.id === selectedId;
          return (
            <Marker
              // Re-key só o selecionado: ao mudar a seleção, apenas esse marcador
              // remonta e redesenha com a cor nova (referência react-native-maps
              // #5198). Evita repintar TODOS os pinos. tracksViewChanges só fica
              // ligado no selecionado (1 marcador) e desliga nos demais (perf).
              key={sel ? `${p.id}:sel` : p.id}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              onPress={() => onSelect(p.id)}
              pinColor={sel ? colors.accent : colors.primary}
              zIndex={sel ? 10 : 1}
              tracksViewChanges={sel}
            >
              <Callout tooltip>
                <View
                  style={[
                    {
                      maxWidth: 240,
                      backgroundColor: colors.surface,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    },
                    cardShadow,
                  ]}
                >
                  <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.fg }}>
                    {p.name}
                  </Text>
                  {p.address ? (
                    <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2 }}>
                      {p.address}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {p.distanceM != null ? (
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.primary }}>
                        {formatDistance(p.distanceM)}
                      </Text>
                    ) : null}
                    {p.is_24h ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} color={colors.accent} />
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.accent }}>24h</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Zoom */}
      <View style={{ position: 'absolute', right: 10, top: ctrlTop, bottom: ctrlBottom, gap: 8 }}>
        <Ctrl onPress={() => void zoomBy(1)} label="Aproximar">
          <Plus size={18} color={colors.fg} />
        </Ctrl>
        <Ctrl onPress={() => void zoomBy(-1)} label="Afastar">
          <Minus size={18} color={colors.fg} />
        </Ctrl>
      </View>

      {/* Centralizar em mim */}
      <View style={{ position: 'absolute', left: 10, top: ctrlTop, bottom: ctrlBottom }}>
        <Ctrl onPress={recenter} label="Centralizar na minha localização">
          <LocateFixed size={18} color={colors.primary} />
        </Ctrl>
      </View>
    </View>
  );
}

function Ctrl({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
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
