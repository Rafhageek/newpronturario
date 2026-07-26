/**
 * Helpers puros de controle de estoque de medicação.
 *
 * Estoque é praticidade para crônicos: só avisa que a caixa vai acabar.
 * Tudo aqui é estimativa baseada na frequência cadastrada — não substitui o
 * acompanhamento do médico.
 */

import type { MedicationFrequency } from '../types/db';

/** Doses por dia a partir da frequência + nº de horários. null = sem previsão. */
export function dailyDosesFromMed(
  frequency: MedicationFrequency,
  times: string[] | null | undefined,
): number | null {
  const n = times?.length ?? 0;
  if (frequency === 'as_needed') return null;
  if (frequency === 'weekly') return Math.max(1, n) / 7;
  return Math.max(1, n); // daily
}

/** Dias até o estoque acabar. null se não rastreado ou sem previsão. */
export function calculateDaysRemaining(
  stockCount: number | null | undefined,
  dailyDoses: number | null | undefined,
): number | null {
  if (stockCount == null) return null;
  if (dailyDoses == null || dailyDoses <= 0) return null;
  return Math.floor(stockCount / dailyDoses);
}

/** Deve alertar? (estoque rastreado e dias restantes ≤ limiar). */
export function shouldAlertLowStock(
  stockCount: number | null | undefined,
  dailyDoses: number | null | undefined,
  thresholdDays: number,
): boolean {
  const days = calculateDaysRemaining(stockCount, dailyDoses);
  return days != null && days <= thresholdDays;
}

export interface StockLike {
  stock_count: number | null;
  stock_unit: string;
  stock_low_threshold_days: number;
  frequency: MedicationFrequency;
  times: string[];
}

const dayWord = (n: number) => (n === 1 ? 'dia' : 'dias');

/**
 * Texto pronto para a UI:
 *  - sem rastreio → "Sem controle de estoque"
 *  - acabando → "Acabando! 2 dias"
 *  - normal → "12 comprimidos · ~6 dias"
 *  - sem previsão (uso conforme necessário) → "12 comprimidos"
 */
export function formatStockStatus(med: StockLike): string {
  if (med.stock_count == null) return 'Sem controle de estoque';
  const daily = dailyDosesFromMed(med.frequency, med.times);
  const days = calculateDaysRemaining(med.stock_count, daily);
  const base = `${med.stock_count} ${med.stock_unit}`;
  if (days == null) return base;
  if (days <= med.stock_low_threshold_days) return `Acabando! ${days} ${dayWord(days)}`;
  return `${base} · ~${days} ${dayWord(days)}`;
}

/** Conveniência: dias restantes diretamente de um medicamento. */
export function daysRemainingForMed(med: StockLike): number | null {
  return calculateDaysRemaining(med.stock_count, dailyDosesFromMed(med.frequency, med.times));
}
