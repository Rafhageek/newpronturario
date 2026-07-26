/** Histórico além de 90 dias é Plus (Free vê 7/30/90 dias). */
export const FREE_HISTORY_LIMIT_DAYS = 90;

/**
 * Descreve apenas o intervalo numérico de uma glicemia registrada. O app não
 * conhece contexto como jejum, gestação, sintomas ou orientação profissional e,
 * portanto, não associa o valor a diagnósticos.
 */
export function describeGlucoseRange(value: number): string {
  if (value < 100) return 'abaixo de 100 mg/dL';
  if (value < 126) return 'de 100 a menos de 126 mg/dL';
  return '126 mg/dL ou mais';
}
