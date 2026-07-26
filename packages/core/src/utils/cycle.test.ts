import { describe, it, expect } from 'vitest';
import {
  phaseForDayInCycle,
  dayInCycleFor,
  currentPhase,
  findLastPeriodStart,
  averageCycleFromHistory,
  predictNextPeriod,
  daysUntilNextPeriod,
} from './cycle';

describe('phaseForDayInCycle (ciclo de 28, período de 5)', () => {
  it.each([
    [0, 'menstrual'],
    [4, 'menstrual'],
    [5, 'follicular'],
    [10, 'follicular'],
    [13, 'ovulatory'],
    [14, 'ovulatory'],
    [15, 'ovulatory'],
    [16, 'luteal'],
    [27, 'luteal'],
  ])('dia %i → %s', (day, phase) => {
    expect(phaseForDayInCycle(day, 28, 5)).toBe(phase);
  });
});

describe('dayInCycleFor', () => {
  it('5 dias após o início', () => {
    expect(dayInCycleFor('2026-01-06', '2026-01-01', 28)).toBe(5);
  });
  it('projeta com módulo (30 dias, ciclo 28 → dia 2)', () => {
    expect(dayInCycleFor('2026-01-31', '2026-01-01', 28)).toBe(2);
  });
  it('mesmo dia = 0', () => {
    expect(dayInCycleFor('2026-01-01', '2026-01-01', 28)).toBe(0);
  });
});

describe('currentPhase', () => {
  it('sem início → null', () => {
    expect(currentPhase('2026-01-10', null, 28)).toBeNull();
  });
  it('dia da menstruação', () => {
    expect(currentPhase('2026-01-02', '2026-01-01', 28)).toBe('menstrual');
  });
  it('janela ovulatória ~dia 14', () => {
    expect(currentPhase('2026-01-15', '2026-01-01', 28)).toBe('ovulatory');
  });
  it('fase lútea', () => {
    expect(currentPhase('2026-01-21', '2026-01-01', 28)).toBe('luteal');
  });
});

const periodsLogs = [
  // período 1: 01–04 jan
  { log_date: '2026-01-01', flow_level: 2 },
  { log_date: '2026-01-02', flow_level: 3 },
  { log_date: '2026-01-03', flow_level: 1 },
  { log_date: '2026-01-04', flow_level: 1 },
  // período 2: 29 jan (28 dias depois)
  { log_date: '2026-01-29', flow_level: 2 },
  { log_date: '2026-01-30', flow_level: 2 },
];

describe('findLastPeriodStart', () => {
  it('retorna o início do período mais recente', () => {
    expect(findLastPeriodStart(periodsLogs)?.toISOString().slice(0, 10)).toBe('2026-01-29');
  });
  it('sem fluxo → null', () => {
    expect(findLastPeriodStart([{ log_date: '2026-01-01', flow_level: 0 }])).toBeNull();
  });
  it('lista vazia → null', () => {
    expect(findLastPeriodStart([])).toBeNull();
  });
});

describe('averageCycleFromHistory', () => {
  it('dois inícios a 28 dias → 28', () => {
    expect(averageCycleFromHistory(periodsLogs)).toBe(28);
  });
  it('menos de 2 ciclos → null', () => {
    expect(averageCycleFromHistory(periodsLogs.slice(0, 4))).toBeNull();
  });
});

describe('predictNextPeriod', () => {
  it('usa a média do histórico (29 jan + 28 = 26 fev)', () => {
    expect(predictNextPeriod(periodsLogs, { average_cycle_days: 30 })?.toISOString().slice(0, 10)).toBe('2026-02-26');
  });
  it('sem histórico → null', () => {
    expect(predictNextPeriod([], { average_cycle_days: 28 })).toBeNull();
  });
  it('com 1 ciclo usa a média configurada', () => {
    const oneCycle = periodsLogs.slice(0, 4); // só o período 1
    expect(predictNextPeriod(oneCycle, { average_cycle_days: 30 })?.toISOString().slice(0, 10)).toBe('2026-01-31');
  });
});

describe('daysUntilNextPeriod', () => {
  it('conta os dias até a estimativa', () => {
    expect(daysUntilNextPeriod(periodsLogs, { average_cycle_days: 28 }, '2026-02-20')).toBe(6);
  });
  it('negativo quando atrasada', () => {
    expect(daysUntilNextPeriod(periodsLogs, { average_cycle_days: 28 }, '2026-03-01')!).toBeLessThan(0);
  });
  it('sem histórico → null', () => {
    expect(daysUntilNextPeriod([], { average_cycle_days: 28 }, '2026-02-20')).toBeNull();
  });
});
