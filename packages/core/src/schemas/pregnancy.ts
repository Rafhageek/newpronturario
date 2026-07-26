import { z } from 'zod';

/**
 * Onboarding da gestação: a usuária informa a DPP **ou** a DUM (ao menos uma).
 * Nunca inferimos risco — `riskLevel` só existe se ela/o médico informar.
 */
export const startPregnancySchema = z
  .object({
    dueDate: z.coerce.date().optional(),
    lmpDate: z.coerce.date().optional(),
    riskLevel: z.enum(['habitual', 'alto']).optional(),
    obstetricianName: z.string().trim().max(120).optional(),
    obstetricianCrm: z.string().trim().max(20).optional(),
    obstetricianPhone: z.string().trim().max(20).optional(),
    maternityReference: z.string().trim().max(160).optional(),
    maternityPhone: z.string().trim().max(20).optional(),
  })
  .refine((d) => d.dueDate != null || d.lmpDate != null, {
    path: ['dueDate'],
    message: 'Informe a data provável do parto (DPP) ou a data da última menstruação (DUM).',
  });
export type StartPregnancyInput = z.infer<typeof startPregnancySchema>;

/** Registro de peso por semana gestacional. */
export const pregnancyWeightSchema = z.object({
  week: z.coerce
    .number({ invalid_type_error: 'Informe a semana.' })
    .int()
    .min(1, 'Semana mínima é 1.')
    .max(42, 'Semana máxima é 42.'),
  weightKg: z.coerce
    .number({ invalid_type_error: 'Informe o peso.' })
    .positive('Peso deve ser positivo.')
    .max(399, 'Valor inválido.'),
});
export type PregnancyWeightInput = z.infer<typeof pregnancyWeightSchema>;

/** Registro de movimentos fetais — apenas dados, sem interpretação. */
export const fetalMovementSchema = z.object({
  durationMinutes: z.coerce.number().int().min(0).max(600).optional(),
  movementsCount: z.coerce.number().int().min(0).max(1000).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type FetalMovementInput = z.infer<typeof fetalMovementSchema>;
