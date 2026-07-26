import { describe, it, expect } from 'vitest';
import { buildMoodGrid, moodPixelColor, MOOD_PIXEL } from './mood-map';

describe('mood-map', () => {
  it('moodPixelColor mapeia 1-5 e null', () => {
    expect(moodPixelColor(1)).toBe(MOOD_PIXEL[1]);
    expect(moodPixelColor(5)).toBe(MOOD_PIXEL[5]);
    expect(moodPixelColor(3.4)).toBe(MOOD_PIXEL[3]); // arredonda
    expect(moodPixelColor(null)).toBeNull();
    expect(moodPixelColor(undefined)).toBeNull();
    expect(moodPixelColor(9)).toBeNull();
  });

  it('buildMoodGrid retorna colunas de 7 e termina no dia final', () => {
    const weeks = buildMoodGrid('2026-07-13', 182);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // a última célula não-nula é o endIso
    const flat = weeks.flat().filter(Boolean) as string[];
    expect(flat[flat.length - 1]).toBe('2026-07-13');
    // cobre ~26-27 semanas
    expect(weeks.length).toBeGreaterThanOrEqual(26);
    expect(weeks.length).toBeLessThanOrEqual(28);
  });

  it('primeira coluna começa num domingo', () => {
    const weeks = buildMoodGrid('2026-07-13', 182);
    const first = weeks[0]![0]!; // 'YYYY-MM-DD'
    expect(new Date(`${first}T00:00:00`).getDay()).toBe(0);
  });
});
