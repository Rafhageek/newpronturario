import { describe, it, expect } from 'vitest';
import {
  MEDICAMENTOS_BR,
  MEDICAMENTOS_BR_DISCLAIMER,
  findMedicamentoByName,
  medicamentoCategoryLabel,
  medicamentoPresentation,
  medicamentoTarjaLabel,
  medicamentosByCategory,
  normalizeMedicamentoText,
  searchMedicamentos,
} from './medicamentos-br';

describe('base de medicamentos (Anvisa)', () => {
  it('tem a base carregada e sem ids repetidos', () => {
    expect(MEDICAMENTOS_BR.length).toBeGreaterThan(250);
    const ids = MEDICAMENTOS_BR.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo item declara princípio ativo, apresentação e procedência', () => {
    for (const med of MEDICAMENTOS_BR) {
      expect(med.activeIngredient.trim().length).toBeGreaterThan(0);
      expect(med.strengths.trim().length).toBeGreaterThan(0);
      expect(med.forms.trim().length).toBeGreaterThan(0);
      // `verified` só é true porque o princípio ativo foi conferido na Anvisa.
      expect(typeof med.verified).toBe('boolean');
    }
  });

  it('o aviso deixa claro que não prescreve', () => {
    expect(MEDICAMENTOS_BR_DISCLAIMER).toContain('não prescreve');
    expect(MEDICAMENTOS_BR_DISCLAIMER).toContain('bula');
  });
});

describe('normalizeMedicamentoText', () => {
  it('tira acento, baixa a caixa e troca símbolo por espaço', () => {
    expect(normalizeMedicamentoText('Losartana Potássica')).toBe('losartana potassica');
    expect(normalizeMedicamentoText('Ácido acetilsalicílico')).toBe('acido acetilsalicilico');
    expect(normalizeMedicamentoText('  Puran T4 — 75mcg ')).toBe('puran t4 75mcg');
  });
});

describe('searchMedicamentos', () => {
  it('acha pelo princípio ativo', () => {
    const r = searchMedicamentos('losartana');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]?.id).toBe('losartana');
  });

  it('acha sem acento', () => {
    expect(searchMedicamentos('acido acetilsalicilico')[0]?.id).toBe('aas');
    expect(searchMedicamentos('ácido acetilsalicílico')[0]?.id).toBe('aas');
  });

  it('acha pelo nome comercial e pelo sinônimo', () => {
    expect(searchMedicamentos('rivotril')[0]?.id).toBe('clonazepam');
    expect(searchMedicamentos('glifage')[0]?.id).toBe('metformina');
    expect(searchMedicamentos('aspirina')[0]?.id).toBe('aas');
  });

  it('prioriza quem começa com o termo', () => {
    // "dipirona" também aparece dentro do Dorflex (orfenadrina + dipirona),
    // mas a dipirona pura tem que vir primeiro.
    const r = searchMedicamentos('dipirona');
    expect(r.length).toBeGreaterThan(1);
    expect(r[0]?.id).toBe('dipirona');
  });

  it('exige todas as palavras da consulta', () => {
    expect(searchMedicamentos('insulina glargina')[0]?.id).toBe('insulina-glargina');
    expect(searchMedicamentos('losartana banana')).toEqual([]);
  });

  it('respeita o limite e trata busca vazia', () => {
    expect(searchMedicamentos('   ')).toEqual([]);
    expect(searchMedicamentos('a', 5).length).toBeLessThanOrEqual(5);
  });
});

describe('findMedicamentoByName', () => {
  it('casa com texto livre que traz dose e forma', () => {
    expect(findMedicamentoByName('Losartana 50mg')?.id).toBe('losartana');
    expect(findMedicamentoByName('Puran T4 75 mcg')?.id).toBe('levotiroxina');
    expect(findMedicamentoByName('AAS 100 (1x ao dia)')?.id).toBe('aas');
  });

  it('casa o nome com sal quando o cadastro traz só o princípio ativo', () => {
    expect(findMedicamentoByName('Enalapril 10mg')?.id).toBe('enalapril');
    expect(findMedicamentoByName('Metformina XR 500')?.id).toBe('metformina');
  });

  it('não confunde nomes parecidos (só casa em início de palavra)', () => {
    expect(findMedicamentoByName('Rosuvastatina 10mg')?.id).toBe('rosuvastatina');
    expect(findMedicamentoByName('Atorvastatina 20mg')?.id).toBe('atorvastatina');
  });

  it('prefere o termo mais específico', () => {
    expect(findMedicamentoByName('Insulina glargina 100 UI/ml')?.id).toBe('insulina-glargina');
    expect(findMedicamentoByName('Insulina humana NPH')?.id).toBe('insulina-humana-nph');
  });

  it('devolve null quando não tem match', () => {
    expect(findMedicamentoByName('')).toBeNull();
    expect(findMedicamentoByName('   ')).toBeNull();
    expect(findMedicamentoByName('---')).toBeNull();
    expect(findMedicamentoByName('chá de camomila')).toBeNull();
  });
});

describe('rótulos e apresentação', () => {
  it('traz a tarja de controle especial certa', () => {
    const rivotril = findMedicamentoByName('Rivotril');
    expect(rivotril?.tarja).toBe('preta');
    expect(rivotril && medicamentoTarjaLabel(rivotril)).toContain('controle especial');
  });

  it('marca antibiótico como receita retida', () => {
    expect(findMedicamentoByName('Amoxicilina 500mg')?.tarja).toBe('vermelha-retencao');
  });

  it('marca analgésico comum como venda livre', () => {
    expect(findMedicamentoByName('Paracetamol 750mg')?.tarja).toBe('sem-tarja');
  });

  it('monta a linha de apresentação e o rótulo da categoria', () => {
    const losartana = findMedicamentoByName('Losartana');
    expect(losartana && medicamentoPresentation(losartana)).toBe('25, 50 e 100 mg · comprimido');
    expect(losartana && medicamentoCategoryLabel(losartana)).toBe('Coração e pressão');
  });

  it('filtra por categoria', () => {
    const diabetes = medicamentosByCategory('diabetes');
    expect(diabetes.length).toBeGreaterThan(10);
    expect(diabetes.every((m) => m.category === 'diabetes')).toBe(true);
  });
});
