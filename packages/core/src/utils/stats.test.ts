import { describe, it, expect } from 'vitest';
import { smoothedTrendPct, trendDirection, trendLabel } from './stats';

describe('smoothedTrendPct', () => {
  it('detecta queda comparando terços (menos ruído)', () => {
    // sobe no meio mas termina bem abaixo → terço final < terço inicial
    const v = [140, 138, 150, 130, 120, 118];
    const pct = smoothedTrendPct(v);
    expect(pct).not.toBeNull();
    expect(pct!).toBeLessThan(0);
    expect(trendDirection(pct)).toBe('down');
    expect(trendLabel(pct)).toMatch(/caiu/);
  });

  it('estável dentro da zona morta de 2%', () => {
    const v = [120, 121, 119, 120, 121, 120];
    expect(trendDirection(smoothedTrendPct(v))).toBe('flat');
  });

  it('cai para ponta-a-ponta com poucos pontos', () => {
    expect(smoothedTrendPct([100, 110])).toBeCloseTo(10);
    expect(smoothedTrendPct([])).toBeNull();
  });
});
