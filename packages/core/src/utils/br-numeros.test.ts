import { describe, expect, it } from 'vitest';
import { parseNumeroBR } from './br';

describe('parseNumeroBR — pontuação brasileira', () => {
  it('aceita a vírgula decimal (o jeito que o teclado daqui escreve)', () => {
    expect(parseNumeroBR('36,5')).toBe(36.5);
    expect(parseNumeroBR('0,5')).toBe(0.5);
    expect(parseNumeroBR('1234,5')).toBe(1234.5);
  });

  it('aceita o ponto decimal do teclado numérico', () => {
    expect(parseNumeroBR('36.5')).toBe(36.5);
    expect(parseNumeroBR('98.6')).toBe(98.6);
  });

  it('lê o ponto de milhar — a glicemia de quatro dígitos', () => {
    expect(parseNumeroBR('1.234')).toBe(1234);
    expect(parseNumeroBR('1.234,5')).toBe(1234.5);
    expect(parseNumeroBR('1.234.567')).toBe(1234567);
  });

  it('milhar com decimal não vira NaN (o bug do replace de uma vírgula só)', () => {
    // `'1.234,5'.replace(',', '.')` dava `'1.234.5'` → Number = NaN, e o
    // registro voltava como toast vermelho genérico.
    expect(Number.isNaN(parseNumeroBR('1.234,5') as number)).toBe(false);
  });

  it('zero antes do ponto é decimal, não milhar', () => {
    expect(parseNumeroBR('0.123')).toBe(0.123);
  });

  it('inteiro simples continua inteiro', () => {
    expect(parseNumeroBR('120')).toBe(120);
    expect(parseNumeroBR('80')).toBe(80);
  });

  it('espaço em volta não atrapalha', () => {
    expect(parseNumeroBR('  36,5  ')).toBe(36.5);
  });

  it('campo em branco é "não informado", não zero', () => {
    expect(parseNumeroBR('')).toBeUndefined();
    expect(parseNumeroBR('   ')).toBeUndefined();
  });

  it('o que não é número vira NaN — nunca some calado nem vira 0', () => {
    expect(Number.isNaN(parseNumeroBR('abc') as number)).toBe(true);
    expect(Number.isNaN(parseNumeroBR('1,5.5') as number)).toBe(true);
    expect(Number.isNaN(parseNumeroBR('1,2,3') as number)).toBe(true);
    expect(Number.isNaN(parseNumeroBR('1 20') as number)).toBe(true);
  });

  it('negativo sobrevive (o schema é que decide se cabe no campo)', () => {
    expect(parseNumeroBR('-2,5')).toBe(-2.5);
    expect(parseNumeroBR('-1.234')).toBe(-1234);
  });
});
