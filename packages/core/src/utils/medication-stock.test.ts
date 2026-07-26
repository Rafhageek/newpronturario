import { describe, it, expect } from 'vitest';
import {
  dailyDosesFromMed,
  calculateDaysRemaining,
  shouldAlertLowStock,
  formatStockStatus,
  daysRemainingForMed,
} from './medication-stock';

describe('dailyDosesFromMed', () => {
  it('diário com 2 horários → 2 doses/dia', () => {
    expect(dailyDosesFromMed('daily', ['08:00', '20:00'])).toBe(2);
  });
  it('diário sem horários → 1 dose/dia (mínimo)', () => {
    expect(dailyDosesFromMed('daily', [])).toBe(1);
  });
  it('semanal com 1 horário → 1/7 por dia', () => {
    expect(dailyDosesFromMed('weekly', ['09:00'])).toBeCloseTo(1 / 7, 6);
  });
  it('uso conforme necessário → null', () => {
    expect(dailyDosesFromMed('as_needed', ['08:00'])).toBeNull();
  });
});

describe('calculateDaysRemaining', () => {
  it('30 comprimidos, 2/dia → 15 dias', () => {
    expect(calculateDaysRemaining(30, 2)).toBe(15);
  });
  it('arredonda para baixo (10 / 3 → 3)', () => {
    expect(calculateDaysRemaining(10, 3)).toBe(3);
  });
  it('estoque fracionário no dia (1/7) → multiplica', () => {
    expect(calculateDaysRemaining(4, 1 / 7)).toBe(28);
  });
  it('sem estoque (null) → null', () => {
    expect(calculateDaysRemaining(null, 2)).toBeNull();
  });
  it('0 doses/dia → null', () => {
    expect(calculateDaysRemaining(30, 0)).toBeNull();
  });
  it('doses null (as_needed) → null', () => {
    expect(calculateDaysRemaining(30, null)).toBeNull();
  });
  it('estoque 0 → 0 dias', () => {
    expect(calculateDaysRemaining(0, 2)).toBe(0);
  });
});

describe('shouldAlertLowStock', () => {
  it('4 comp, 2/dia (=2 dias), limiar 5 → alerta', () => {
    expect(shouldAlertLowStock(4, 2, 5)).toBe(true);
  });
  it('30 comp, 2/dia (=15 dias), limiar 5 → não alerta', () => {
    expect(shouldAlertLowStock(30, 2, 5)).toBe(false);
  });
  it('exatamente no limiar → alerta', () => {
    expect(shouldAlertLowStock(10, 2, 5)).toBe(true); // 5 dias
  });
  it('sem rastreio → não alerta', () => {
    expect(shouldAlertLowStock(null, 2, 5)).toBe(false);
  });
});

const med = (over: Partial<Parameters<typeof formatStockStatus>[0]> = {}) => ({
  stock_count: 12,
  stock_unit: 'comprimidos',
  stock_low_threshold_days: 5,
  frequency: 'daily' as const,
  times: ['08:00', '20:00'],
  ...over,
});

describe('formatStockStatus', () => {
  it('normal → "12 comprimidos · ~6 dias"', () => {
    expect(formatStockStatus(med())).toBe('12 comprimidos · ~6 dias');
  });
  it('acabando → "Acabando! 2 dias"', () => {
    expect(formatStockStatus(med({ stock_count: 4 }))).toBe('Acabando! 2 dias');
  });
  it('sem controle (null) → texto neutro', () => {
    expect(formatStockStatus(med({ stock_count: null }))).toBe('Sem controle de estoque');
  });
  it('sem previsão (as_needed) → só a quantidade', () => {
    expect(formatStockStatus(med({ frequency: 'as_needed' }))).toBe('12 comprimidos');
  });
  it('singular "1 dia"', () => {
    expect(formatStockStatus(med({ stock_count: 2 }))).toBe('Acabando! 1 dia');
  });
  it('unidade customizada (ml)', () => {
    expect(formatStockStatus(med({ stock_count: 100, stock_unit: 'ml', times: ['08:00'] }))).toBe(
      '100 ml · ~100 dias',
    );
  });
});

describe('daysRemainingForMed', () => {
  it('combina frequência + estoque', () => {
    expect(daysRemainingForMed(med())).toBe(6); // 12 / 2
  });
});
