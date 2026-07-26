import { describe, it, expect } from 'vitest';
import { weightAlert } from './weight-alert';

describe('weightAlert', () => {
  it('sem dados suficientes → sem alerta', () => {
    expect(weightAlert([]).kind).toBeNull();
    expect(weightAlert([{ date: '2026-07-13', kg: 80 }]).kind).toBeNull();
  });

  it('ganho rápido (≥1.5 kg em poucos dias) → rapid_gain', () => {
    const a = weightAlert([
      { date: '2026-07-10', kg: 80 },
      { date: '2026-07-12', kg: 81 },
      { date: '2026-07-13', kg: 82 },
    ]);
    expect(a.kind).toBe('rapid_gain');
    expect(a.deltaKg).toBeCloseTo(2);
    expect(a.message).toMatch(/reten[çc]/i);
  });

  it('perda no mês (≥5%) → unintentional_loss', () => {
    const a = weightAlert([
      { date: '2026-06-10', kg: 70 },
      { date: '2026-07-13', kg: 65 },
    ]);
    expect(a.kind).toBe('unintentional_loss');
    expect(a.deltaKg).toBeCloseTo(5);
  });

  it('estável → sem alerta', () => {
    expect(
      weightAlert([
        { date: '2026-06-10', kg: 80 },
        { date: '2026-07-01', kg: 80.3 },
        { date: '2026-07-13', kg: 80.1 },
      ]).kind,
    ).toBeNull();
  });
});
