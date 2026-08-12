import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { numeroOpcional, criaNumeroOpcional } from './numero-opcional';

/**
 * Regressão do bug que fazia o formulário acusar erro num campo em branco:
 * `<input type="number">` vazio manda `''`, `Number('')` é 0, e um
 * `z.coerce.number().positive().optional()` reprovava um valor que o usuário
 * nunca digitou. Estes testes reprovam a versão antiga.
 */

type Igual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const _tipo: Igual<z.infer<typeof numeroOpcional>, number | undefined> = true;
void _tipo;

describe('numeroOpcional (helper)', () => {
  it('trata vazio, espaços, null e undefined como "não informado"', () => {
    for (const entrada of ['', '   ', '\t', null, undefined]) {
      const r = numeroOpcional.safeParse(entrada);
      expect(r.success, `entrada: ${JSON.stringify(entrada)}`).toBe(true);
      if (r.success) expect(r.data).toBeUndefined();
    }
  });

  it('NÃO transforma vazio em 0 (0 é um valor plausível num prontuário)', () => {
    const r = numeroOpcional.safeParse('');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).not.toBe(0);
  });

  it('aceita número e string numérica', () => {
    expect(numeroOpcional.parse(170)).toBe(170);
    expect(numeroOpcional.parse('170')).toBe(170);
    expect(numeroOpcional.parse('  170.5  ')).toBe(170.5);
    expect(numeroOpcional.parse('-3')).toBe(-3);
  });

  it('entende a vírgula decimal do Brasil', () => {
    expect(numeroOpcional.parse('170,5')).toBe(170.5);
    expect(numeroOpcional.parse('  3,25 ')).toBe(3.25);
    expect(numeroOpcional.parse('-1,5')).toBe(-1.5);
  });

  it('aceita o zero quando ele foi realmente digitado', () => {
    expect(numeroOpcional.parse('0')).toBe(0);
    expect(numeroOpcional.parse(0)).toBe(0);
  });

  it('REPROVA texto e pontuação ambígua em vez de "consertar" para um número', () => {
    for (const lixo of ['abc', '1 70', '1.234,5', '12,', ',5', '--3', true, [], {}]) {
      expect(numeroOpcional.safeParse(lixo).success, `deveria reprovar: ${JSON.stringify(lixo)}`).toBe(false);
    }
  });

  it('usa mensagem em português quando reprova', () => {
    const r = numeroOpcional.safeParse('abc');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('Número inválido.');
  });

  it('criaNumeroOpcional aceita mensagem própria', () => {
    const altura = criaNumeroOpcional('Altura inválida.');
    const r = altura.safeParse('abc');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('Altura inválida.');
  });

  it('combina com faixa via .pipe sem perder o "opcional"', () => {
    const altura = criaNumeroOpcional('Altura inválida.').pipe(
      z.number().positive('Altura inválida.').max(280, 'Altura inválida.').optional(),
    );
    expect(altura.parse('')).toBeUndefined();
    expect(altura.parse('170')).toBe(170);
    expect(altura.safeParse('0').success).toBe(false);
    expect(altura.safeParse('999').success).toBe(false);
  });
});
