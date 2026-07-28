import { z } from 'zod';
import { isValidCPF } from '../utils/br';

export const addressSchema = z.object({
  zip: z.string().trim().max(12).optional().or(z.literal('')),
  street: z.string().trim().max(160).optional().or(z.literal('')),
  number: z.string().trim().max(20).optional().or(z.literal('')),
  /** Bairro. Cabe sem migração: `profiles.address` é coluna JSON. */
  neighborhood: z.string().trim().max(120).optional().or(z.literal('')),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  state: z.string().trim().max(40).optional().or(z.literal('')),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe seu nome completo.'),
  dateOfBirth: z.coerce.date().max(new Date(), 'Data de nascimento no futuro.').optional(),
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
  heightCm: z.coerce.number().positive('Altura inválida.').max(280).optional(),
  emergencyNote: z.string().trim().max(500).optional().or(z.literal('')),
});
export type ProfileInput = z.infer<typeof profileSchema>;
