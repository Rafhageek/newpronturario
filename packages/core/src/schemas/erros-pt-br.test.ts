import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import './erros-pt-br';
import { conditionSchema, surgerySchema, appointmentSchema } from './clinical';
import { medicationSchema, scheduleSchema } from './medication';
import { addressSchema, profileSchema } from './profile';
import { examMetricSchema } from './exam';

/**
 * Estes testes REPROVAM a versão anterior: cada `toBe` abaixo era uma frase em
 * INGLÊS confirmada por execução ("String must contain at most 10 character(s)",
 * "Required", "Expected number, received nan"), que virou texto na tela quando
 * a rodada anterior ligou a prop `error` nos campos.
 *
 * REPRO real do cliente: /perfil → Condições de saúde → colar texto longo no
 * campo CID-10 → Adicionar → a frase em inglês aparecia embaixo do campo e no
 * toast.
 */

function primeiraMensagem(r: z.SafeParseReturnType<unknown, unknown>): string | null {
  return r.success ? null : (r.error.issues[0]?.message ?? '');
}

describe('mensagens que o cliente viu em inglês', () => {
  it('CID-10 longo demais (antes: "String must contain at most 10 character(s)")', () => {
    const r = conditionSchema.safeParse({ name: 'Diabetes', cid10Code: 'X'.repeat(30) });
    expect(primeiraMensagem(r)).toBe('Use no máximo 10 caracteres.');
  });

  it('observação da condição longa demais', () => {
    const r = conditionSchema.safeParse({ name: 'Diabetes', notes: 'x'.repeat(600) });
    expect(primeiraMensagem(r)).toBe('Use no máximo 500 caracteres.');
  });

  it('hospital longo demais', () => {
    const r = surgerySchema.safeParse({ procedure: 'Cirurgia', hospital: 'h'.repeat(200) });
    expect(primeiraMensagem(r)).toBe('Use no máximo 160 caracteres.');
  });

  it('dosagem longa demais', () => {
    const r = medicationSchema.safeParse({ name: 'Dipirona', dosage: 'd'.repeat(200) });
    expect(primeiraMensagem(r)).toBe('Use no máximo 120 caracteres.');
  });

  it('endereço: rua, bairro e cidade longos demais', () => {
    expect(primeiraMensagem(addressSchema.safeParse({ street: 's'.repeat(200) }))).toBe(
      'Use no máximo 160 caracteres.',
    );
    expect(primeiraMensagem(addressSchema.safeParse({ neighborhood: 'b'.repeat(200) }))).toBe(
      'Use no máximo 120 caracteres.',
    );
    expect(primeiraMensagem(addressSchema.safeParse({ city: 'c'.repeat(200) }))).toBe(
      'Use no máximo 120 caracteres.',
    );
  });
});

describe('mapa de erros pt-BR — cobertura por código do Zod', () => {
  it('campo ausente (antes: "Required")', () => {
    expect(primeiraMensagem(z.object({ a: z.string() }).safeParse({}))).toBe('Campo obrigatório.');
  });

  it('null num campo de texto (antes: "Expected string, received null")', () => {
    expect(primeiraMensagem(z.string().safeParse(null))).toBe('Campo obrigatório.');
  });

  it('tipo errado (antes: "Expected object, received string")', () => {
    expect(primeiraMensagem(z.object({ a: z.string() }).safeParse('x'))).toBe(
      'Informe um formulário.',
    );
    expect(primeiraMensagem(z.string().safeParse(42))).toBe('Informe um texto.');
  });

  it('texto onde se espera número (antes: "Expected number, received nan")', () => {
    expect(primeiraMensagem(z.coerce.number().safeParse('abc'))).toBe('Informe um número.');
    expect(primeiraMensagem(z.number().safeParse('7'))).toBe('Informe um número.');
  });

  it('opção fora da lista (antes: "Invalid enum value…")', () => {
    expect(primeiraMensagem(z.enum(['a', 'b']).safeParse('z'))).toBe(
      'Escolha uma das opções da lista.',
    );
  });

  it('faixa numérica (antes: "Number must be…")', () => {
    expect(primeiraMensagem(z.number().min(18).safeParse(5))).toBe(
      'Informe um número a partir de 18.',
    );
    expect(primeiraMensagem(z.number().max(10).safeParse(50))).toBe('Informe um número até 10.');
    expect(primeiraMensagem(z.number().positive().safeParse(0))).toBe(
      'Informe um número maior que zero.',
    );
  });

  it('texto muito curto e lista vazia', () => {
    expect(primeiraMensagem(z.string().min(1).safeParse(''))).toBe('Campo obrigatório.');
    expect(primeiraMensagem(z.string().min(4).safeParse('ab'))).toBe(
      'Use pelo menos 4 caracteres.',
    );
    expect(primeiraMensagem(z.array(z.string()).min(1).safeParse([]))).toBe(
      'Selecione ao menos uma opção.',
    );
  });

  it('formatos: e-mail, link, identificador', () => {
    expect(primeiraMensagem(z.string().email().safeParse('x'))).toBe('E-mail inválido.');
    expect(primeiraMensagem(z.string().url().safeParse('x'))).toBe('Link inválido.');
    expect(primeiraMensagem(z.string().uuid().safeParse('x'))).toBe('Identificador inválido.');
  });

  it('data fora de faixa sai em dd/mm/aaaa', () => {
    const r = z.date().min(new Date('2020-01-01T00:00:00Z')).safeParse(new Date('2019-01-01T00:00:00Z'));
    expect(primeiraMensagem(r)).toBe('A data não pode ser antes de 01/01/2020.');
  });

  it('singular de caractere e item não sai errado', () => {
    expect(primeiraMensagem(z.string().max(1).safeParse('ab'))).toBe('Use no máximo 1 caractere.');
    expect(primeiraMensagem(z.array(z.string()).max(1).safeParse(['a', 'b']))).toBe(
      'Selecione no máximo 1 item.',
    );
  });

  it('dia da semana fora da faixa é NÚMERO, não texto', () => {
    const r = scheduleSchema.safeParse({
      medicationId: '11111111-1111-4111-8111-111111111111',
      daysOfWeek: [9],
    });
    expect(primeiraMensagem(r)).toBe('Informe um número até 6.');
  });
});

describe('mensagens escritas à mão continuam vencendo o mapa global', () => {
  it('as frases próprias dos schemas não foram trocadas', () => {
    expect(primeiraMensagem(conditionSchema.safeParse({ name: '' }))).toBe('Informe a condição.');
    expect(primeiraMensagem(medicationSchema.safeParse({ name: 'a' }))).toBe(
      'Informe o nome do medicamento.',
    );
    expect(primeiraMensagem(appointmentSchema.safeParse({ doctorName: 'Dr. Ana', scheduledAt: '' }))).toBe(
      'Informe data e hora.',
    );
    expect(primeiraMensagem(profileSchema.safeParse({ fullName: 'Ana', heightCm: 'abc' }))).toBe(
      'Altura inválida. Informe em centímetros (ex.: 170).',
    );
    expect(primeiraMensagem(profileSchema.safeParse({ fullName: 'Ana', cpf: '123' }))).toBe(
      'CPF inválido.',
    );
  });
});

/**
 * Valor de referência de exame — a armadilha armada do `examMetricSchema`.
 * Antes, `''` e `null` devolviam `{ success: true, data: 0 }` e, como ali não
 * há `.positive()`, o 0 passava CALADO: uma faixa de referência que ninguém
 * informou poderia ser exibida como "0" ao lado do resultado do exame.
 */
describe('examMetricSchema não inventa valor de referência', () => {
  it('vazio e null saem como NÃO INFORMADO, não como 0', () => {
    const r = examMetricSchema.safeParse({
      name: 'Hemoglobina',
      value: '',
      refMin: null,
      refMax: '   ',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.value).toBeUndefined();
      expect(r.data.refMin).toBeUndefined();
      expect(r.data.refMax).toBeUndefined();
    }
  });

  it('zero DIGITADO de verdade continua valendo (0 é resultado plausível)', () => {
    const r = examMetricSchema.safeParse({ name: 'Bastonetes', value: '0', refMin: 0 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.value).toBe(0);
      expect(r.data.refMin).toBe(0);
    }
  });

  it('vírgula decimal do Brasil vale (antes reprovava)', () => {
    const r = examMetricSchema.safeParse({ name: 'Hemoglobina', value: '12,5', refMin: '12,0' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.value).toBe(12.5);
      expect(r.data.refMin).toBe(12);
    }
  });

  it('texto REPROVA em português em vez de virar 0', () => {
    const r = examMetricSchema.safeParse({ name: 'Hemoglobina', value: 'baixo' });
    expect(r.success).toBe(false);
    expect(primeiraMensagem(r)).toBe('Número inválido.');
  });
});
