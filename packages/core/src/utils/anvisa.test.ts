import { describe, it, expect } from 'vitest';
import {
  normalizeAnvisaName,
  buildBulaSearchUrl,
  buildBulaProfessionalUrl,
  resolveBulaUrl,
} from './anvisa';

const BASE = 'https://consultas.anvisa.gov.br/#/bulario/';

describe('normalizeAnvisaName', () => {
  it.each([
    ['Losartana', 'LOSARTANA'],
    ['paracetamol', 'PARACETAMOL'],
    ['Ácido acetilsalicílico', 'ACIDO ACETILSALICILICO'],
    ['Captopril 25mg', 'CAPTOPRIL 25MG'],
    ['  Insulina   NPH ', 'INSULINA NPH'],
  ])('%s → %s', (input, out) => {
    expect(normalizeAnvisaName(input)).toBe(out);
  });
});

describe('buildBulaSearchUrl', () => {
  it.each(['Losartana', 'Metformina', 'Omeprazol', 'Sinvastatina', 'Levotiroxina'])(
    'monta a busca para %s',
    (name) => {
      expect(buildBulaSearchUrl(name)).toBe(`${BASE}?nomeProduto=${encodeURIComponent(name)}`);
    },
  );
  it('faz o trim do nome', () => {
    expect(buildBulaSearchUrl('  Losartana  ')).toBe(`${BASE}?nomeProduto=Losartana`);
  });
  it('codifica espaços e acentos', () => {
    expect(buildBulaSearchUrl('Ácido fólico')).toContain('nomeProduto=');
    expect(buildBulaSearchUrl('Ácido fólico')).toContain(encodeURIComponent('Ácido fólico'));
  });
});

describe('buildBulaProfessionalUrl', () => {
  it('busca pelo número de registro', () => {
    expect(buildBulaProfessionalUrl('1.0000.0000.000-0')).toBe(
      `${BASE}?nomeProduto=${encodeURIComponent('1.0000.0000.000-0')}`,
    );
  });
});

describe('resolveBulaUrl', () => {
  it('prefere o número de registro quando existe', () => {
    expect(resolveBulaUrl({ name: 'Losartana', anvisa_registration: '1.1111.2222.333-4' })).toContain(
      encodeURIComponent('1.1111.2222.333-4'),
    );
  });
  it('usa o nome padronizado da Anvisa quando há', () => {
    expect(resolveBulaUrl({ name: 'Losartana 50mg', anvisa_drug_name: 'LOSARTANA POTASSICA' })).toContain(
      encodeURIComponent('LOSARTANA POTASSICA'),
    );
  });
  it('cai no nome do medicamento por padrão', () => {
    expect(resolveBulaUrl({ name: 'Metformina 850mg' })).toBe(
      `${BASE}?nomeProduto=${encodeURIComponent('Metformina 850mg')}`,
    );
  });
  it('ignora registro vazio', () => {
    expect(resolveBulaUrl({ name: 'Omeprazol', anvisa_registration: '   ' })).toContain('Omeprazol');
  });
});
