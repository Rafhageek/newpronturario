import { describe, it, expect } from 'vitest';
import { calculateAge, isMinor, formatVital, buildExamStoragePath, ownerIdFromStoragePath } from './health';
import { isValidCPF, formatCPF, onlyDigits } from './br';

describe('calculateAge / isMinor', () => {
  const ref = new Date('2026-06-05T00:00:00Z');

  it('calcula idade considerando o mês/dia', () => {
    expect(calculateAge('2000-06-05', ref)).toBe(26);
    expect(calculateAge('2000-06-06', ref)).toBe(25); // aniversário ainda não chegou
  });

  it('identifica menor de idade', () => {
    expect(isMinor('2015-01-01', ref)).toBe(true);
    expect(isMinor('1990-01-01', ref)).toBe(false);
  });

  it('lança erro para data inválida', () => {
    expect(() => calculateAge('data-invalida', ref)).toThrow();
  });
});

describe('formatVital', () => {
  it('formata pressão arterial como sistólica/diastólica', () => {
    expect(
      formatVital({ type: 'blood_pressure', value_primary: 120, value_secondary: 80, unit: 'mmHg' }),
    ).toBe('120/80 mmHg');
  });

  it('formata medição simples', () => {
    expect(
      formatVital({ type: 'glucose', value_primary: 95, value_secondary: null, unit: 'mg/dL' }),
    ).toBe('95 mg/dL');
  });
});

describe('storage path helpers', () => {
  it('prefixa o caminho com o id do dono e sanitiza o nome', () => {
    expect(buildExamStoragePath('user-1', 'exame final.pdf')).toBe('user-1/exame_final.pdf');
  });

  it('extrai o dono do caminho', () => {
    expect(ownerIdFromStoragePath('user-1/exame.pdf')).toBe('user-1');
  });
});

describe('CPF', () => {
  it('valida CPF correto', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
  });

  it('rejeita CPF com dígito verificador errado', () => {
    expect(isValidCPF('529.982.247-20')).toBe(false);
  });

  it('rejeita sequências repetidas', () => {
    expect(isValidCPF('111.111.111-11')).toBe(false);
  });

  it('formata e extrai dígitos', () => {
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
    expect(onlyDigits('529.982.247-25')).toBe('52998224725');
  });
});
