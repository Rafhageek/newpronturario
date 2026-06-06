import { z } from 'zod';

const medicationFormEnum = z.enum([
  'tablet',
  'capsule',
  'liquid',
  'injection',
  'drops',
  'inhaler',
  'cream',
  'other',
]);

/** Horário no formato HH:MM (24h). */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM).');

export const medicationSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do medicamento.'),
  dosage: z.string().trim().max(120).optional().or(z.literal('')),
  unit: z.string().trim().max(20).optional().or(z.literal('')),
  form: medicationFormEnum.default('tablet'),
  frequency: z.enum(['daily', 'weekly', 'as_needed']).default('daily'),
  times: z.array(timeOfDaySchema).default([]),
  prescriber: z.string().trim().max(120).optional().or(z.literal('')),
  startedAt: z.coerce.date().optional(),
  endedAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});
export type MedicationInput = z.infer<typeof medicationSchema>;

const intakeStatusEnum = z.enum(['pending', 'taken', 'skipped']);

export const intakeSchema = z.object({
  medicationId: z.string().uuid('Medicamento inválido.'),
  scheduleId: z.string().uuid().optional(),
  status: intakeStatusEnum.default('taken'),
  takenAt: z.coerce.date().optional(),
  note: z.string().trim().max(300).optional(),
});
export type IntakeInput = z.infer<typeof intakeSchema>;

export const scheduleSchema = z.object({
  medicationId: z.string().uuid(),
  frequency: z.enum(['daily', 'weekly', 'as_needed']).default('daily'),
  times: z.array(timeOfDaySchema).default([]),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  reminderEnabled: z.boolean().default(true),
});
export type ScheduleInput = z.infer<typeof scheduleSchema>;
