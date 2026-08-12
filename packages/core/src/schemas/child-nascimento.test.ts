import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { addChildSchema, growthMeasurementSchema } from './child';

/**
 * Data de nascimento de criança — o campo mais perigoso do cadastro infantil.
 *
 * O que este arquivo tranca (defeito confirmado por execução antes da correção):
 *
 * 1. `z.coerce.date({ invalid_type_error: '…' })` NUNCA usava a mensagem. A
 *    coerção rodava primeiro e transformava `''` e `undefined` em Invalid Date,
 *    então o Zod emitia `invalid_date` e a frase que chegava na tela era
 *    **"Invalid date"** — em inglês, num app de saúde em português, exibida
 *    literalmente por `add-child-modal.tsx` (`parsed.error.issues[0]?.message`).
 *
 * 2. Pior: `'2020-02-31'` PASSAVA. O `new Date` do JS rola data impossível em
 *    silêncio e devolvia 02/03/2020. Data de nascimento INVENTADA que alimenta
 *    o cálculo de idade dos percentis da OMS (`utils/growth.ts`, z-score LMS
 *    por idade) — o gráfico de crescimento sairia deslocado sem ninguém saber.
 *
 * 3. `null` passava pela coerção como 01/01/1970 e reprovava com a mensagem
 *    errada ("cobre crianças de 0 a 12 anos"), escondendo o campo em branco.
 *
 * Estes testes REPROVAM a versão anterior: os casos 1 e 3 esperam frase em
 * português onde saía inglês/mensagem errada, e o caso 2 espera `success:false`
 * onde saía `success:true`.
 */

const BASE = { fullName: 'Maria Silva', sex: 'female' as const };

function erro(entrada: unknown) {
  const r = addChildSchema.safeParse(entrada);
  if (r.success) return null;
  return r.error.issues[0]?.message ?? '';
}

/** Data de N anos atrás, sempre válida no calendário. */
function anosAtras(anos: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anos);
  return d.toISOString().slice(0, 10);
}

describe('addChildSchema.birthDate', () => {
  it('campo em branco reprova COM MENSAGEM EM PORTUGUÊS (antes: "Invalid date")', () => {
    expect(erro({ ...BASE, birthDate: '' })).toBe('Informe a data de nascimento.');
  });

  it('só espaços também reprova em português', () => {
    expect(erro({ ...BASE, birthDate: '   ' })).toBe('Informe a data de nascimento.');
  });

  it('campo ausente reprova em português (antes: "Invalid date")', () => {
    expect(erro({ ...BASE })).toBe('Informe a data de nascimento.');
    expect(erro({ ...BASE, birthDate: undefined })).toBe('Informe a data de nascimento.');
  });

  it('null reprova pelo motivo CERTO (antes virava 01/01/1970 e acusava faixa etária)', () => {
    expect(erro({ ...BASE, birthDate: null })).toBe('Informe a data de nascimento.');
  });

  it('texto que não é data reprova em português', () => {
    expect(erro({ ...BASE, birthDate: 'abc' })).toBe('Informe a data de nascimento.');
  });

  it('DATA INVENTADA: 31 de fevereiro REPROVA (antes: passava como 02/03)', () => {
    const r = addChildSchema.safeParse({ ...BASE, birthDate: '2020-02-31' });
    expect(r.success).toBe(false);
    expect(erro({ ...BASE, birthDate: '2020-02-31' })).toBe('Informe a data de nascimento.');
  });

  it('DATA INVENTADA: 31/04 e 30/02 em ano bissexto também reprovam', () => {
    expect(addChildSchema.safeParse({ ...BASE, birthDate: '2021-04-31' }).success).toBe(false);
    expect(addChildSchema.safeParse({ ...BASE, birthDate: '2020-02-30' }).success).toBe(false);
  });

  it('29 de fevereiro de ano bissexto continua VALENDO (não é dado inventado)', () => {
    const r = addChildSchema.safeParse({ ...BASE, birthDate: '2024-02-29' });
    expect(r.success).toBe(true);
  });

  it('data válida passa e sai como Date', () => {
    const nascimento = anosAtras(4);
    const r = addChildSchema.safeParse({ ...BASE, birthDate: nascimento });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.birthDate).toBeInstanceOf(Date);
      expect(r.data.birthDate.toISOString().slice(0, 10)).toBe(nascimento);
    }
  });

  it('data no futuro reprova com a frase de futuro', () => {
    expect(erro({ ...BASE, birthDate: '2099-01-01' })).toBe('A data não pode ser no futuro.');
  });

  it('mais de 13 anos reprova com a frase de faixa etária', () => {
    expect(erro({ ...BASE, birthDate: anosAtras(20) })).toBe(
      'No momento, a caderneta cobre crianças de 0 a 12 anos.',
    );
  });

  it('CONTINUA OBRIGATÓRIO: o tipo de saída é Date, nunca undefined', () => {
    const r = addChildSchema.safeParse({ ...BASE, birthDate: anosAtras(2) });
    expect(r.success).toBe(true);
    if (r.success) {
      // Checagem de tipo em tempo de compilação: se `birthDate` virasse
      // opcional, esta atribuição deixaria de compilar no `typecheck`.
      const d: Date = r.data.birthDate;
      expect(d.getTime()).not.toBeNaN();
    }
  });
});

describe('addChildSchema — sexo e dados do nascimento', () => {
  it('sexo em branco reprova em português (antes: "Required")', () => {
    expect(erro({ fullName: 'Maria Silva', birthDate: anosAtras(3) })).toBe('Selecione o sexo.');
  });

  it('campo numérico vazio é OPCIONAL, não vira 0 reprovado em inglês', () => {
    const r = addChildSchema.safeParse({
      ...BASE,
      birthDate: anosAtras(3),
      birthWeightG: '',
      birthLengthCm: '',
      birthHeadCircumferenceCm: '',
      gestationalAgeWeeksAtBirth: '',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.birthWeightG).toBeUndefined();
      expect(r.data.birthLengthCm).toBeUndefined();
    }
  });

  it('vírgula decimal do Brasil vale (49,5 cm)', () => {
    const r = addChildSchema.safeParse({
      ...BASE,
      birthDate: anosAtras(3),
      birthLengthCm: '49,5',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.birthLengthCm).toBe(49.5);
  });

  it('número fora da faixa reprova com frase em português', () => {
    expect(erro({ ...BASE, birthDate: anosAtras(3), birthWeightG: '50' })).toBe(
      'Peso ao nascer inválido. Informe em gramas (ex.: 3200).',
    );
  });

  it('texto em campo numérico reprova (não vira 0)', () => {
    expect(erro({ ...BASE, birthDate: anosAtras(3), birthWeightG: 'abc' })).toBe(
      'Peso ao nascer inválido. Informe em gramas (ex.: 3200).',
    );
  });
});

describe('growthMeasurementSchema', () => {
  it('todas as medidas em branco caem na frase certa, não em "maior que 0"', () => {
    const r = growthMeasurementSchema.safeParse({
      weightKg: '',
      lengthOrHeightCm: '',
      headCircumferenceCm: '',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe(
        'Informe ao menos uma medida (peso, altura ou perímetro cefálico).',
      );
    }
  });

  it('peso com vírgula é aceito e as outras medidas ficam em branco', () => {
    const r = growthMeasurementSchema.safeParse({ weightKg: '12,4', lengthOrHeightCm: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.weightKg).toBe(12.4);
      expect(r.data.lengthOrHeightCm).toBeUndefined();
    }
  });
});

/**
 * Rede de segurança de idioma. Não vale só para os campos de hoje: qualquer
 * mensagem em inglês que voltar a vazar por estes schemas quebra este teste.
 */
const PALAVRAS_EM_INGLES =
  /\b(Required|Expected|Invalid|String|Number|Array|Date|must|contain|character|greater|less|received|at least|at most)\b/;

describe('nenhuma mensagem em inglês chega ao usuário', () => {
  const casos: Array<[string, unknown]> = [
    ['tudo vazio', {}],
    ['não é objeto', 'texto solto'],
    ['nome longo demais', { ...BASE, birthDate: '2020-01-01', fullName: 'n'.repeat(200) }],
    ['sexo inválido', { ...BASE, sex: 'outro', birthDate: '2020-01-01' }],
    ['data lixo', { ...BASE, birthDate: '@@@' }],
    ['peso texto', { ...BASE, birthDate: '2020-01-01', birthWeightG: 'abc' }],
    ['gestação fora da faixa', { ...BASE, birthDate: '2020-01-01', gestationalAgeWeeksAtBirth: 99 }],
    ['tipo de parto inválido', { ...BASE, birthDate: '2020-01-01', deliveryType: 'x' }],
  ];

  it.each(casos)('%s', (_nome, entrada) => {
    const r = addChildSchema.safeParse(entrada);
    expect(r.success).toBe(false);
    if (!r.success) {
      for (const issue of r.error.issues) {
        expect(issue.message, `mensagem em inglês: "${issue.message}"`).not.toMatch(
          PALAVRAS_EM_INGLES,
        );
      }
    }
  });

  it('o mapa global do Zod está instalado (schema criado fora dos nossos arquivos)', () => {
    const avulso = z.object({ nome: z.string().max(3), idade: z.number().min(18) });
    const r = avulso.safeParse({ nome: 'muito longo', idade: 5 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message)).toEqual([
        'Use no máximo 3 caracteres.',
        'Informe um número a partir de 18.',
      ]);
    }
  });
});
