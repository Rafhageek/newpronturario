/**
 * Helpers puros de crescimento infantil — sem I/O.
 *
 * O cálculo de percentil usa o método LMS oficial da OMS (WHO Child Growth
 * Standards). Os PARÂMETROS L, M, S vêm da tabela oficial `who_growth_standards`
 * (semeada à parte) — aqui só está a MATEMÁTICA, que é pública e padrão.
 * O app apenas plota/posiciona o percentil; nunca julga ("acima/abaixo do peso").
 */

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

/**
 * Idade em meses inteiros (completados) entre nascimento e a data de referência.
 * Usa componentes UTC para casar com o parsing de strings "YYYY-MM-DD" (que o
 * JS interpreta como UTC) e evitar deslocamento de dia em fusos negativos.
 */
export function ageInMonths(birthDate: Date | string, today: Date | string): number {
  const b = toDate(birthDate);
  const t = toDate(today);
  let months = (t.getUTCFullYear() - b.getUTCFullYear()) * 12 + (t.getUTCMonth() - b.getUTCMonth());
  if (t.getUTCDate() < b.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/** Idade legível em pt-BR (ex.: "2 anos e 3 meses"). */
export function ageLabel(birthDate: Date | string, today: Date | string): string {
  const m = ageInMonths(birthDate, today);
  const years = Math.floor(m / 12);
  const months = m % 12;
  const yPart = years > 0 ? `${years} ${years === 1 ? 'ano' : 'anos'}` : '';
  const mPart = months > 0 ? `${months} ${months === 1 ? 'mês' : 'meses'}` : '';
  if (yPart && mPart) return `${yPart} e ${mPart}`;
  return yPart || mPart || 'recém-nascido';
}

// ── Método LMS ──────────────────────────────────────────────────────────────

export interface Lms {
  l: number;
  m: number;
  s: number;
}

/** Z-score LMS: z = ((X/M)^L − 1) / (L·S), ou ln(X/M)/S quando L = 0. */
export function lmsZScore(value: number, { l, m, s }: Lms): number {
  if (value <= 0 || m <= 0 || s === 0) return NaN;
  if (Math.abs(l) < 1e-7) return Math.log(value / m) / s;
  return (Math.pow(value / m, l) - 1) / (l * s);
}

// Função erro (Abramowitz & Stegun 7.1.26) → CDF normal padrão.
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Converte z-score em percentil clínico exibível (1–99). */
export function zToPercentile(z: number): number {
  if (Number.isNaN(z)) return NaN;
  return Math.min(99, Math.max(1, Math.round(normalCdf(z) * 100)));
}

/** Percentil de um valor dado os parâmetros LMS daquela idade. */
export function percentileFromLms(value: number, lms: Lms): number {
  return zToPercentile(lmsZScore(value, lms));
}

/**
 * Interpola linearmente os parâmetros LMS entre os pontos oficiais da OMS para
 * uma idade `x` qualquer. `points` deve estar ordenado por `x` crescente.
 */
export function interpolateLms(points: Array<{ x: number } & Lms>, x: number): Lms | null {
  if (points.length === 0) return null;
  if (x <= points[0]!.x) return { l: points[0]!.l, m: points[0]!.m, s: points[0]!.s };
  const last = points[points.length - 1]!;
  if (x >= last.x) return { l: last.l, m: last.m, s: last.s };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (x <= b.x) {
      const f = (x - a.x) / (b.x - a.x);
      return {
        l: a.l + (b.l - a.l) * f,
        m: a.m + (b.m - a.m) * f,
        s: a.s + (b.s - a.s) * f,
      };
    }
  }
  return { l: last.l, m: last.m, s: last.s };
}

/** Percentil (1–99) de um valor para uma idade `x`, a partir da curva da OMS. */
export function percentileForAge(
  value: number,
  x: number,
  points: Array<{ x: number } & Lms>,
): number | null {
  const lms = interpolateLms(points, x);
  if (!lms) return null;
  return percentileFromLms(value, lms);
}

/** Inverso da CDF normal padrão (probit) — algoritmo de Peter Acklam. */
export function probit(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
}

/** Valor correspondente a um z-score, dados os parâmetros LMS (inverso do LMS). */
export function valueFromLms(z: number, { l, m, s }: Lms): number {
  if (Math.abs(l) < 1e-7) return m * Math.exp(s * z);
  return m * Math.pow(1 + l * s * z, 1 / l);
}

/**
 * Valor da curva de um PERCENTIL (ex.: 50) para uma idade `x` — usado para
 * desenhar as linhas P3/P15/P50/P85/P97 dos gráficos da OMS.
 */
export function valueAtPercentileForAge(
  percentile: number,
  x: number,
  points: Array<{ x: number } & Lms>,
): number | null {
  const lms = interpolateLms(points, x);
  if (!lms) return null;
  return valueFromLms(probit(percentile / 100), lms);
}

// ── Vacinas ─────────────────────────────────────────────────────────────────

export interface VaccineScheduleItem {
  code: string;
  recommended_age_months: number;
}

export type VaccineStatus = 'overdue' | 'due' | 'upcoming';

export interface DueVaccine extends VaccineScheduleItem {
  status: VaccineStatus;
}

/**
 * Cruza o calendário (PNI) com as vacinas já aplicadas e classifica as
 * pendentes pela idade atual da criança. Não julga — só organiza.
 */
export function nextDueVaccines(
  birthDate: Date | string,
  appliedCodes: Iterable<string>,
  schedule: VaccineScheduleItem[],
  today: Date | string,
): DueVaccine[] {
  const applied = new Set(appliedCodes);
  const months = ageInMonths(birthDate, today);
  return schedule
    .filter((v) => !applied.has(v.code))
    .map((v) => {
      let status: VaccineStatus;
      if (v.recommended_age_months < months) status = 'overdue';
      else if (v.recommended_age_months === months) status = 'due';
      else status = 'upcoming';
      return { ...v, status };
    })
    .sort((a, b) => a.recommended_age_months - b.recommended_age_months);
}
