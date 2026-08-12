import { z } from 'zod';
// Garante as mensagens em português mesmo sem passar pelo `schemas/index.ts`.
import './erros-pt-br';
import { dataOpcional } from './data-opcional';

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
  dosage: z.string().trim().max(120, 'Use no máximo 120 caracteres.').optional().or(z.literal('')),
  unit: z.string().trim().max(20, 'Use no máximo 20 caracteres.').optional().or(z.literal('')),
  form: medicationFormEnum.default('tablet'),
  frequency: z.enum(['daily', 'weekly', 'as_needed']).default('daily'),
  times: z.array(timeOfDaySchema).default([]),
  prescriber: z.string().trim().max(120, 'Use no máximo 120 caracteres.').optional().or(z.literal('')),
  startedAt: dataOpcional,
  endedAt: dataOpcional,
  notes: z.string().trim().max(500, 'Use no máximo 500 caracteres.').optional().or(z.literal('')),
});
export type MedicationInput = z.infer<typeof medicationSchema>;

const intakeStatusEnum = z.enum(['pending', 'taken', 'skipped']);

export const intakeSchema = z.object({
  medicationId: z.string().uuid('Medicamento inválido.'),
  scheduleId: z.string().uuid().optional(),
  status: intakeStatusEnum.default('taken'),
  takenAt: dataOpcional,
  note: z.string().trim().max(300, 'Use no máximo 300 caracteres.').optional(),
});
export type IntakeInput = z.infer<typeof intakeSchema>;

export const scheduleSchema = z.object({
  medicationId: z.string().uuid(),
  frequency: z.enum(['daily', 'weekly', 'as_needed']).default('daily'),
  times: z.array(timeOfDaySchema).default([]),
  // Número (0 = domingo … 6 = sábado), não texto: a mensagem sai do mapa
  // pt-BR de `erros-pt-br.ts` ("Informe um número até 6.").
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  reminderEnabled: z.boolean().default(true),
});
export type ScheduleInput = z.infer<typeof scheduleSchema>;
