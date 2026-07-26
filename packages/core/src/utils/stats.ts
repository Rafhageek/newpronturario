/** Estatísticas de uma série numérica. */
export interface SeriesStats {
  count: number;
  avg: number;
  min: number;
  max: number;
}

export function computeStats(values: number[]): SeriesStats | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/** Variação percentual do primeiro ao último valor. Positivo = subiu. */
export function computeTrendPct(values: number[]): number | null {
  if (values.length < 2) return null;
  const first = values[0]!;
  const last = values[values.length - 1]!;
  if (first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

/**
 * Tendência SUAVIZADA: média do terço final vs. terço inicial (menos ruído que
 * ponta-a-ponta). Ideal para a seta ↑/↓ de vitais. Positivo = subiu.
 */
export function smoothedTrendPct(values: number[]): number | null {
  if (values.length < 4) return computeTrendPct(values);
  const k = Math.max(1, Math.floor(values.length / 3));
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const first = mean(values.slice(0, k));
  if (first === 0) return null;
  return ((mean(values.slice(-k)) - first) / Math.abs(first)) * 100;
}

/** Direção da tendência (com zona morta de 2% para "estável"). */
export function trendDirection(pct: number | null): 'up' | 'down' | 'flat' {
  if (pct == null || Math.abs(pct) < 2) return 'flat';
  return pct > 0 ? 'up' : 'down';
}

/** Frase de tendência em PT-BR (ex.: "subiu 8%"). */
export function trendLabel(pct: number | null): string {
  if (pct == null) return 'sem dados suficientes para tendência';
  const rounded = Math.round(Math.abs(pct));
  if (rounded < 2) return 'manteve-se estável no período';
  return `${pct > 0 ? 'subiu' : 'caiu'} ${rounded}% no período`;
}

/** IMC = peso(kg) / altura(m)². Retorna null sem altura/peso. */
export function computeBMI(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(bmi: number): { label: string; tone: 'ok' | 'attention' | 'alert' } {
  if (bmi < 18.5) return { label: 'Abaixo do peso', tone: 'attention' };
  if (bmi < 25) return { label: 'Peso adequado', tone: 'ok' };
  if (bmi < 30) return { label: 'Sobrepeso', tone: 'attention' };
  return { label: 'Obesidade (faixa)', tone: 'alert' };
}
