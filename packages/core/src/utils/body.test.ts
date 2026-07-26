import { describe, it, expect } from 'vitest';
import {
  waistHipRatio,
  formatBodyValue,
  BODY_COMPOSITION_FIELDS,
  BODY_MEASUREMENT_FIELDS,
} from './body';

describe('body', () => {
  it('relação cintura/quadril arredonda a 2 casas', () => {
    expect(waistHipRatio(94, 102)).toBe(0.92);
    expect(waistHipRatio(80, 100)).toBe(0.8);
  });
  it('retorna null quando falta dado ou quadril inválido', () => {
    expect(waistHipRatio(null, 100)).toBeNull();
    expect(waistHipRatio(90, null)).toBeNull();
    expect(waistHipRatio(90, 0)).toBeNull();
  });
  it('formata valor pt-BR com unidade e casas do campo', () => {
    const gordura = BODY_COMPOSITION_FIELDS.find((f) => f.key === 'body_fat_pct')!;
    const visceral = BODY_COMPOSITION_FIELDS.find((f) => f.key === 'visceral_fat')!;
    expect(formatBodyValue(24.1, gordura)).toBe('24,1 %');
    expect(formatBodyValue(9, visceral)).toBe('9');
    expect(formatBodyValue(null, gordura)).toBe('—');
  });
  it('cintura está entre os campos de circunferência', () => {
    expect(BODY_MEASUREMENT_FIELDS.some((f) => f.key === 'waist_cm')).toBe(true);
  });
});
