import { z } from 'zod';
// Garante as mensagens em português mesmo sem passar pelo `schemas/index.ts`.
import './erros-pt-br';
import { isValidCPF } from '../utils/br';
import { criaDataOpcional } from './data-opcional';
import { criaNumeroOpcional } from './numero-opcional';

/**
 * "Dados pessoais" é a primeira tela de quem está começando no app, e por isso
 * é a que mais dói quando trava. Data de nascimento e altura são OPCIONAIS —
 * o cadastro tem de salvar nome, tipo sanguíneo e observação de emergência
 * mesmo com os dois em branco. Ver `data-opcional.ts` e `numero-opcional.ts`
 * para o motivo de `''` não ser `undefined` num formulário.
 */
const MSG_NASCIMENTO = 'Data de nascimento inválida.';
const MSG_ALTURA = 'Altura inválida. Informe em centímetros (ex.: 170).';

export const addressSchema = z.object({
  zip: z.string().trim().max(12, 'Use no máximo 12 caracteres.').optional().or(z.literal('')),
  street: z.string().trim().max(160, 'Use no máximo 160 caracteres.').optional().or(z.literal('')),
  number: z.string().trim().max(20, 'Use no máximo 20 caracteres.').optional().or(z.literal('')),
  /** Bairro. Cabe sem migração: `profiles.address` é coluna JSON. */
  neighborhood: z.string().trim().max(120, 'Use no máximo 120 caracteres.').optional().or(z.literal('')),
  city: z.string().trim().max(120, 'Use no máximo 120 caracteres.').optional().or(z.literal('')),
  state: z.string().trim().max(40, 'Use no máximo 40 caracteres.').optional().or(z.literal('')),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe seu nome completo.'),
  /**
   * Opcional de verdade: `''` sai como `undefined`. Data que não existe no
   * calendário (`1971-02-31`) REPROVA em vez de virar 03/03 — data de
   * nascimento inventada depois alimenta `calculateAge` e os percentis da OMS.
   * A trava de futuro fica no `refine` porque ele compara com o `Date.now()` do
   * momento da validação; `.max(new Date())` congelava o "hoje" na hora em que
   * o módulo foi carregado.
   */
  dateOfBirth: criaDataOpcional(MSG_NASCIMENTO).refine(
    (d) => d == null || d.getTime() <= Date.now(),
    'Data de nascimento no futuro.',
  ),
  biologicalSex: z.enum(['female', 'male', 'intersex', 'unspecified']).default('unspecified'),
  bloodType: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'])
    .default('unknown'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{8,20}$/, 'Telefone inválido.')
    .optional()
    .or(z.literal('')),
  cpf: z
    .string()
    .trim()
    .refine((v) => v === '' || isValidCPF(v), 'CPF inválido.')
    .optional()
    .or(z.literal('')),
  address: addressSchema.optional(),
  /** Opcional de verdade: `''` sai como `undefined`, não vira 0 reprovado. */
  heightCm: criaNumeroOpcional(MSG_ALTURA).pipe(
    z.number().positive(MSG_ALTURA).max(280, MSG_ALTURA).optional(),
  ),
  emergencyNote: z.string().trim().max(500, 'Use no máximo 500 caracteres.').optional().or(z.literal('')),
});
export type ProfileInput = z.infer<typeof profileSchema>;
