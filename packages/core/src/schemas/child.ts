import { z } from 'zod';
// Garante as mensagens em português mesmo quando este módulo é usado sem passar
// pelo `schemas/index.ts` (testes, imports relativos). Ver `erros-pt-br.ts`.
import './erros-pt-br';
import { criaDataObrigatoria, dataOpcional } from './data-opcional';
import { criaNumeroOpcional } from './numero-opcional';

const THIRTEEN_YEARS_MS = 13 * 365.25 * 24 * 60 * 60 * 1000;

const MSG_NASCIMENTO = 'Informe a data de nascimento.';
const MSG_PESO_NASCER = 'Peso ao nascer inválido. Informe em gramas (ex.: 3200).';
const MSG_COMPRIMENTO = 'Comprimento inválido. Informe em centímetros (ex.: 49).';
const MSG_PERIMETRO = 'Perímetro cefálico inválido. Informe em centímetros (ex.: 34).';
const MSG_GESTACAO = 'Idade gestacional inválida. Informe em semanas (ex.: 39).';

/** Cadastro de criança (v1: 0–12 anos). */
export const addChildSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe o nome.').max(120, 'Use no máximo 120 caracteres.'),
  /**
   * OBRIGATÓRIO — e continua obrigatório. O que mudou e por quê:
   * `z.coerce.date({ invalid_type_error })` NUNCA usava a mensagem, porque a
   * coerção transformava `''` e `undefined` em Invalid Date ANTES de o Zod
   * checar o tipo. O cuidador que abria "Adicionar criança" e clicava sem
   * preencher lia **"Invalid date"**, em inglês, na tela.
   *
   * Pior que a língua: `'2020-02-31'` PASSAVA e o Zod devolvia 02/03/2020 —
   * data de nascimento INVENTADA, que alimenta direto o cálculo de idade dos
   * percentis da OMS em `utils/growth.ts` (z-score LMS por idade). Com
   * `criaDataObrigatoria`, dia que não existe no calendário reprova, e vazio,
   * `null` e lixo caem todos na mesma frase em português.
   */
  birthDate: criaDataObrigatoria(MSG_NASCIMENTO)
    .refine((d) => d.getTime() <= Date.now(), 'A data não pode ser no futuro.')
    .refine(
      (d) => Date.now() - d.getTime() <= THIRTEEN_YEARS_MS,
      'No momento, a caderneta cobre crianças de 0 a 12 anos.',
    ),
  /**
   * `invalid_type_error` não cobre o campo em branco (`required_error` é que
   * dispara com `undefined`), e o seletor manda `undefined` quando ninguém
   * escolheu — era daí que saía o "Required" em inglês.
   */
  sex: z.enum(['male', 'female'], {
    required_error: 'Selecione o sexo.',
    invalid_type_error: 'Selecione o sexo.',
  }),
  /**
   * Dados do nascimento: opcionais DE VERDADE. Um `<input type="number">` vazio
   * manda `''`, que virava 0 na coerção e reprovava com "Number must be greater
   * than or equal to 200" — em inglês, sobre um número que ninguém digitou.
   * `criaNumeroOpcional` devolve `undefined` para o vazio e ainda aceita a
   * vírgula decimal do Brasil ("49,5"). Ver `numero-opcional.ts`.
   */
  birthWeightG: criaNumeroOpcional(MSG_PESO_NASCER).pipe(
    z.number().int(MSG_PESO_NASCER).min(200, MSG_PESO_NASCER).max(7000, MSG_PESO_NASCER).optional(),
  ),
  birthLengthCm: criaNumeroOpcional(MSG_COMPRIMENTO).pipe(
    z.number().min(20, MSG_COMPRIMENTO).max(70, MSG_COMPRIMENTO).optional(),
  ),
  birthHeadCircumferenceCm: criaNumeroOpcional(MSG_PERIMETRO).pipe(
    z.number().min(20, MSG_PERIMETRO).max(50, MSG_PERIMETRO).optional(),
  ),
  gestationalAgeWeeksAtBirth: criaNumeroOpcional(MSG_GESTACAO).pipe(
    z.number().int(MSG_GESTACAO).min(20, MSG_GESTACAO).max(45, MSG_GESTACAO).optional(),
  ),
  deliveryType: z.enum(['vaginal', 'cesarean']).optional(),
  bloodType: z.string().optional(),
});
export type AddChildInput = z.infer<typeof addChildSchema>;

const MSG_PESO = 'Peso inválido. Informe em quilos (ex.: 12,5).';
const MSG_ALTURA = 'Altura inválida. Informe em centímetros (ex.: 86).';
const MSG_PC = 'Perímetro cefálico inválido. Informe em centímetros (ex.: 47).';

/** Nova medida antropométrica (pelo menos um valor). */
export const growthMeasurementSchema = z
  .object({
    measuredAt: dataOpcional,
    /**
     * Mesmo defeito do cadastro: campo numérico vazio virava 0, o `.positive()`
     * reprovava e a tela acusava medida inválida sobre número não digitado —
     * travando o salvamento das medidas que o responsável REALMENTE preencheu.
     */
    weightKg: criaNumeroOpcional(MSG_PESO).pipe(
      z.number().positive(MSG_PESO).max(149, MSG_PESO).optional(),
    ),
    lengthOrHeightCm: criaNumeroOpcional(MSG_ALTURA).pipe(
      z.number().positive(MSG_ALTURA).max(229, MSG_ALTURA).optional(),
    ),
    headCircumferenceCm: criaNumeroOpcional(MSG_PC).pipe(
      z.number().positive(MSG_PC).max(69, MSG_PC).optional(),
    ),
    notes: z.string().trim().max(500, 'Use no máximo 500 caracteres.').optional(),
  })
  .refine(
    (d) => d.weightKg != null || d.lengthOrHeightCm != null || d.headCircumferenceCm != null,
    { path: ['weightKg'], message: 'Informe ao menos uma medida (peso, altura ou perímetro cefálico).' },
  );
export type GrowthMeasurementInput = z.infer<typeof growthMeasurementSchema>;

/** Registro de vacina aplicada. */
export const recordVaccineSchema = z.object({
  vaccineName: z.string().trim().min(2, 'Informe a vacina.').max(120, 'Use no máximo 120 caracteres.'),
  doseLabel: z.string().trim().max(60, 'Use no máximo 60 caracteres.').optional(),
  appliedAt: dataOpcional,
  lot: z.string().trim().max(60, 'Use no máximo 60 caracteres.').optional(),
  manufacturer: z.string().trim().max(80, 'Use no máximo 80 caracteres.').optional(),
  location: z.string().trim().max(120, 'Use no máximo 120 caracteres.').optional(),
});
export type RecordVaccineInput = z.infer<typeof recordVaccineSchema>;
