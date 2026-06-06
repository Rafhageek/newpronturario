/** Histórico além de 90 dias é Plus (Free vê 7/30/90 dias). */
export const FREE_HISTORY_LIMIT_DAYS = 90;

export interface MetricZone {
  max: number; // limite superior da faixa (exclusivo)
  label: string;
  tone: 'ok' | 'attention' | 'alert';
}

/** Faixas de glicemia de jejum (mg/dL) — referência, NÃO diagnóstico. */
export const GLUCOSE_ZONES: MetricZone[] = [
  { max: 100, label: 'Normal', tone: 'ok' },
  { max: 126, label: 'Pré-diabetes', tone: 'attention' },
  { max: Infinity, label: 'Diabetes (faixa)', tone: 'alert' },
];

export function glucoseZone(value: number): MetricZone {
  return GLUCOSE_ZONES.find((z) => value < z.max) ?? GLUCOSE_ZONES[GLUCOSE_ZONES.length - 1]!;
}
