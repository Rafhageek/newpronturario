/**
 * Helpers puros do ciclo menstrual.
 *
 * ÉTICA: tudo aqui é ESTIMATIVA baseada em histórico — nunca diagnóstico nem
 * método contraceptivo. As previsões podem variar; o app não garante exatidão.
 */

const MS_PER_DAY = 86_400_000;

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function diffDays(a: Date | string, b: Date | string): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / MS_PER_DAY);
}

function addDays(d: Date | string, days: number): Date {
  return new Date(toDate(d).getTime() + days * MS_PER_DAY);
}

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface CycleLogLike {
  log_date: string;
  flow_level: number;
}

/**
 * Fase do ciclo para um dia, projetando a partir do último início de
 * menstruação. Modelo simples: ovulação ≈ (cicloLength − 14).
 */
export function phaseForDayInCycle(
  dayInCycle: number,
  cycleLength: number,
  periodDays = 5,
): CyclePhase {
  const ovulation = cycleLength - 14;
  if (dayInCycle < periodDays) return 'menstrual';
  if (Math.abs(dayInCycle - ovulation) <= 1) return 'ovulatory';
  if (dayInCycle < ovulation) return 'follicular';
  return 'luteal';
}

/** Dia dentro do ciclo (0-based) para uma data, projetado a partir do início. */
export function dayInCycleFor(
  date: Date | string,
  lastPeriodStart: Date | string,
  cycleLength: number,
): number {
  const raw = diffDays(date, lastPeriodStart) % cycleLength;
  return ((raw % cycleLength) + cycleLength) % cycleLength;
}

/** Fase atual (ou null se não há histórico de início). */
export function currentPhase(
  today: Date | string,
  lastPeriodStart: Date | string | null,
  cycleLength: number,
  periodDays = 5,
): CyclePhase | null {
  if (!lastPeriodStart) return null;
  return phaseForDayInCycle(dayInCycleFor(today, lastPeriodStart, cycleLength), cycleLength, periodDays);
}

/**
 * Último início de menstruação a partir dos registros: dia com fluxo > 0 cujo
 * dia anterior NÃO teve fluxo (começo de um período). Retorna a data mais recente.
 */
export function findLastPeriodStart(logs: CycleLogLike[]): Date | null {
  const flow = logs
    .filter((l) => l.flow_level > 0)
    .map((l) => l.log_date)
    .sort(); // asc
  if (flow.length === 0) return null;
  const set = new Set(flow);
  let lastStart: string | null = null;
  for (const d of flow) {
    const prev = addDays(d, -1).toISOString().slice(0, 10);
    if (!set.has(prev)) lastStart = d; // é um início de período
  }
  return lastStart ? toDate(lastStart) : null;
}

/** Comprimento médio do ciclo a partir do histórico (ou null se insuficiente). */
export function averageCycleFromHistory(logs: CycleLogLike[]): number | null {
  const flow = logs
    .filter((l) => l.flow_level > 0)
    .map((l) => l.log_date)
    .sort();
  const set = new Set(flow);
  const starts: Date[] = [];
  for (const d of flow) {
    const prev = addDays(d, -1).toISOString().slice(0, 10);
    if (!set.has(prev)) starts.push(toDate(d));
  }
  if (starts.length < 2) return null;
  let total = 0;
  for (let i = 1; i < starts.length; i++) total += diffDays(starts[i]!, starts[i - 1]!);
  return Math.round(total / (starts.length - 1));
}

/**
 * Próxima menstruação ESTIMADA. Usa a média do histórico quando há ciclos
 * suficientes, senão a média configurada. Retorna null sem histórico.
 */
export function predictNextPeriod(
  logs: CycleLogLike[],
  settings: { average_cycle_days: number },
): Date | null {
  const lastStart = findLastPeriodStart(logs);
  if (!lastStart) return null;
  const cycleLength = averageCycleFromHistory(logs) ?? settings.average_cycle_days;
  return addDays(lastStart, cycleLength);
}

/** Dias até a próxima menstruação estimada (pode ser negativo se atrasada). */
export function daysUntilNextPeriod(
  logs: CycleLogLike[],
  settings: { average_cycle_days: number },
  today: Date | string,
): number | null {
  const next = predictNextPeriod(logs, settings);
  if (!next) return null;
  return diffDays(next, today);
}
