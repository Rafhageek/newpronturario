import { describe, it, expect } from 'vitest';
import {
  calculateGestationalAge,
  trimesterOf,
  weeksUntilDue,
  prePregnancyBmiCategory,
  weightGainRange,
  nextScheduledConsult,
} from './pregnancy';

describe('calculateGestationalAge', () => {
  it('calcula a partir da DUM (10 semanas)', () => {
    const ga = calculateGestationalAge({ lmpDate: '2026-01-01' }, '2026-03-12'); // 70 dias
    expect(ga).toEqual({ weeks: 10, days: 0, totalDays: 70, trimester: 1 });
  });

  it('calcula dias parciais (10 sem e 3 dias)', () => {
    const ga = calculateGestationalAge({ lmpDate: '2026-01-01' }, '2026-03-15'); // 73 dias
    expect(ga).toMatchObject({ weeks: 10, days: 3, trimester: 1 });
  });

  it('deriva a DUM a partir da DPP', () => {
    // DPP 2026-10-08 → DUM 2026-01-01; em 2026-03-12 → 10 semanas
    const ga = calculateGestationalAge({ dueDate: '2026-10-08' }, '2026-03-12');
    expect(ga?.weeks).toBe(10);
    expect(ga?.trimester).toBe(1);
  });

  it('identifica 2º trimestre (20 semanas)', () => {
    const ga = calculateGestationalAge({ lmpDate: '2026-01-01' }, '2026-05-21'); // 140 dias
    expect(ga).toMatchObject({ weeks: 20, trimester: 2 });
  });

  it('identifica 3º trimestre (32 semanas)', () => {
    const ga = calculateGestationalAge({ lmpDate: '2026-01-01' }, '2026-08-13'); // 224 dias
    expect(ga).toMatchObject({ weeks: 32, trimester: 3 });
  });

  it('retorna null sem nenhuma referência', () => {
    expect(calculateGestationalAge({}, '2026-03-12')).toBeNull();
  });

  it('retorna null para DUM no futuro', () => {
    expect(calculateGestationalAge({ lmpDate: '2026-05-01' }, '2026-03-12')).toBeNull();
  });

  it('dia exato da DUM = 0 semanas', () => {
    expect(calculateGestationalAge({ lmpDate: '2026-01-01' }, '2026-01-01')).toMatchObject({
      weeks: 0,
      days: 0,
      trimester: 1,
    });
  });

  it('aceita objetos Date', () => {
    const ga = calculateGestationalAge({ lmpDate: new Date('2026-01-01') }, new Date('2026-03-12'));
    expect(ga?.weeks).toBe(10);
  });
});

describe('trimesterOf', () => {
  it.each([
    [0, 1],
    [13, 1],
    [14, 2],
    [27, 2],
    [28, 3],
    [40, 3],
    [42, 3],
    [1, 1],
  ])('semana %i → %iº trimestre', (week, tri) => {
    expect(trimesterOf(week)).toBe(tri);
  });
});

describe('weeksUntilDue', () => {
  it('faltam 10 semanas', () => {
    expect(weeksUntilDue('2026-03-12', '2026-01-01')).toBe(10);
  });
  it('mesma data = 0', () => {
    expect(weeksUntilDue('2026-01-01', '2026-01-01')).toBe(0);
  });
  it('data passada = 0 (sem negativo)', () => {
    expect(weeksUntilDue('2026-01-01', '2026-03-12')).toBe(0);
  });
  it('arredonda para baixo (13 dias → 1 semana)', () => {
    expect(weeksUntilDue('2026-01-14', '2026-01-01')).toBe(1);
  });
});

describe('prePregnancyBmiCategory', () => {
  it.each([
    [17, 'underweight'],
    [18.5, 'normal'],
    [22, 'normal'],
    [24.9, 'normal'],
    [25, 'overweight'],
    [29.9, 'overweight'],
    [30, 'obese'],
    [35, 'obese'],
  ])('IMC %f → %s', (bmi, cat) => {
    expect(prePregnancyBmiCategory(bmi)).toBe(cat);
  });
});

describe('weightGainRange', () => {
  it('normal na 40ª semana → faixa total IOM (11.5–16)', () => {
    expect(weightGainRange(22, 40)).toEqual({ min: 11.5, max: 16 });
  });
  it('baixo peso na 40ª semana → 12.5–18', () => {
    expect(weightGainRange(17, 40)).toEqual({ min: 12.5, max: 18 });
  });
  it('sobrepeso na 40ª semana → 7–11.5', () => {
    expect(weightGainRange(27, 40)).toEqual({ min: 7, max: 11.5 });
  });
  it('obesidade na 40ª semana → 5–9', () => {
    expect(weightGainRange(32, 40)).toEqual({ min: 5, max: 9 });
  });
  it('1º trimestre é pequeno e cresce com a semana', () => {
    const w6 = weightGainRange(22, 6);
    const w13 = weightGainRange(22, 13);
    expect(w13.max).toBeGreaterThan(w6.max);
    expect(w13.max).toBeLessThanOrEqual(2);
  });
  it('cresce monotonicamente até o termo (normal)', () => {
    const seq = [13, 20, 28, 36, 40].map((w) => weightGainRange(22, w).max);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]!);
  });
  it('semana < 1 é tratada como 1 (sem negativo)', () => {
    const r = weightGainRange(22, 0);
    expect(r.min).toBeGreaterThanOrEqual(0);
  });
  it('semana > 40 satura no total', () => {
    expect(weightGainRange(22, 50)).toEqual({ min: 11.5, max: 16 });
  });
});

describe('nextScheduledConsult', () => {
  it('cadência mensal antes de 28 semanas', () => {
    expect(nextScheduledConsult(12, 12)).toEqual({ nextWeek: 16, weeksUntil: 4 });
  });
  it('quinzenal entre 28 e 36', () => {
    expect(nextScheduledConsult(28, 28)).toEqual({ nextWeek: 30, weeksUntil: 2 });
  });
  it('semanal a partir de 36', () => {
    expect(nextScheduledConsult(36, 36)).toEqual({ nextWeek: 37, weeksUntil: 1 });
  });
  it('weeksUntil nunca negativo', () => {
    expect(nextScheduledConsult(8, 14).weeksUntil).toBe(0);
  });
  it('mensal: próxima a partir da última consulta', () => {
    expect(nextScheduledConsult(16, 18)).toEqual({ nextWeek: 20, weeksUntil: 2 });
  });
  it('transição 27→28 muda cadência (4 sem antes, 2 sem depois)', () => {
    expect(nextScheduledConsult(26, 27).nextWeek).toBe(30); // mensal
    expect(nextScheduledConsult(28, 29).nextWeek).toBe(30); // quinzenal
  });
  it('quinzenal no limite 35', () => {
    expect(nextScheduledConsult(34, 35)).toEqual({ nextWeek: 36, weeksUntil: 1 });
  });
  it('semanal no termo 40', () => {
    expect(nextScheduledConsult(40, 40)).toEqual({ nextWeek: 41, weeksUntil: 1 });
  });
});
