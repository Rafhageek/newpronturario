import { describe, it, expect } from 'vitest';
import {
  ageInMonths,
  ageLabel,
  lmsZScore,
  zToPercentile,
  percentileFromLms,
  interpolateLms,
  percentileForAge,
  probit,
  valueFromLms,
  valueAtPercentileForAge,
  nextDueVaccines,
} from './growth';

describe('ageInMonths', () => {
  it('recém-nascido = 0', () => {
    expect(ageInMonths('2026-06-01', '2026-06-10')).toBe(0);
  });
  it('exatamente 1 mês', () => {
    expect(ageInMonths('2026-05-10', '2026-06-10')).toBe(1);
  });
  it('ainda não completou o mês', () => {
    expect(ageInMonths('2026-05-15', '2026-06-10')).toBe(0);
  });
  it('2 anos e 3 meses = 27 meses', () => {
    expect(ageInMonths('2024-03-10', '2026-06-10')).toBe(27);
  });
  it('nunca negativo', () => {
    expect(ageInMonths('2026-12-10', '2026-06-10')).toBe(0);
  });
});

describe('ageLabel', () => {
  it.each([
    ['2026-06-01', '2026-06-10', 'recém-nascido'],
    ['2026-05-10', '2026-06-10', '1 mês'],
    ['2026-04-10', '2026-06-10', '2 meses'],
    ['2025-06-10', '2026-06-10', '1 ano'],
    ['2024-03-10', '2026-06-10', '2 anos e 3 meses'],
  ])('%s → %s', (birth, today, label) => {
    expect(ageLabel(birth, today)).toBe(label);
  });
});

describe('lmsZScore', () => {
  it('valor = M → z = 0 (mediana)', () => {
    expect(lmsZScore(10, { l: -0.5, m: 10, s: 0.1 })).toBeCloseTo(0, 6);
  });
  it('L = 1 vira fórmula linear (X/M − 1)/S', () => {
    // (12/10 − 1)/0.1 = 2
    expect(lmsZScore(12, { l: 1, m: 10, s: 0.1 })).toBeCloseTo(2, 6);
  });
  it('L = 0 usa log', () => {
    // ln(11/10)/0.1
    expect(lmsZScore(11, { l: 0, m: 10, s: 0.1 })).toBeCloseTo(Math.log(1.1) / 0.1, 6);
  });
  it('valor inválido → NaN', () => {
    expect(Number.isNaN(lmsZScore(0, { l: 1, m: 10, s: 0.1 }))).toBe(true);
  });
});

describe('zToPercentile', () => {
  it('z = 0 → P50', () => {
    expect(zToPercentile(0)).toBe(50);
  });
  it('z ≈ 1.645 → ~P95', () => {
    expect(zToPercentile(1.645)).toBeGreaterThanOrEqual(94);
    expect(zToPercentile(1.645)).toBeLessThanOrEqual(96);
  });
  it('z ≈ -1.28 → ~P10', () => {
    expect(zToPercentile(-1.28)).toBeGreaterThanOrEqual(9);
    expect(zToPercentile(-1.28)).toBeLessThanOrEqual(11);
  });
  it('satura em 1–99', () => {
    expect(zToPercentile(10)).toBe(99);
    expect(zToPercentile(-10)).toBe(1);
  });
  it('NaN propaga', () => {
    expect(Number.isNaN(zToPercentile(NaN))).toBe(true);
  });
});

describe('percentileFromLms', () => {
  it('mediana M cai no P50', () => {
    expect(percentileFromLms(7.5, { l: -0.2, m: 7.5, s: 0.13 })).toBe(50);
  });
});

describe('interpolateLms', () => {
  const pts = [
    { x: 0, l: 1, m: 3.3, s: 0.14 },
    { x: 1, l: 1, m: 4.5, s: 0.13 },
    { x: 2, l: 1, m: 5.6, s: 0.12 },
  ];
  it('ponto exato retorna o próprio', () => {
    expect(interpolateLms(pts, 1)).toEqual({ l: 1, m: 4.5, s: 0.13 });
  });
  it('interpola no meio (x=0.5)', () => {
    const r = interpolateLms(pts, 0.5)!;
    expect(r.m).toBeCloseTo(3.9, 6);
  });
  it('abaixo do mínimo usa o primeiro', () => {
    expect(interpolateLms(pts, -3)!.m).toBe(3.3);
  });
  it('acima do máximo usa o último', () => {
    expect(interpolateLms(pts, 10)!.m).toBe(5.6);
  });
  it('lista vazia → null', () => {
    expect(interpolateLms([], 1)).toBeNull();
  });
});

describe('percentileForAge', () => {
  const pts = [
    { x: 0, l: 1, m: 3.3, s: 0.14 },
    { x: 2, l: 1, m: 5.6, s: 0.12 },
  ];
  it('mediana interpolada → P50', () => {
    // em x=1, m interpolado = 4.45; medir 4.45 → P50
    expect(percentileForAge(4.45, 1, pts)).toBe(50);
  });
  it('acima da mediana → > P50', () => {
    expect(percentileForAge(6, 1, pts)!).toBeGreaterThan(50);
  });
  it('sem pontos → null', () => {
    expect(percentileForAge(5, 1, [])).toBeNull();
  });
});

describe('probit / valueFromLms (inverso do LMS p/ desenhar curvas)', () => {
  it('probit(0.5) = 0', () => {
    expect(probit(0.5)).toBeCloseTo(0, 4);
  });
  it('probit(0.975) ≈ 1.96', () => {
    expect(probit(0.975)).toBeCloseTo(1.96, 2);
  });
  it('probit(0.025) ≈ -1.96', () => {
    expect(probit(0.025)).toBeCloseTo(-1.96, 2);
  });
  it('valueFromLms(0) = M (a mediana)', () => {
    expect(valueFromLms(0, { l: -0.5, m: 8.2, s: 0.12 })).toBeCloseTo(8.2, 6);
  });
  it('round-trip: percentil → valor → percentil', () => {
    const lms = { l: -0.3, m: 6.5, s: 0.13 };
    const v = valueFromLms(probit(0.85), lms);
    expect(percentileFromLms(v, lms)).toBe(85);
  });
  it('valueAtPercentileForAge: P50 = M interpolado', () => {
    const pts = [
      { x: 0, l: 1, m: 3.3, s: 0.14 },
      { x: 2, l: 1, m: 5.7, s: 0.12 },
    ];
    // P50 em x=1 → M interpolado = 4.5
    expect(valueAtPercentileForAge(50, 1, pts)).toBeCloseTo(4.5, 6);
  });
});

describe('nextDueVaccines', () => {
  const schedule = [
    { code: 'bcg', recommended_age_months: 0 },
    { code: 'penta_1', recommended_age_months: 2 },
    { code: 'penta_2', recommended_age_months: 4 },
    { code: 'triplice_viral_1', recommended_age_months: 12 },
  ];
  it('aos 6 meses, sem nada aplicado: BCG/penta_1/penta_2 atrasadas, tríplice futura', () => {
    const r = nextDueVaccines('2026-01-01', [], schedule, '2026-07-01'); // 6 meses
    expect(r.find((v) => v.code === 'bcg')!.status).toBe('overdue');
    expect(r.find((v) => v.code === 'penta_2')!.status).toBe('overdue');
    expect(r.find((v) => v.code === 'triplice_viral_1')!.status).toBe('upcoming');
  });
  it('exclui vacinas já aplicadas', () => {
    const r = nextDueVaccines('2026-01-01', ['bcg', 'penta_1'], schedule, '2026-07-01');
    expect(r.find((v) => v.code === 'bcg')).toBeUndefined();
    expect(r.find((v) => v.code === 'penta_1')).toBeUndefined();
  });
  it('status "due" no mês exato', () => {
    const r = nextDueVaccines('2026-01-01', [], schedule, '2026-03-01'); // 2 meses
    expect(r.find((v) => v.code === 'penta_1')!.status).toBe('due');
  });
  it('ordena por idade recomendada', () => {
    const r = nextDueVaccines('2026-01-01', [], schedule, '2026-07-01');
    const ages = r.map((v) => v.recommended_age_months);
    expect(ages).toEqual([...ages].sort((a, b) => a - b));
  });
  it('aceita Set de aplicadas', () => {
    const r = nextDueVaccines('2026-01-01', new Set(['bcg']), schedule, '2026-07-01');
    expect(r.find((v) => v.code === 'bcg')).toBeUndefined();
  });
});
