/**
 * Guarda da camada de sinônimos populares da CID-10.
 *
 * Dois perigos, dois blocos de teste:
 *   1. o sinônimo virar CONTEÚDO (a lista mostrar a palavra popular no lugar da
 *      descrição oficial do DATASUS) — proibido pela procedência dos dados;
 *   2. o sinônimo virar DIAGNÓSTICO (queixa do paciente virando doença) —
 *      proibido pela regra 1 do produto: o app registra, não diagnostica.
 */
import { describe, it, expect } from 'vitest';
import {
  CID10_CATEGORIES,
  CID10_SINONIMOS,
  CID10_SINONIMOS_RECUSADOS,
  normalizeClinicalText,
  searchCid10,
} from './clinical-codes';

const CODIGOS_OFICIAIS = new Set(CID10_CATEGORIES.map((c) => c.code));

describe('sinônimos populares: dados', () => {
  it('todo código citado existe na base oficial', () => {
    for (const s of CID10_SINONIMOS) {
      expect(s.codigos.length).toBeGreaterThan(0);
      for (const codigo of s.codigos) {
        expect(CODIGOS_OFICIAIS.has(codigo), `${s.termo} → ${codigo}`).toBe(true);
      }
      // Sem código repetido dentro do mesmo termo.
      expect(new Set(s.codigos).size).toBe(s.codigos.length);
    }
  });

  it('os termos já estão normalizados, são únicos e têm 3+ caracteres', () => {
    const vistos = new Set<string>();
    for (const s of CID10_SINONIMOS) {
      // Guardar já normalizado deixa o arquivo igual ao que a busca compara.
      expect(normalizeClinicalText(s.termo)).toBe(s.termo);
      expect(s.termo.length).toBeGreaterThanOrEqual(3);
      expect(vistos.has(s.termo), `termo repetido: ${s.termo}`).toBe(false);
      vistos.add(s.termo);
    }
  });

  it('todo mapeamento está justificado e nenhum abre leque demais', () => {
    for (const s of CID10_SINONIMOS) {
      // O motivo é o que permite auditar depois se é vocabulário ou diagnóstico.
      expect(s.motivo.length, s.termo).toBeGreaterThan(40);
      expect(s.codigos.length, s.termo).toBeLessThanOrEqual(4);
    }
  });

  it('os termos recusados continuam fora e continuam explicados', () => {
    const termos = new Set(CID10_SINONIMOS.map((s) => s.termo));
    for (const r of CID10_SINONIMOS_RECUSADOS) {
      expect(termos.has(r.termo), `${r.termo} não deveria estar mapeado`).toBe(false);
      expect(r.motivo.length, r.termo).toBeGreaterThan(20);
    }
  });
});

/**
 * Palavras de QUEIXA — o que a pessoa SENTE. Nenhuma pode virar chave de busca,
 * porque o passo seguinte seria o app escolher uma doença para a queixa.
 *
 * "cansaço", "canseira" e "fadiga" estão aqui; "vista cansada" não é queixa de
 * fadiga, é o nome popular de presbiopia (H52.4), e por isso o mapeamento existe.
 */
const PALAVRAS_DE_QUEIXA = [
  'dor',
  'dores',
  'azia',
  'queimacao',
  'ardencia',
  'tontura',
  'tonteira',
  'vertigem',
  'febre',
  'tosse',
  'catarro',
  'cansaco',
  'canseira',
  'fadiga',
  'fraqueza',
  'falta de ar',
  'formigamento',
  'inchaco',
  'coceira',
  'enjoo',
  'nausea',
  'vomito',
  'diarreia',
  'prisao de ventre',
  'intestino preso',
  'palpitacao',
  'zumbido',
  'sangramento',
  'caroco',
  'tremor',
  'desmaio',
  'aperto no peito',
  'peso no peito',
  'visao turva',
  'vista embacada',
];

describe('sinônimos populares: regra 1 (registra, não diagnostica)', () => {
  it('nenhum sinônimo parte de uma queixa do paciente', () => {
    for (const s of CID10_SINONIMOS) {
      const palavras = s.termo.split(' ');
      for (const queixa of PALAVRAS_DE_QUEIXA) {
        const bate = queixa.includes(' ') ? s.termo.includes(queixa) : palavras.includes(queixa);
        expect(bate, `"${s.termo}" parte da queixa "${queixa}"`).toBe(false);
      }
    }
  });

  it('queixa digitada não vira doença na busca', () => {
    // Cada caso é um salto que a auditoria proibiu explicitamente.
    const proibido: [string, string[]][] = [
      ['azia', ['K21', 'K30']], // azia → refluxo/dispepsia
      ['dor no peito', ['I20', 'I21', 'I25']], // dor no peito → angina/infarto
      ['dor de cabeca', ['G43', 'G44']], // dor de cabeça → enxaqueca
      ['tontura', ['H81']], // tontura → labirintite
      ['cansaco', ['D50', 'I50', 'E03', 'F32']], // cansaço → anemia/coração/tireoide/depressão
      ['falta de ar', ['J45', 'J44', 'I50']], // falta de ar → asma/DPOC/coração
      ['inchaco', ['I50', 'N18']], // inchaço → coração/rim
      ['formigamento', ['E11', 'G62']], // formigamento → diabetes/neuropatia
    ];
    for (const [consulta, jamais] of proibido) {
      const codigos = searchCid10(consulta, 30).map((c) => c.code);
      for (const codigo of jamais) {
        expect(codigos, `"${consulta}" não pode oferecer ${codigo}`).not.toContain(codigo);
      }
    }
  });

  it('a queixa que já é categoria de sintoma continua aparecendo como sintoma', () => {
    // R07 e R42 são do capítulo XVIII (sintomas e sinais). Achar o sintoma pelo
    // nome dele é registrar; trocá-lo por uma doença é que seria diagnosticar.
    expect(searchCid10('dor no peito').map((c) => c.code)).toContain('R07');
    expect(searchCid10('tontura').map((c) => c.code)).toContain('R42');
  });

  it('termo ambíguo fica de fora em vez de chutar uma doença', () => {
    // "Reumatismo" no Brasil serve para artrite, artrose e fibromialgia ao mesmo
    // tempo. Preferimos zero resultado — o campo aceita texto livre.
    expect(searchCid10('reumatismo')).toEqual([]);
    expect(searchCid10('tumor')).toEqual([]);
  });
});

describe('sinônimos populares: o sinônimo é chave de busca, nunca conteúdo', () => {
  it('o que sai da busca é o objeto oficial, com a descrição intacta', () => {
    const [i10] = searchCid10('pressao alta');
    expect(i10?.code).toBe('I10');
    expect(i10?.description_pt).toBe('Hipertensão essencial (primária)');
    // Mesma referência da base: nada foi reescrito no caminho.
    expect(CID10_CATEGORIES).toContain(i10);
  });

  it('nenhuma descrição oficial foi trocada pelo termo popular', () => {
    for (const s of CID10_SINONIMOS) {
      for (const codigo of s.codigos) {
        const oficial = CID10_CATEGORIES.find((c) => c.code === codigo);
        expect(normalizeClinicalText(oficial?.description_pt ?? '')).not.toBe(s.termo);
      }
    }
  });

  it('todo sinônimo declarado realmente encontra o que promete', () => {
    for (const s of CID10_SINONIMOS) {
      const codigos = searchCid10(s.termo, 30).map((c) => c.code);
      for (const codigo of s.codigos) {
        expect(codigos, `"${s.termo}" deveria achar ${codigo}`).toContain(codigo);
      }
    }
  });
});
