/**
 * Helpers puros do mapa de dor — sem I/O.
 *
 * São agregações descritivas para o usuário comunicar ao médico. NÃO
 * interpretam nem diagnosticam ("isso parece hérnia" é proibido).
 */

const MS_PER_DAY = 86_400_000;

export interface PainPointLike {
  body_region: string;
  intensity: number;
  created_at: string;
}

export interface RegionSummary {
  region: string;
  count: number;
  avgIntensity: number;
  maxIntensity: number;
}

/**
 * Ranking das regiões mais afetadas no período (últimos `days` dias).
 * Ordena por nº de registros e, em empate, pela intensidade média.
 */
export function summarizePainHistory(
  points: PainPointLike[],
  days = 30,
  now: Date | string = new Date(),
): RegionSummary[] {
  const cutoff = (now instanceof Date ? now.getTime() : new Date(now).getTime()) - days * MS_PER_DAY;
  const recent = points.filter((p) => new Date(p.created_at).getTime() >= cutoff);

  const byRegion = new Map<string, { sum: number; count: number; max: number }>();
  for (const p of recent) {
    const cur = byRegion.get(p.body_region) ?? { sum: 0, count: 0, max: 0 };
    cur.sum += p.intensity;
    cur.count += 1;
    cur.max = Math.max(cur.max, p.intensity);
    byRegion.set(p.body_region, cur);
  }

  return [...byRegion.entries()]
    .map(([region, v]) => ({
      region,
      count: v.count,
      avgIntensity: Math.round((v.sum / v.count) * 10) / 10,
      maxIntensity: v.max,
    }))
    .sort((a, b) => b.count - a.count || b.avgIntensity - a.avgIntensity);
}

export interface PainMigration {
  from: string;
  to: string;
}

/**
 * Detecta migração da dor: a região predominante na 1ª metade do período
 * (por data) difere da predominante na 2ª metade. Retorna null se não houver
 * dados suficientes (precisa de pelo menos 2 registros em cada metade).
 */
export function painMigrationDetection(points: PainPointLike[]): PainMigration | null {
  if (points.length < 4) return null;
  const sorted = [...points].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const mid = Math.floor(sorted.length / 2);
  const first = sorted.slice(0, mid);
  const second = sorted.slice(mid);
  if (first.length < 2 || second.length < 2) return null;

  const top = (arr: PainPointLike[]) => summarizePainHistory(arr, 100000, sorted[sorted.length - 1]!.created_at)[0]?.region;
  const from = top(first);
  const to = top(second);
  if (!from || !to || from === to) return null;
  return { from, to };
}
