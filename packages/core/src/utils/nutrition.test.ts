import { describe, it, expect } from 'vitest';
import {
  searchFoods,
  nutritionForGrams,
  sodioParaGramas,
  estadoDeSodio,
  tacoFoodPorId,
  sodioDoDia,
  coberturaDoSodio,
  TACO_FOODS,
  type TacoFood,
} from './nutrition';

const BASE: TacoFood = {
  id: 1,
  name: 'x',
  category: 'y',
  kcal: 100,
  protein: 10,
  carbs: 20,
  fat: 5,
  fiber: 2,
};

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
    const food = { ...BASE, sodium: 300 };
    expect(nutritionForGrams(food, 200)).toEqual({
      kcal: 200,
      protein: 20,
      carbs: 40,
      fat: 10,
      fiber: 4,
      sodium: 600,
      sodiumEstado: 'medido',
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

describe('sódio — o valor da TACO, e só ele', () => {
  it('a coluna de sódio chegou aos alimentos que a TACO mediu', () => {
    const cream = TACO_FOODS.find((f) => f.name === 'Biscoito, salgado, cream cracker');
    // 854 mg/100 g na Tabela 1 da TACO 4ª ed. — nada de estimativa.
    expect(cream?.sodium).toBeCloseTo(854.4, 1);
    expect(sodioParaGramas(cream!, 25).mg).toBe(214);
  });

  it('NUNCA grava zero para alimento sem valor na fonte', () => {
    const semNumero = TACO_FOODS.filter((f) => typeof f.sodium !== 'number');
    expect(semNumero.length).toBeGreaterThan(0);
    for (const f of semNumero) expect(f.sodium).toBeUndefined();
    // Zero só existiria se a TACO tivesse medido zero — e ela não mediu em nenhum.
    expect(TACO_FOODS.filter((f) => f.sodium === 0)).toEqual([]);
  });

  it('traço e sem-dado são estados diferentes, e nenhum vira número', () => {
    const traco = TACO_FOODS.find((f) => f.sodiumTraco);
    expect(traco).toBeDefined();
    expect(estadoDeSodio(traco!)).toBe('traco');
    expect(sodioParaGramas(traco!, 100)).toEqual({ estado: 'traco', mg: null });

    const semDado = TACO_FOODS.find((f) => !f.sodiumTraco && typeof f.sodium !== 'number');
    expect(semDado).toBeDefined();
    expect(sodioParaGramas(semDado!, 100)).toEqual({ estado: 'sem-dado', mg: null });
  });

  it('nenhum alimento carrega número e traço ao mesmo tempo', () => {
    expect(TACO_FOODS.filter((f) => f.sodiumTraco && typeof f.sodium === 'number')).toEqual([]);
  });

  it('a cobertura da TACO é a que os dados têm hoje (523 / 64 / 10)', () => {
    const medidos = TACO_FOODS.filter((f) => typeof f.sodium === 'number').length;
    const traco = TACO_FOODS.filter((f) => f.sodiumTraco === true).length;
    expect(medidos).toBe(523);
    expect(traco).toBe(64);
    expect(TACO_FOODS.length - medidos - traco).toBe(10);
  });

  it('recupera o alimento pelo id gravado em source_ref (string ou número)', () => {
    expect(tacoFoodPorId('1')?.name).toBe('Arroz, integral, cozido');
    expect(tacoFoodPorId(1)?.name).toBe('Arroz, integral, cozido');
    expect(tacoFoodPorId(null)).toBeNull();
    expect(tacoFoodPorId('abacaxi')).toBeNull();
    expect(tacoFoodPorId('999999')).toBeNull();
  });

  it('a soma do dia só conta o que a TACO mediu, e devolve o que ficou de fora', () => {
    const cream = TACO_FOODS.find((f) => f.name === 'Biscoito, salgado, cream cracker')!;
    const traco = TACO_FOODS.find((f) => f.sodiumTraco)!;
    const t = sodioDoDia([
      { grams: 100, source: 'taco', source_ref: String(cream.id) },
      { grams: 100, source: 'taco', source_ref: String(traco.id) },
      { grams: 100, source: 'openfoodfacts', source_ref: '7891000100103' },
      { grams: 100, source: null, source_ref: null },
    ]);
    expect(t.mg).toBe(854);
    expect(t.medidos).toBe(1);
    expect(t.traco).toBe(1);
    expect(t.semDado).toBe(2);
    expect(t.itens).toBe(4);
  });

  it('item de outra base não entra na soma disfarçado de zero', () => {
    const t = sodioDoDia([{ grams: 100, source: 'manual', source_ref: null }]);
    expect(t.mg).toBe(0);
    expect(t.medidos).toBe(0);
    expect(t.semDado).toBe(1);
  });

  it('a frase de cobertura é factual e não julga o dia', () => {
    const frase = coberturaDoSodio({ mg: 900, medidos: 2, traco: 1, semDado: 1, itens: 4 });
    expect(frase).toContain('2 de 4 itens');
    expect(frase).toContain('traço');
    expect(frase).toContain('sem sódio informado');
    for (const proibida of [
      'excedeu',
      'acima do recomendado',
      'atenção',
      'cuidado',
      'muito',
      'pouco',
      'ideal',
      'parabéns',
    ]) {
      expect(frase.toLowerCase()).not.toContain(proibida);
    }
    expect(coberturaDoSodio({ mg: 0, medidos: 0, traco: 0, semDado: 0, itens: 0 })).toContain(
      'Nenhum item registrado',
    );
    expect(coberturaDoSodio({ mg: 0, medidos: 0, traco: 0, semDado: 2, itens: 2 })).toContain(
      'não estima',
    );
  });
});
