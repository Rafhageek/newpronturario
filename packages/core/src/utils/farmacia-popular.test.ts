import { describe, it, expect } from 'vitest';
import {
  isFarmaciaPopular,
  findFarmaciaPopularItem,
  farmaciaPopularCategoryLabel,
  normalizeFarmaciaPopularText,
  FARMACIA_POPULAR_ITEMS,
  FARMACIA_POPULAR_NOTE,
} from './farmacia-popular';

describe('farmácia popular — elenco', () => {
  it('tem o elenco carregado e sem ids repetidos', () => {
    expect(FARMACIA_POPULAR_ITEMS.length).toBeGreaterThan(20);
    const ids = FARMACIA_POPULAR_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a nota fala do elenco, nunca de "direito"', () => {
    expect(FARMACIA_POPULAR_NOTE).toContain('elenco gratuito');
    expect(FARMACIA_POPULAR_NOTE).toContain('Meu SUS Digital');
    expect(FARMACIA_POPULAR_NOTE.toLowerCase()).not.toContain('você tem direito');
  });
});

describe('normalizeFarmaciaPopularText', () => {
  it('tira acento, baixa a caixa e troca símbolo por espaço', () => {
    expect(normalizeFarmaciaPopularText('Losartana Potássica')).toBe('losartana potassica');
    expect(normalizeFarmaciaPopularText('Carbidopa+Levodopa')).toBe('carbidopa levodopa');
    expect(normalizeFarmaciaPopularText('  Ipratrópio  0,25mg/ml ')).toBe('ipratropio 0 25mg ml');
  });
});

describe('isFarmaciaPopular / findFarmaciaPopularItem', () => {
  it('casa com o princípio ativo exato', () => {
    expect(isFarmaciaPopular('losartana')).toBe(true);
    expect(isFarmaciaPopular('Hidroclorotiazida')).toBe(true);
    expect(isFarmaciaPopular('Metformina')).toBe(true);
  });

  it('casa com e sem acento', () => {
    expect(isFarmaciaPopular('Brometo de ipratrópio')).toBe(true);
    expect(isFarmaciaPopular('brometo de ipratropio')).toBe(true);
    expect(findFarmaciaPopularItem('IPRATRÓPIO')?.id).toBe('ipratropio');
  });

  it('casa em texto livre com dose e unidade', () => {
    expect(findFarmaciaPopularItem('Losartana 50mg')?.id).toBe('losartana');
    expect(findFarmaciaPopularItem('Sinvastatina 20 mg comprimido')?.id).toBe('sinvastatina');
    expect(findFarmaciaPopularItem('Metformina XR 500mg (2x ao dia)')?.id).toBe('metformina');
    expect(findFarmaciaPopularItem('Fralda geriátrica tamanho M')?.id).toBe('fralda-geriatrica');
  });

  it('casa o nome com sal ainda que o cadastro traga só o princípio ativo', () => {
    // No elenco é "Maleato de enalapril"; a pessoa cadastra "Enalapril 10mg".
    expect(findFarmaciaPopularItem('Enalapril 10mg')?.id).toBe('enalapril');
    // E o contrário também vale.
    expect(findFarmaciaPopularItem('Succinato de metoprolol')?.id).toBe('metoprolol');
  });

  it('prefere o termo mais específico quando há mais de um match', () => {
    expect(findFarmaciaPopularItem('Insulina Humana NPH 100UI/ml')?.id).toBe('insulina-humana-nph');
    expect(findFarmaciaPopularItem('Insulina humana regular')?.id).toBe('insulina-humana-regular');
    expect(findFarmaciaPopularItem('Carbidopa + Levodopa 25/250')?.id).toBe('carbidopa-levodopa');
    expect(findFarmaciaPopularItem('Levodopa + Benserazida')?.id).toBe('benserazida-levodopa');
  });

  it('não gera falso positivo com nome parecido ou fora do elenco', () => {
    // Termina em "-vastatina" mas não é sinvastatina.
    expect(isFarmaciaPopular('Rosuvastatina 10mg')).toBe(false);
    expect(isFarmaciaPopular('Atorvastatina 20mg')).toBe(false);
    // "estradiol" está dentro de "etinilestradiol": só casa em início de palavra.
    expect(isFarmaciaPopular('Etinilestradiol + gestodeno')).toBe(false);
    // Insulinas análogas não estão no elenco.
    expect(isFarmaciaPopular('Insulina glargina')).toBe(false);
    expect(isFarmaciaPopular('Dipirona sódica 500mg')).toBe(false);
    expect(isFarmaciaPopular('Omeprazol 20mg')).toBe(false);
  });

  it('trata entrada vazia sem quebrar', () => {
    expect(isFarmaciaPopular('')).toBe(false);
    expect(isFarmaciaPopular('   ')).toBe(false);
    expect(findFarmaciaPopularItem('---')).toBeNull();
  });

  it('expõe o rótulo da condição atendida', () => {
    const item = findFarmaciaPopularItem('Losartana 50mg');
    expect(item).not.toBeNull();
    expect(item && farmaciaPopularCategoryLabel(item)).toBe('Hipertensão');
  });
});
