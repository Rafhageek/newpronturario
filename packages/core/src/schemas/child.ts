import { z } from 'zod';

const THIRTEEN_YEARS_MS = 13 * 365.25 * 24 * 60 * 60 * 1000;

/** Cadastro de criança (v1: 0–12 anos). */
export const addChildSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe o nome.').max(120),
  birthDate: z.coerce
    .date({ invalid_type_error: 'Informe a data de nascimento.' })
    .refine((d) => d.getTime() <= Date.now(), 'A data não pode ser no futuro.')
    .refine((d) => Date.now() - d.getTime() <= THIRTEEN_YEARS_MS, 'No momento, a caderneta cobre crianças de 0 a 12 anos.'),
  sex: z.enum(['male', 'female'], { invalid_type_error: 'Selecione o sexo.' }),
  birthWeightG: z.coerce.number().int().min(200).max(7000).optional(),
  birthLengthCm: z.coerce.number().min(20).max(70).optional(),
  birthHeadCircumferenceCm: z.coerce.number().min(20).max(50).optional(),
  gestationalAgeWeeksAtBirth: z.coerce.number().int().min(20).max(45).optional(),
  deliveryType: z.enum(['vaginal', 'cesarean']).optional(),
  bloodType: z.string().optional(),
});
export type AddChildInput = z.infer<typeof addChildSchema>;

/** Nova medida antropométrica (pelo menos um valor). */
export const growthMeasurementSchema = z
  .object({
    measuredAt: z.coerce.date().optional(),
    weightKg: z.coerce.number().positive().max(149).optional(),
    lengthOrHeightCm: z.coerce.number().positive().max(229).optional(),
    headCircumferenceCm: z.coerce.number().positive().max(69).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine(
    (d) => d.weightKg != null || d.lengthOrHeightCm != null || d.headCircumferenceCm != null,
    { path: ['weightKg'], message: 'Informe ao menos uma medida (peso, altura ou perímetro cefálico).' },
  );
export type GrowthMeasurementInput = z.infer<typeof growthMeasurementSchema>;

/** Registro de vacina aplicada. */
export const recordVaccineSchema = z.object({
  vaccineName: z.string().trim().min(2, 'Informe a vacina.').max(120),
  doseLabel: z.string().trim().max(60).optional(),
  appliedAt: z.coerce.date().optional(),
  lot: z.string().trim().max(60).optional(),
  manufacturer: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
});
export type RecordVaccineInput = z.infer<typeof recordVaccineSchema>;
