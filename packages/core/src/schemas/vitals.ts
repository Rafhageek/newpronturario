import { z } from 'zod';

const vitalTypeEnum = z.enum([
  'blood_pressure',
  'glucose',
  'weight',
  'heart_rate',
  'temperature',
  'oxygen_saturation',
]);

/**
 * Registro de sinal vital. Para `blood_pressure`, exige value_secondary
 * (diastólica) e impõe sistólica > diastólica.
 */
export const vitalSchema = z
  .object({
    type: vitalTypeEnum,
    measuredAt: z.coerce.date().optional(),
    valuePrimary: z.number({ invalid_type_error: 'Informe um número.' }).positive('Valor deve ser positivo.'),
    valueSecondary: z.number().positive().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'blood_pressure') {
      if (data.valueSecondary == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['valueSecondary'],
          message: 'Informe a pressão diastólica.',
        });
      } else if (data.valuePrimary <= data.valueSecondary) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['valuePrimary'],
          message: 'A sistólica deve ser maior que a diastólica.',
        });
      }
    }
    // Limites de sanidade (não são diagnóstico — apenas evitam erro de digitação).
    if (data.type === 'oxygen_saturation' && data.valuePrimary > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valuePrimary'],
        message: 'Saturação não pode passar de 100%.',
      });
    }
  });

export type VitalInput = z.infer<typeof vitalSchema>;
