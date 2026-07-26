import { describe, it, expect } from 'vitest';
import { summarizePainHistory, painMigrationDetection } from './pain';

const p = (region: string, intensity: number, date: string) => ({
  body_region: region,
  intensity,
  created_at: `${date}T12:00:00Z`,
});

describe('summarizePainHistory', () => {
  const pts = [
    p('lower_back', 7, '2026-06-01'),
    p('lower_back', 5, '2026-06-03'),
    p('knee_left', 8, '2026-06-04'),
    p('lower_back', 6, '2026-06-05'),
  ];

  it('ranqueia por frequência (lombar 3x no topo)', () => {
    const r = summarizePainHistory(pts, 30, '2026-06-06');
    expect(r[0]!.region).toBe('lower_back');
    expect(r[0]!.count).toBe(3);
    expect(r[0]!.avgIntensity).toBe(6);
    expect(r[0]!.maxIntensity).toBe(7);
  });

  it('inclui as outras regiões', () => {
    const r = summarizePainHistory(pts, 30, '2026-06-06');
    expect(r.find((x) => x.region === 'knee_left')?.count).toBe(1);
  });

  it('respeita a janela de dias', () => {
    const r = summarizePainHistory(pts, 2, '2026-06-06'); // só 04 e 05
    expect(r.reduce((s, x) => s + x.count, 0)).toBe(2);
  });

  it('empate por contagem desempata pela média', () => {
    const r = summarizePainHistory(
      [p('a', 3, '2026-06-01'), p('b', 9, '2026-06-02')],
      30,
      '2026-06-06',
    );
    expect(r[0]!.region).toBe('b');
  });

  it('lista vazia → []', () => {
    expect(summarizePainHistory([], 30, '2026-06-06')).toEqual([]);
  });
});

describe('painMigrationDetection', () => {
  it('detecta migração da lombar para o joelho', () => {
    const pts = [
      p('lower_back', 7, '2026-05-01'),
      p('lower_back', 6, '2026-05-03'),
      p('knee_left', 8, '2026-05-20'),
      p('knee_left', 7, '2026-05-22'),
    ];
    expect(painMigrationDetection(pts)).toEqual({ from: 'lower_back', to: 'knee_left' });
  });

  it('sem migração quando é a mesma região', () => {
    const pts = [
      p('lower_back', 7, '2026-05-01'),
      p('lower_back', 6, '2026-05-03'),
      p('lower_back', 8, '2026-05-20'),
      p('lower_back', 7, '2026-05-22'),
    ];
    expect(painMigrationDetection(pts)).toBeNull();
  });

  it('poucos pontos → null', () => {
    expect(painMigrationDetection([p('a', 5, '2026-05-01'), p('b', 5, '2026-05-02')])).toBeNull();
  });
});
