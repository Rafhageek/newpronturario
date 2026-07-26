/**
 * Helpers puros da jornada gestante — sem I/O, fáceis de testar (web + mobile).
 *
 * Importante (ética reforçada): estas funções apenas CALCULAM e retornam faixas
 * de referência. NÃO julgam, NÃO diagnosticam e NÃO inferem risco. A
 * interpretação é sempre do profissional que faz o pré-natal.
 */

const MS_PER_DAY = 86_400_000;
const GESTATION_DAYS = 280; // 40 semanas (regra de Naegele)

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / MS_PER_DAY);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

export type Trimester = 1 | 2 | 3;

export interface GestationalAge {
  weeks: number;
  days: number;
  totalDays: number;
  trimester: Trimester;
}

/** 1º: 0–13 sem · 2º: 14–27 sem · 3º: 28+ sem. */
export function trimesterOf(weeks: number): Trimester {
  if (weeks < 14) return 1;
  if (weeks < 28) return 2;
  return 3;
}

/**
 * Idade gestacional a partir da DUM (LMP) ou da DPP (due date).
 * DPP = DUM + 280 dias, então derivamos a DUM quando só houver a DPP.
 * Retorna null se não há referência ou se a data é futura.
 */
export function calculateGestationalAge(
  input: { lmpDate?: Date | string | null; dueDate?: Date | string | null },
  today: Date | string,
): GestationalAge | null {
  const now = toDate(today);
  const lmp = input.lmpDate
    ? toDate(input.lmpDate)
    : input.dueDate
      ? addDays(toDate(input.dueDate), -GESTATION_DAYS)
      : null;
  if (!lmp) return null;

  const totalDays = diffDays(now, lmp);
  if (totalDays < 0) return null;

  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return { weeks, days, totalDays, trimester: trimesterOf(weeks) };
}

/** Semanas restantes até a DPP (0 se já passou). */
export function weeksUntilDue(dueDate: Date | string, today: Date | string): number {
  const remaining = diffDays(toDate(dueDate), toDate(today));
  return Math.max(0, Math.floor(remaining / 7));
}

type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

/** Categoria de IMC pré-gestacional (apenas para a faixa IOM — não é juízo). */
export function prePregnancyBmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

// Ganho total recomendado por categoria (IOM 2009), em kg.
const IOM_TOTAL: Record<BmiCategory, [number, number]> = {
  underweight: [12.5, 18],
  normal: [11.5, 16],
  overweight: [7, 11.5],
  obese: [5, 9],
};
// Ganho recomendado no 1º trimestre (kg) — comum a todas as categorias.
const IOM_FIRST_TRIMESTER: [number, number] = [0.5, 2];

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface WeightGainRange {
  min: number;
  max: number;
}

/**
 * Faixa de ganho de peso ACUMULADO recomendada até a semana informada,
 * baseada no IMC pré-gestacional (IOM 2009). Interpola linearmente entre o
 * ganho do 1º trimestre e o ganho total até a 40ª semana. Apenas referência.
 */
export function weightGainRange(prePregnancyBMI: number, week: number): WeightGainRange {
  const cat = prePregnancyBmiCategory(prePregnancyBMI);
  const [totalMin, totalMax] = IOM_TOTAL[cat];
  const [firstMin, firstMax] = IOM_FIRST_TRIMESTER;
  const w = Math.max(1, Math.min(40, week));

  if (w <= 13) {
    const f = w / 13;
    return { min: round1(firstMin * f), max: round1(firstMax * f) };
  }
  const progress = (w - 13) / (40 - 13);
  return {
    min: round1(firstMin + (totalMin - firstMin) * progress),
    max: round1(firstMax + (totalMax - firstMax) * progress),
  };
}

export interface NextConsult {
  nextWeek: number;
  weeksUntil: number;
}

/**
 * Próxima consulta SUGERIDA conforme a cadência do MS (pré-natal de baixo risco):
 * mensal até 28 sem, quinzenal de 28 a 36, semanal a partir de 36.
 * Recebe a semana da última consulta e a semana atual. Apenas sugestão.
 */
export function nextScheduledConsult(lastConsultWeek: number, currentWeek: number): NextConsult {
  const interval = currentWeek < 28 ? 4 : currentWeek < 36 ? 2 : 1;
  const nextWeek = lastConsultWeek + interval;
  return { nextWeek, weeksUntil: Math.max(0, nextWeek - currentWeek) };
}
