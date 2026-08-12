import { z } from 'zod';
import { dataOpcional } from './data-opcional';

/** Registro diário do ciclo. */
export const cycleLogSchema = z.object({
  logDate: dataOpcional,
  flowLevel: z.coerce.number().int().min(0).max(3).default(0),
  symptoms: z.array(z.string()).default([]),
  mood: z.array(z.string()).default([]),
  notes: z.string().trim().max(500).optional(),
});
export type CycleLogInput = z.infer<typeof cycleLogSchema>;

/** Preferências do ciclo (inclui compartilhamento opt-in por escopo). */
export const cycleSettingsSchema = z.object({
  trackingEnabled: z.boolean().optional(),
  averageCycleDays: z.coerce.number().int().min(15).max(60).optional(),
  averagePeriodDays: z.coerce.number().int().min(1).max(15).optional(),
  contraceptiveMethod: z.string().trim().max(120).optional(),
  shareWithCaregiver: z.boolean().optional(),
  shareWithDoctor: z.boolean().optional(),
  shareWithResearch: z.boolean().optional(),
});
export type CycleSettingsInput = z.infer<typeof cycleSettingsSchema>;
