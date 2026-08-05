import { describe, it, expect } from 'vitest';
import { searchFoods, nutritionForGrams, TACO_FOODS } from './nutrition';

describe('nutrition (TACO)', () => {
  it('tem a base carregada (597 alimentos)', () => {
    expect(TACO_FOODS.length).toBeGreaterThan(500);
  });
  it('busca sem acento e por palavra', () => {
    const r = searchFoods('arroz');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]?.name.toLowerCase()).toContain('arroz');
    // "feijao" (sem acento) acha "Feijão"
    expect(searchFoods('feijao').length).toBeGreaterThan(0);
  });
  it('busca vazia não retorna nada', () => {
    expect(searchFoods('   ')).toEqual([]);
  });
  it('escala nutrientes por grama', () => {
    const food = { id: 1, name: 'x', category: 'y', kcal: 100, protein: 10, carbs: 20, fat: 5, fiber: 2 };
    expect(nutritionForGrams(food, 200)).toEqual({
      kcal: 200,
      protein: 20,
      carbs: 40,
      fat: 10,
      fiber: 4,
    });
    expect(nutritionForGrams(food, 50).kcal).toBe(50);
    expect(nutritionForGrams(food, 0).kcal).toBe(0);
  });

  it('a fibra da TACO chega ao resultado (era descartada antes)', () => {
    const aveia = TACO_FOODS.find((f) => f.name.startsWith('Aveia'));
    expect(aveia?.fiber).toBeGreaterThan(0);
    expect(nutritionForGrams(aveia!, 100).fiber).toBeCloseTo(aveia!.fiber, 1);
  });
});
