import { describe, it, expect } from 'vitest';
import { waterGoalMl, glassesForGoal, GLASS_ML } from './water';

describe('water', () => {
  it('idoso 65+ usa 25 ml/kg (mais conservador)', () => {
    expect(waterGoalMl(80, 70)).toBe(2000); // 80*25
  });
  it('adulto usa 35 ml/kg', () => {
    expect(waterGoalMl(80, 40)).toBe(2800); // 80*35
  });
  it('meta mínima de 1000 ml e arredonda a 50', () => {
    expect(waterGoalMl(20, 80)).toBe(1000); // 20*25=500 → piso 1000
    expect(waterGoalMl(null, null)).toBe(2450); // fallback 70kg * 35
  });
  it('copos para a meta', () => {
    expect(glassesForGoal(2000)).toBe(2000 / GLASS_ML);
  });
});
