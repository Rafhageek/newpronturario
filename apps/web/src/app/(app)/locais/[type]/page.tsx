'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  MapPin,
  Navigation,
  Phone,
  MessageCircle,
  Share2,
  Search,
  Clock,
  Pill,
  Building2,
  FlaskConical,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import {
  useHealthPlaces,
  withDistance,
  formatDistance,
  isPlaceType,
  PLACE_TYPES,
  PLACE_TYPE_LABEL,
  type PlaceType,
  type Coords,
  type HealthPlaceWithDistance,
} from '@hubpatients/supabase';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PlacesMap } from '@/components/places/places-map';

const TYPE_ICON: Record<PlaceType, LucideIcon> = {
  pharmacy: Pill,
  hospital: Building2,
  lab: FlaskConical,
  clinic: Stethoscope,
};

const EMPTY_TITLE: Record<PlaceType, string> = {
  pharmacy: 'Nenhuma farmácia cadastrada ainda.',
  hospital: 'Nenhum hospital cadastrado ainda.',
  lab: 'Nenhum laboratório cadastrado ainda.',
  clinic: 'Nenhuma clínica cadastrada ainda.',
};

export default function LocaisPage() {
  const params = useParams<{ type: string }>();
  const type: PlaceType = isPlaceType(params?.type) ? params.type : 'pharmacy';

  const [coords, setCoords] = useState<Coords | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [only24h, setOnly24h] = useState(false);

  // Localização do navegador (opcional). Negada → segue sem distância/ordenação.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const query = useHealthPlaces(type);
  const places = useMemo(() => withDistance(query.data ?? [], coords), [query.data, coords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return places.filter((p) => {
      if (only24h && !p.is_24h) return false;
      if (!q) return true;
      return [p.name, p.address, p.city].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [places, search, only24h]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 hp-page hp-page--community">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-primary">
          <MapPin className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Locais de saúde
          </h1>
          <p className="text-sm text-muted">Farmácias, hospitais, laboratórios e clínicas perto de você.</p>
        </div>
      </header>

      {/* Troca de tipo */}
      <nav className="flex flex-wrap gap-2">
        {PLACE_TYPES.map((t) => {
          const Icon = TYPE_ICON[t];
          const active = t === type;
          return (
            <Link
              key={t}
              href={`/locais/${t}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? 'border-sky-400/50 bg-sky-500/15 text-primary'
                  : 'border-line bg-surface text-fg-soft hover:bg-surface-2'
              }`}
            >
              <Icon className="h-4 w-4" /> {PLACE_TYPE_LABEL[t]}
            </Link>
          );
        })}
      </nav>

      {/* Busca + filtro 24h */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar ${PLACE_TYPE_LABEL[type].toLowerCase()}…`}
            className="h-full flex-1 bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnly24h((v) => !v)}
          aria-pressed={only24h}
          className={`inline-flex h-11 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium transition ${
            only24h ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'border-line bg-surface text-fg-soft hover:bg-surface-2'
          }`}
        >
          <Clock className="h-4 w-4" /> 24h
        </button>
      </div>

      {/* Mapa */}
      <PlacesMap places={filtered} userCoords={coords} selectedId={selectedId} onSelect={setSelectedId} />

      {/* Lista */}
      {query.isLoading ? (
        <ListSkeleton rows={4} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : places.length === 0 ? (
        <EmptyState icon={MapPin} title={EMPTY_TITLE[type]} description="O administrador ainda não cadastrou locais deste tipo." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Nada encontrado com esse filtro." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((p) => (
            <PlaceCard key={p.id} place={p} selected={selectedId === p.id} onSelect={() => setSelectedId(p.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PlaceCard({
  place,
  selected,
  onSelect,
}: {
  place: HealthPlaceWithDistance;
  selected: boolean;
  onSelect: () => void;
}) {
  const { name, address, city, state, phone, whatsapp, is_24h, lat, lng } = place;
  const cityLine = [city, state].filter(Boolean).join(' · ');
  const hasCoords = lat != null && lng != null;
  const mapsHref = hasCoords ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null;
  const waNumber = whatsapp ? (() => { const d = whatsapp.replace(/\D/g, ''); return d.startsWith('55') ? d : `55${d}`; })() : null;

  async function share() {
    const parts = [name, address, cityLine || null, mapsHref?.replace('/dir/?api=1&destination=', '/search/?api=1&query=') ?? null];
    const text = parts.filter(Boolean).join('\n');
    try {
      if (navigator.share) await navigator.share({ title: name, text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success('Copiado para a área de transferência.');
      }
    } catch {
      // cancelado pelo usuário — ignora
    }
  }

  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl border bg-surface p-4 transition ${
        selected ? 'border-primary ring-1 ring-sky-500/30' : 'border-line'
      }`}
    >
      <button type="button" onClick={onSelect} className="flex items-start gap-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-fg">{name}</p>
          {address ? <p className="mt-0.5 line-clamp-2 text-xs text-muted">{address}</p> : null}
        </div>
        {place.distanceM != null ? <Badge tone="info">{formatDistance(place.distanceM)}</Badge> : null}
      </button>

      {is_24h || cityLine ? (
        <div className="flex flex-wrap items-center gap-2">
          {is_24h ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <Clock className="h-3 w-3" /> Aberto agora · 24h
            </span>
          ) : null}
          {cityLine ? <span className="text-xs text-muted">{cityLine}</span> : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-t border-line pt-3">
        {mapsHref ? (
          <a href={mapsHref} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-primary hover:bg-surface-2">
            <Navigation className="h-4 w-4" /> Rota
          </a>
        ) : null}
        {phone ? (
          <a href={`tel:${phone.replace(/\s/g, '')}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-primary hover:bg-surface-2">
            <Phone className="h-4 w-4" /> Ligar
          </a>
        ) : null}
        {waNumber ? (
          <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-primary hover:bg-surface-2">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        ) : null}
        <button type="button" onClick={share} aria-label={`Compartilhar ${name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:bg-surface-2">
          <Share2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
