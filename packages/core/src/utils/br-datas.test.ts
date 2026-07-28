import { describe, expect, it } from 'vitest';
import {
  dateBRToIso,
  isValidCEP,
  isValidDateBR,
  isoToDateBR,
  maskCEP,
  maskCPF,
  maskDateBR,
} from './br';

describe('máscaras progressivas', () => {
  it('CPF ganha separador conforme digita', () => {
    expect(maskCPF('123')).toBe('123');
    expect(maskCPF('1234')).toBe('123.4');
    expect(maskCPF('1234567')).toBe('123.456.7');
    expect(maskCPF('12345678901')).toBe('123.456.789-01');
  });

  it('CPF ignora o que passa de 11 dígitos e o que não é número', () => {
    expect(maskCPF('123.456.789-0123')).toBe('123.456.789-01');
    expect(maskCPF('abc123')).toBe('123');
  });

  it('CEP vira 00000-000', () => {
    expect(maskCEP('51030')).toBe('51030');
    expect(maskCEP('51030310')).toBe('51030-310');
    expect(maskCEP('510303109999')).toBe('51030-310');
  });

  it('data ganha as barras conforme digita', () => {
    expect(maskDateBR('28')).toBe('28');
    expect(maskDateBR('2805')).toBe('28/05');
    expect(maskDateBR('28051972')).toBe('28/05/1972');
    expect(maskDateBR('28/05/1972999')).toBe('28/05/1972');
  });

  it('isValidCEP exige 8 dígitos', () => {
    expect(isValidCEP('51030-310')).toBe(true);
    expect(isValidCEP('5103031')).toBe(false);
  });
});

describe('conversão de data BR ↔ ISO', () => {
  it('ISO do banco vira DD/MM/AAAA na tela', () => {
    expect(isoToDateBR('1972-05-28')).toBe('28/05/1972');
    // Aceita timestamp completo, não só a data pura.
    expect(isoToDateBR('1972-05-28T03:00:00.000Z')).toBe('28/05/1972');
  });

  it('ISO ausente ou irreconhecível vira string vazia, nunca lixo na tela', () => {
    expect(isoToDateBR(null)).toBe('');
    expect(isoToDateBR(undefined)).toBe('');
    expect(isoToDateBR('')).toBe('');
    expect(isoToDateBR('28/05/1972')).toBe('');
  });

  it('DD/MM/AAAA da tela vira ISO para o banco', () => {
    expect(dateBRToIso('28/05/1972')).toBe('1972-05-28');
    expect(dateBRToIso('01/01/2000')).toBe('2000-01-01');
  });

  it('data incompleta não vira ISO', () => {
    expect(dateBRToIso('28/05')).toBeNull();
    expect(dateBRToIso('')).toBeNull();
    expect(dateBRToIso('1972-05-28')).toBeNull();
  });

  describe('datas que não existem são REJEITADAS, não ajustadas', () => {
    // `new Date(2023, 1, 31)` vira 03/03 em silêncio. Num prontuário, data
    // inventada é pior que data ausente — por isso estes casos devolvem null.
    it('31 de fevereiro não existe', () => {
      expect(dateBRToIso('31/02/2023')).toBeNull();
    });

    it('29 de fevereiro só existe em ano bissexto', () => {
      expect(dateBRToIso('29/02/2023')).toBeNull();
      expect(dateBRToIso('29/02/2024')).toBe('2024-02-29');
      // 1900 não é bissexto (divisível por 100 e não por 400).
      expect(dateBRToIso('29/02/1900')).toBeNull();
      expect(dateBRToIso('29/02/2000')).toBe('2000-02-29');
    });

    it('31 em mês de 30 dias não existe', () => {
      expect(dateBRToIso('31/04/2024')).toBeNull();
      expect(dateBRToIso('30/04/2024')).toBe('2024-04-30');
    });

    it('mês e dia fora da faixa', () => {
      expect(dateBRToIso('10/13/2024')).toBeNull();
      expect(dateBRToIso('00/10/2024')).toBeNull();
      expect(dateBRToIso('10/00/2024')).toBeNull();
    });
  });

  it('ida e volta preserva a data', () => {
    for (const iso of ['1972-05-28', '2024-02-29', '2000-12-31']) {
      expect(dateBRToIso(isoToDateBR(iso))).toBe(iso);
    }
  });

  it('campo vazio conta como válido (a data é opcional)', () => {
    expect(isValidDateBR('')).toBe(true);
    expect(isValidDateBR('  ')).toBe(true);
    expect(isValidDateBR('28/05/1972')).toBe(true);
    expect(isValidDateBR('31/02/2023')).toBe(false);
    expect(isValidDateBR('28/05')).toBe(false);
  });
});
