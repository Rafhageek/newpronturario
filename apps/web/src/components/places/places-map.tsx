'use client';

import { useCallback, useEffect, useRef } from 'react';
import { GoogleMap, MarkerF, useLoadScript } from '@react-google-maps/api';
import { MapPinned } from 'lucide-react';
import type { HealthPlaceWithDistance, Coords } from '@hubpatients/supabase';

/**
 * Mapa interativo (Google Maps JS) com os locais cadastrados. Abre enquadrando
 * você + todos os locais; tocar num card centraliza/aproxima o pino (selectedId)
 * e o pino selecionado fica verde. Requer NEXT_PUBLIC_GOOGLE_MAPS_KEY e a
 * "Maps JavaScript API" habilitada na chave.
 */
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';

type Pin = HealthPlaceWithDistance & { lat: number; lng: number };

export function PlacesMap({
  places,
  userCoords,
  selectedId,
  onSelect,
  height = 440,
}: {
  places: HealthPlaceWithDistance[];
  userCoords: Coords | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  height?: number;
}) {
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: MAPS_KEY });
  const mapRef = useRef<google.maps.Map | null>(null);

  const pins = places.filter((p): p is Pin => p.lat != null && p.lng != null);

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const coords = [
      ...pins.map((p) => ({ lat: p.lat, lng: p.lng })),
      ...(userCoords ? [userCoords] : []),
    ];
    if (coords.length === 0) {
      map.setCenter({ lat: -14.235, lng: -51.925 }); // Brasil
      map.setZoom(4);
      return;
    }
    if (coords.length === 1) {
      map.setCenter(coords[0]!);
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    coords.forEach((c) => bounds.extend(c));
    map.fitBounds(bounds, 64);
  }, [pins, userCoords]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      fitAll();
    },
    [fitAll],
  );

  // Centraliza/aproxima no pino selecionado.
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const p = pins.find((x) => x.id === selectedId);
    if (p) {
      mapRef.current.panTo({ lat: p.lat, lng: p.lng });
      if ((mapRef.current.getZoom() ?? 0) < 15) mapRef.current.setZoom(15);
    }
  }, [selectedId]);

  if (!MAPS_KEY) {
    return (
      <Placeholder>
        Configure <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> para exibir o mapa.
      </Placeholder>
    );
  }
  if (loadError) {
    return <Placeholder>Não foi possível carregar o mapa. Verifique a chave do Google Maps.</Placeholder>;
  }
  if (!isLoaded) {
    return (
      <div
        style={{ height }}
        className="flex animate-pulse items-center justify-center rounded-2xl border border-line bg-surface-2 text-sm text-muted"
      >
        Carregando mapa…
      </div>
    );
  }

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl border border-line">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        onLoad={onLoad}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        }}
      >
        {userCoords ? (
          <MarkerF
            position={userCoords}
            title="Você está aqui"
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: '#2563eb',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        ) : null}
        {pins.map((p) => {
          const sel = p.id === selectedId;
          return (
            <MarkerF
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              title={p.name}
              onClick={() => onSelect(p.id)}
              zIndex={sel ? 10 : 1}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: sel ? 11 : 8,
                fillColor: sel ? '#059669' : '#0284c7',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
            />
          );
        })}
      </GoogleMap>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface-2 px-6 text-center text-sm text-muted">
      <MapPinned className="h-6 w-6 text-muted" />
      <p>{children}</p>
    </div>
  );
}
