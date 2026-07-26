import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ComponentType,
} from 'react';
import { View, Text, Pressable, Linking, Share, RefreshControl, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import BottomSheet, { BottomSheetFlatList, BottomSheetView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import {
  MapPin,
  Navigation,
  Route as RouteIcon,
  Phone,
  Heart,
  Clock,
  Package,
  MessageCircle,
  Share2,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useStockSummary, useHubPatientsClient } from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import { AppHeader, Card, EmptyState, ErrorState, Badge } from '@/components/ui';
import { SkeletonList } from '@/components/feedback';
import { useColors, fonts } from '@/theme';
import {
  listHealthPlaces,
  withDistance,
  PLACE_TYPE_LABEL,
  type PlaceType,
  type HealthPlaceWithDistance,
} from '@/lib/health-places';
import {
  getUserLocation,
  formatDistance,
  openDirections,
  callPhone,
  loadFavoritePharmacyIds,
  toggleFavoritePharmacy,
  type Coords,
} from '@/lib/pharmacies';
import { getDirections, type RouteResult } from '@/lib/directions';
import { toast } from '@/components/toast';
import { PlacesMapStatic } from '@/components/places-map-static';
import type { PlacesMapProps } from '@/components/places-map';

const CONTINUOUS = { borderCurve: 'continuous' as const };

// Mapa interativo (react-native-maps) só roda em dev build / APK. No Expo Go
// (executionEnvironment 'storeClient') NÃO carregamos o módulo nativo — cai no
// mapa estático. O require condicional evita que o Expo Go quebre ao importar.
const MAPS_NATIVE = Constants.executionEnvironment !== 'storeClient';
let InteractiveMap: ComponentType<PlacesMapProps> | null = null;
if (MAPS_NATIVE) {
  try {
    // O módulo nativo não pode ser importado no Expo Go; o carregamento
    // condicional é intencional e possui fallback estático.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    InteractiveMap = (require('@/components/places-map') as { PlacesMap: ComponentType<PlacesMapProps> }).PlacesMap;
  } catch {
    InteractiveMap = null;
  }
}

const PLACE_TYPES: PlaceType[] = ['pharmacy', 'hospital', 'lab', 'clinic'];

function isPlaceType(value: string | undefined): value is PlaceType {
  return value != null && (PLACE_TYPES as string[]).includes(value);
}

/** Mensagem do estado vazio por tipo (acusativo p/ ficar natural). */
const EMPTY_TITLE: Record<PlaceType, string> = {
  pharmacy: 'Nenhuma farmácia cadastrada ainda.',
  hospital: 'Nenhum hospital cadastrado ainda.',
  lab: 'Nenhum laboratório cadastrado ainda.',
  clinic: 'Nenhuma clínica cadastrada ainda.',
};

const SNAP_POINTS = ['16%', '46%', '90%'];

export default function LocaisScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const client = useHubPatientsClient();

  // Lê o param dinâmico e valida; qualquer valor inesperado vira "pharmacy".
  const params = useLocalSearchParams<{ type: string }>();
  const type: PlaceType = isPlaceType(params.type) ? params.type : 'pharmacy';
  const label = PLACE_TYPE_LABEL[type];

  const [coords, setCoords] = useState<Coords | null>(null);
  const [favIds, setFavIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [only24h, setOnly24h] = useState(false);
  const [route, setRoute] = useState<({ forId: string } & RouteResult) | null>(null);
  const [routingId, setRoutingId] = useState<string | null>(null);

  const sheetRef = useRef<ComponentRef<typeof BottomSheet>>(null);
  const listRef = useRef<ComponentRef<typeof BottomSheetFlatList>>(null);

  // Localização + favoritos ao montar.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [loc, favs] = await Promise.all([getUserLocation(), loadFavoritePharmacyIds()]);
      if (cancelled) return;
      setFavIds(favs);
      if (loc) setCoords(loc);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const query = useQuery({
    queryKey: ['health-places', type],
    queryFn: () => listHealthPlaces(client, type),
  });

  // Anexa distância (se houver coords) e ordena por proximidade.
  const places = useMemo<HealthPlaceWithDistance[]>(
    () => withDistance(query.data ?? [], coords),
    [query.data, coords],
  );

  // Busca (nome/endereço/cidade) + filtro "só 24h".
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return places.filter((p) => {
      if (only24h && !p.is_24h) return false;
      if (!q) return true;
      return [p.name, p.address, p.city].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [places, search, only24h]);

  // Se a busca/filtro esconder o item selecionado ou o destino da rota, limpa —
  // evita pino/seleção/rota "fantasma" apontando p/ algo que não está na lista.
  useEffect(() => {
    if (selectedId && !filtered.some((p) => p.id === selectedId)) setSelectedId(null);
    if (route && !filtered.some((p) => p.id === route.forId)) setRoute(null);
  }, [filtered, selectedId, route]);

  // Remédios acabando — só na vitrine de farmácias (espelha medicamentos.tsx).
  const { data: stockSummary } = useStockSummary(user?.id);
  const lowNames = useMemo(() => {
    if (type !== 'pharmacy') return [];
    return (stockSummary ?? [])
      .filter((s) => s.daysRemaining != null && s.daysRemaining <= s.medication.stock_low_threshold_days)
      .map((s) => s.medication.name);
  }, [stockSummary, type]);

  const onToggleFav = useCallback(async (id: string) => {
    const next = await toggleFavoritePharmacy(id);
    setFavIds(next);
  }, []);

  // Tocar num card (ou pino) → seleciona, abre a folha no meio e rola até o item.
  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      sheetRef.current?.snapToIndex(1);
      const idx = filtered.findIndex((p) => p.id === id);
      if (idx >= 0) {
        requestAnimationFrame(() =>
          listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.25 }),
        );
      }
    },
    [filtered],
  );

  // Traça a rota no mapa (Edge Function directions). Degrada p/ Google Maps se a
  // função não estiver publicada / API não habilitada / sem localização.
  const onRoute = useCallback(
    async (p: HealthPlaceWithDistance) => {
      if (p.lat == null || p.lng == null) return;
      const dest = { lat: p.lat, lng: p.lng };
      if (!coords) {
        toast.info('Ative a localização para traçar a rota no app. Abrindo o Google Maps…');
        openDirections({ ...dest, name: p.name });
        return;
      }
      setSelectedId(p.id);
      setRoutingId(p.id);
      const r = await getDirections(client, coords, dest);
      setRoutingId(null);
      if (!r) {
        toast.info('Não consegui traçar a rota agora — abrindo o Google Maps.');
        openDirections({ ...dest, name: p.name });
        return;
      }
      setRoute({ forId: p.id, ...r });
      sheetRef.current?.snapToIndex(0); // recolhe a folha p/ mostrar o mapa
    },
    [coords, client],
  );

  const sharePlace = useCallback(async (p: HealthPlaceWithDistance) => {
    const loc =
      p.lat != null && p.lng != null
        ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
        : null;
    const cityLine = [p.city, p.state].filter(Boolean).join(' - ');
    const message = [p.name, p.address, cityLine || null, loc].filter(Boolean).join('\n');
    await Share.share({ message }).catch(() => undefined);
  }, []);

  const routeForMap = route ? { coords: route.coords, encoded: route.encoded } : null;
  const MapBlock = InteractiveMap ? (
    <InteractiveMap
      fill
      places={filtered}
      userCoords={coords}
      selectedId={selectedId}
      onSelect={handleSelect}
      onClearSelect={() => setSelectedId(null)}
      route={routeForMap}
    />
  ) : (
    <PlacesMapStatic
      fill
      places={filtered}
      userCoords={coords}
      selectedId={selectedId}
      onSelect={handleSelect}
      onClearSelect={() => setSelectedId(null)}
      route={routeForMap}
    />
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title={label} back />
      <View style={{ flex: 1 }}>
        {/* Mapa em tela cheia ao fundo */}
        {MapBlock}

        {/* Lista numa folha arrastável por cima (estilo Google/Apple Maps) */}
        <BottomSheet
          ref={sheetRef}
          index={1}
          snapPoints={SNAP_POINTS}
          enableDynamicSizing={false} // snapPoints fixos: o auto-size do v5 brigaria com header+lista
          keyboardBehavior="extend"
          android_keyboardInputMode="adjustResize"
          backgroundStyle={{ backgroundColor: colors.surface }}
          handleIndicatorStyle={{ backgroundColor: colors.faint }}
        >
          <BottomSheetView style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 6 }}>
            {/* Banner da rota traçada */}
            {route
              ? (() => {
                  const rp = places.find((p) => p.id === route.forId);
                  const info = [route.distanceText, route.durationText].filter(Boolean).join(' · ');
                  return (
                    <View
                      style={[
                        CONTINUOUS,
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          borderRadius: 14,
                          padding: 10,
                          backgroundColor: colors.brand + '14',
                        },
                      ]}
                    >
                      <RouteIcon size={18} color={colors.brand} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.fg }} numberOfLines={1}>
                          {rp?.name ?? 'Rota'}
                        </Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>
                          {info || 'Rota traçada'}
                        </Text>
                      </View>
                      {rp?.lat != null && rp?.lng != null ? (
                        <Pressable
                          onPress={() => openDirections({ lat: rp.lat!, lng: rp.lng!, name: rp.name })}
                          accessibilityRole="button"
                          accessibilityLabel="Abrir no Google Maps"
                          hitSlop={6}
                          style={[
                            CONTINUOUS,
                            {
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              backgroundColor: colors.primary,
                            },
                          ]}
                        >
                          <Navigation size={13} color={colors.white} />
                          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.white }}>Maps</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => setRoute(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Limpar rota"
                        hitSlop={8}
                      >
                        <X size={18} color={colors.muted} />
                      </Pressable>
                    </View>
                  );
                })()
              : null}

            {/* Contagem + filtro 24h */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.fg }}>
                {filtered.length} {filtered.length === 1 ? 'local' : 'locais'}
                {coords ? ' perto' : ''}
              </Text>
              <Pressable
                onPress={() => setOnly24h((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ selected: only24h }}
                hitSlop={6}
                style={[
                  CONTINUOUS,
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: only24h ? colors.accent : colors.line,
                    backgroundColor: only24h ? colors.accent + '1f' : 'transparent',
                  },
                ]}
              >
                <Clock size={14} color={only24h ? colors.accent : colors.muted} />
                <Text
                  style={{ fontFamily: fonts.semibold, fontSize: 12, color: only24h ? colors.accent : colors.muted }}
                >
                  24h
                </Text>
              </Pressable>
            </View>

            {/* Busca */}
            <View
              style={[
                CONTINUOUS,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  height: 44,
                  backgroundColor: colors.surface2,
                },
              ]}
            >
              <Search size={18} color={colors.muted} />
              <BottomSheetTextInput
                value={search}
                onChangeText={setSearch}
                placeholder={`Buscar ${label.toLowerCase()}…`}
                placeholderTextColor={colors.faint}
                style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.fg }}
                returnKeyType="search"
              />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Limpar busca">
                  <X size={18} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>

            {/* Faixa "remédio acabando" — só farmácias e só se houver itens */}
            {type === 'pharmacy' && lowNames.length > 0 ? (
              <View
                style={[
                  CONTINUOUS,
                  { flexDirection: 'row', gap: 8, borderRadius: 14, padding: 10, backgroundColor: colors.attention + '1a' },
                ]}
              >
                <Package size={18} color={colors.attention} />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.fgSoft }}>
                  Seu remédio está acabando ({lowNames.join(', ')}) — encontre uma farmácia perto.
                </Text>
              </View>
            ) : null}
          </BottomSheetView>

          {query.isLoading ? (
            <BottomSheetView style={{ paddingHorizontal: 16, paddingTop: 4 }}>
              <SkeletonList rows={4} />
            </BottomSheetView>
          ) : query.isError ? (
            <BottomSheetView style={{ padding: 16 }}>
              <ErrorState onRetry={() => void query.refetch()} />
            </BottomSheetView>
          ) : places.length === 0 ? (
            <BottomSheetView style={{ padding: 16 }}>
              <EmptyState icon={MapPin} title={EMPTY_TITLE[type]} />
            </BottomSheetView>
          ) : (
            <BottomSheetFlatList
              ref={listRef}
              data={filtered}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 12 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={query.isRefetching}
                  onRefresh={() => void query.refetch()}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
              onScrollToIndexFailed={(info) => {
                // Item ainda não medido: rola pra uma estimativa e tenta de novo.
                listRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
                setTimeout(
                  () => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.25 }),
                  300,
                );
              }}
              ListEmptyComponent={
                <EmptyState icon={Search} title="Nada encontrado com esse filtro." />
              }
              renderItem={({ item }) => (
                <PlaceCard
                  place={item}
                  favorite={favIds.includes(item.id)}
                  onToggleFav={() => onToggleFav(item.id)}
                  selected={selectedId === item.id}
                  onSelect={() => handleSelect(item.id)}
                  onShare={() => void sharePlace(item)}
                  onRoute={() => void onRoute(item)}
                  routing={routingId === item.id}
                />
              )}
            />
          )}
        </BottomSheet>
      </View>
    </View>
  );
}

/* ─────────────────────────── Card (estilo Booking) ─────────────────────────── */

function PlaceCard({
  place,
  favorite,
  onToggleFav,
  selected,
  onSelect,
  onShare,
  onRoute,
  routing,
}: {
  place: HealthPlaceWithDistance;
  favorite: boolean;
  onToggleFav: () => void;
  selected?: boolean;
  onSelect?: () => void;
  onShare?: () => void;
  onRoute?: () => void;
  routing?: boolean;
}) {
  const colors = useColors();
  const { name, address, city, state, phone, whatsapp, is_24h, hours_text, lat, lng, distanceM } = place;

  const cityLine = [city, state].filter(Boolean).join(' · ');
  const hasCoords = lat != null && lng != null;

  return (
    <Card className={selected ? 'gap-3 border-primary' : 'gap-3'}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityLabel={`Ver ${name} no mapa`}
        className="flex-row items-start gap-3"
      >
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
            {name}
          </Text>
          {address ? (
            <Text
              numberOfLines={2}
              style={{ fontFamily: fonts.regular }}
              className="mt-0.5 text-[12px] leading-4 text-muted"
            >
              {address}
            </Text>
          ) : null}
        </View>
        {distanceM != null ? <Badge tone="info">{formatDistance(distanceM)}</Badge> : null}
      </Pressable>

      {/* Metadados: "Aberto agora" (24h) / chip 24h + cidade/UF + horário */}
      {is_24h || cityLine || hours_text ? (
        <View className="flex-row flex-wrap items-center gap-2">
          {is_24h ? (
            <View
              style={CONTINUOUS}
              className="flex-row items-center gap-1 rounded-full bg-health-300/30 px-2.5 py-0.5"
            >
              <Clock size={12} color={colors.accent} />
              <Text style={{ fontFamily: fonts.semibold }} className="text-[11px] text-health-600">
                Aberto agora · 24h
              </Text>
            </View>
          ) : hours_text ? (
            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted" numberOfLines={1}>
              {hours_text}
            </Text>
          ) : null}
          {cityLine ? (
            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted" numberOfLines={1}>
              {cityLine}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Ações */}
      <View className="flex-row items-center gap-2 border-t border-line pt-3">
        {hasCoords ? (
          <ActionButton label="Rota" icon={RouteIcon} onPress={onRoute} loading={routing} />
        ) : null}
        {phone ? <ActionButton label="Ligar" icon={Phone} onPress={() => callPhone(phone)} /> : null}
        {whatsapp ? (
          <ActionButton
            label="WhatsApp"
            icon={MessageCircle}
            onPress={() => {
              const digits = whatsapp.replace(/\D/g, '');
              const num = digits.startsWith('55') ? digits : `55${digits}`;
              void Linking.openURL(`https://wa.me/${num}`);
            }}
          />
        ) : null}
        <IconAction label={`Compartilhar ${name}`} icon={Share2} onPress={onShare} tint={colors.muted} />
        <IconAction
          label={favorite ? `Remover ${name} dos favoritos` : `Favoritar ${name}`}
          icon={Heart}
          onPress={onToggleFav}
          tint={favorite ? colors.alert : colors.muted}
          fill={favorite}
          active={favorite}
        />
      </View>
    </Card>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onPress,
  loading,
}: {
  label: string;
  icon: LucideIcon;
  onPress?: () => void;
  loading?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
      style={CONTINUOUS}
      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface px-3 py-2.5 active:opacity-80"
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <>
          <Icon size={16} color={colors.primary} />
          <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-primary">
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function IconAction({
  label,
  icon: Icon,
  onPress,
  tint,
  fill,
  active,
}: {
  label: string;
  icon: LucideIcon;
  onPress?: () => void;
  tint: string;
  fill?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={CONTINUOUS}
      className={`h-10 w-10 items-center justify-center rounded-2xl border active:opacity-80 ${
        active ? 'border-rose-300 bg-rose-50' : 'border-line bg-surface'
      }`}
    >
      <Icon size={18} color={tint} fill={fill ? tint : 'transparent'} />
    </Pressable>
  );
}
