import { decodePolyline } from '@/lib/directions';
import { withDistance, haversineM, type HealthPlace } from '@/lib/health-places';
import { formatDistance } from '@/lib/pharmacies';

/**
 * Testes das funções PURAS da feature de mapa/locais — rodam headless, sem mapa
 * nativo. Cobrem o decoder de polyline (rota), a distância/ordenação e a
 * formatação de distância (que tinha o bug do "NaN km").
 */

function place(id: string, lat: number | null, lng: number | null): HealthPlace {
  return {
    id,
    type: 'pharmacy',
    name: `Local ${id}`,
    address: null,
    city: null,
    state: null,
    phone: null,
    whatsapp: null,
    hours_text: null,
    is_24h: false,
    lat,
    lng,
    link: null,
    notes: null,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('decodePolyline', () => {
  it('decodifica o exemplo canônico do Google', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toHaveLength(3);
    expect(pts[0]!.lat).toBeCloseTo(38.5, 5);
    expect(pts[0]!.lng).toBeCloseTo(-120.2, 5);
    expect(pts[1]!.lat).toBeCloseTo(40.7, 5);
    expect(pts[1]!.lng).toBeCloseTo(-120.95, 5);
    expect(pts[2]!.lat).toBeCloseTo(43.252, 5);
    expect(pts[2]!.lng).toBeCloseTo(-126.453, 5);
  });

  it('retorna [] para string vazia', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('haversineM', () => {
  it('mede ~111 km por grau de latitude no equador', () => {
    const d = haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('é zero para o mesmo ponto', () => {
    expect(haversineM({ lat: -8.05, lng: -34.9 }, { lat: -8.05, lng: -34.9 })).toBe(0);
  });
});

describe('withDistance', () => {
  const user = { lat: -8.0, lng: -34.9 };

  it('ordena por proximidade e joga os sem-coordenada pro fim', () => {
    const far = place('far', -8.5, -35.4);
    const near = place('near', -8.01, -34.91);
    const noCoord = place('noCoord', null, null);
    const out = withDistance([far, noCoord, near], user);
    expect(out.map((p) => p.id)).toEqual(['near', 'far', 'noCoord']);
    expect(out[0]!.distanceM).toBeLessThan(out[1]!.distanceM!);
    expect(out[2]!.distanceM).toBeNull();
  });

  it('sem localização do usuário, distância é null e a ordem é preservada', () => {
    const out = withDistance([place('a', -8, -34), place('b', -9, -35)], null);
    expect(out.every((p) => p.distanceM === null)).toBe(true);
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('formatDistance', () => {
  it('formata metros e quilômetros (vírgula decimal pt-BR)', () => {
    expect(formatDistance(443)).toBe('443 m');
    expect(formatDistance(1500)).toBe('1,5 km');
    expect(formatDistance(999)).toBe('999 m');
  });

  it('não devolve "NaN km" para entrada inválida (regressão)', () => {
    expect(formatDistance(NaN)).toBe('');
    expect(formatDistance(-5)).toBe('');
    expect(formatDistance(Infinity)).toBe('');
  });
});
