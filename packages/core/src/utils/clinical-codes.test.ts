import { describe, it, expect } from 'vitest';
import {
  CID10_CATEGORIES,
  CID10_CHAPTERS,
  CID10_DISCLAIMER,
  LOINC_ATTRIBUTION,
  LOINC_DISCLAIMER,
  LOINC_EXAMS,
  cid10ByChapter,
  cid10ChapterOf,
  findCid10ByCode,
  findLoincByCode,
  loincByCategory,
  normalizeClinicalText,
  searchCid10,
  searchLoinc,
} from './clinical-codes';

describe('bases clínicas carregadas', () => {
  it('LOINC: tem exames e nenhum código repetido', () => {
    expect(LOINC_EXAMS.length).toBeGreaterThan(150);
    const codes = LOINC_EXAMS.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('LOINC: todo código tem o formato oficial NNNN-D e foi conferido', () => {
    for (const exam of LOINC_EXAMS) {
      expect(exam.code).toMatch(/^\d{3,6}-\d$/);
      expect(exam.name_pt.trim().length).toBeGreaterThan(0);
      expect(exam.verified).toBe(true);
    }
  });

  it('LOINC: a atribuição exigida pela licença está presente', () => {
    expect(LOINC_ATTRIBUTION).toContain('Regenstrief');
    expect(LOINC_ATTRIBUTION).toContain('LOINC');
  });

  it('CID-10: tem categorias, sem repetição, todas com capítulo existente', () => {
    expect(CID10_CATEGORIES.length).toBeGreaterThan(200);
    const codes = CID10_CATEGORIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    const chapters = new Set(CID10_CHAPTERS.map((c) => c.number));
    for (const cat of CID10_CATEGORIES) {
      expect(cat.code).toMatch(/^[A-Z]\d{2}$/);
      expect(chapters.has(cat.chapter)).toBe(true);
    }
  });

  it('os avisos deixam claro que não é diagnóstico nem laudo', () => {
    expect(CID10_DISCLAIMER).toContain('Não é diagnóstico');
    expect(LOINC_DISCLAIMER).toContain('laboratório');
  });
});

describe('normalizeClinicalText', () => {
  it('tira acento, baixa a caixa e troca símbolo por espaço', () => {
    expect(normalizeClinicalText('Hemoglobina glicada (HbA1c)')).toBe('hemoglobina glicada hba1c');
    expect(normalizeClinicalText('Ácido úrico')).toBe('acido urico');
  });
});

describe('searchLoinc', () => {
  it('acha pelo nome e prioriza o mais direto', () => {
    expect(searchLoinc('hemoglobina')[0]?.code).toBe('718-7');
    expect(searchLoinc('glicada')[0]?.code).toBe('4548-4');
    expect(searchLoinc('tsh')[0]?.code).toBe('3016-3');
  });

  it('acha sem acento e por sigla', () => {
    expect(searchLoinc('acido urico').some((e) => e.code === '3084-1')).toBe(true);
    expect(searchLoinc('ácido úrico').some((e) => e.code === '3084-1')).toBe(true);
    expect(searchLoinc('hba1c')[0]?.code).toBe('4548-4');
    expect(searchLoinc('hemossedimentacao')[0]?.code).toBe('30341-2');
    expect(searchLoinc('vhs').some((e) => e.code === '30341-2')).toBe(true);
  });

  it('acha pelo próprio código', () => {
    expect(searchLoinc('4548-4')[0]?.code).toBe('4548-4');
  });

  it('exige todas as palavras e trata busca vazia', () => {
    expect(searchLoinc('   ')).toEqual([]);
    expect(searchLoinc('hemoglobina banana')).toEqual([]);
    expect(searchLoinc('ferritina', 3).length).toBeLessThanOrEqual(3);
  });
});

describe('findLoincByCode', () => {
  it('acha o exame pelo código exato', () => {
    expect(findLoincByCode('718-7')?.name_pt).toBe('Hemoglobina');
    expect(findLoincByCode('4548-4')?.name_pt).toContain('glicada');
    expect(findLoincByCode('2160-0')?.unit_default).toBe('mg/dL');
  });

  it('tolera espaço em volta e caixa', () => {
    expect(findLoincByCode('  4548-4  ')?.code).toBe('4548-4');
  });

  it('devolve null para código que não está na base', () => {
    expect(findLoincByCode('')).toBeNull();
    expect(findLoincByCode('0000-0')).toBeNull();
    expect(findLoincByCode('nao-existe')).toBeNull();
  });

  it('filtra por categoria', () => {
    const hemograma = loincByCategory('hemograma');
    expect(hemograma.length).toBeGreaterThan(10);
    expect(hemograma.every((e) => e.category === 'hemograma')).toBe(true);
  });
});

describe('searchCid10', () => {
  it('acha pelo código', () => {
    expect(searchCid10('i10')[0]?.code).toBe('I10');
    expect(searchCid10('E11')[0]?.code).toBe('E11');
  });

  it('acha pela descrição, sem acento', () => {
    expect(searchCid10('hipertensao')[0]?.code).toBe('I10');
    expect(searchCid10('hipertensão')[0]?.code).toBe('I10');
    expect(searchCid10('asma')[0]?.code).toBe('J45');
    expect(searchCid10('dorsalgia')[0]?.code).toBe('M54');
    expect(searchCid10('diabetes').some((c) => c.code === 'E11')).toBe(true);
  });

  it('exige todas as palavras e trata busca vazia', () => {
    expect(searchCid10('   ')).toEqual([]);
    expect(searchCid10('asma banana')).toEqual([]);
    expect(searchCid10('a', 4).length).toBeLessThanOrEqual(4);
  });
});

describe('findCid10ByCode', () => {
  it('acha a categoria de 3 dígitos', () => {
    expect(findCid10ByCode('I10')?.description_pt).toBe('Hipertensão essencial (primária)');
    expect(findCid10ByCode('i10')?.code).toBe('I10');
    expect(findCid10ByCode(' E78 ')?.code).toBe('E78');
  });

  it('aceita a subcategoria de 4 dígitos e devolve a categoria correspondente', () => {
    // A base não tem o 4º dígito; devolver a categoria é honesto, inventar não.
    expect(findCid10ByCode('E11.9')?.code).toBe('E11');
    expect(findCid10ByCode('I10.0')?.code).toBe('I10');
    expect(findCid10ByCode('J45.0')?.code).toBe('J45');
  });

  it('devolve null quando o código não está no recorte', () => {
    expect(findCid10ByCode('')).toBeNull();
    expect(findCid10ByCode('ZZZ')).toBeNull();
    expect(findCid10ByCode('X1')).toBeNull();
  });

  it('resolve o capítulo da categoria', () => {
    const i10 = findCid10ByCode('I10');
    expect(i10).not.toBeNull();
    expect(i10 && cid10ChapterOf(i10)?.roman).toBe('IX');
    expect(i10 && cid10ChapterOf(i10)?.title_pt).toContain('circulatório');
  });

  it('lista as categorias de um capítulo', () => {
    const circulatorio = cid10ByChapter(9);
    expect(circulatorio.length).toBeGreaterThan(5);
    expect(circulatorio.every((c) => c.code.startsWith('I'))).toBe(true);
  });
});
