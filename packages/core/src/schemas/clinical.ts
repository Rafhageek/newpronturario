import { z } from 'zod';

/** Convênio. */
export const insuranceSchema = z.object({
  operator: z.string().trim().min(2, 'Informe a operadora.'),
  cardNumber: z.string().trim().max(60).optional().or(z.literal('')),
  validUntil: z.coerce.date().optional(),
  isPrimary: z.boolean().default(true),
});
export type InsuranceInput = z.infer<typeof insuranceSchema>;

/** Condição de saúde (CID-10). */
export const conditionSchema = z.object({
  name: z.string().trim().min(2, 'Informe a condição.'),
  cid10Code: z.string().trim().max(10).optional().or(z.literal('')),
  status: z.enum(['active', 'controlled', 'resolved', 'suspected']).default('active'),
  diagnosedAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});
export type ConditionInput = z.infer<typeof conditionSchema>;

/** Alergia. */
export const allergySchema = z.object({
  substance: z.string().trim().min(2, 'Informe a substância.'),
  severity: z.enum(['mild', 'moderate', 'severe']).default('moderate'),
  reaction: z.string().trim().max(200).optional().or(z.literal('')),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
});
export type AllergyInput = z.infer<typeof allergySchema>;

/** Cirurgia / procedimento. */
export const surgerySchema = z.object({
  procedure: z.string().trim().min(2, 'Informe o procedimento.'),
  performedAt: z.coerce.date().optional(),
  hospital: z.string().trim().max(160).optional().or(z.literal('')),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
});
export type SurgeryInput = z.infer<typeof surgerySchema>;

/** Antecedente familiar. */
export const familyHistorySchema = z.object({
  condition: z.string().trim().min(2, 'Informe a condição.'),
  relationship: z
    .enum(['mother', 'father', 'sibling', 'grandparent', 'child', 'other'])
    .default('other'),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
});
export type FamilyHistoryInput = z.infer<typeof familyHistorySchema>;

/** Consulta. */
export const appointmentSchema = z.object({
  doctorName: z.string().trim().min(2, 'Informe o nome do médico.'),
  doctorCrm: z.string().trim().max(40).optional().or(z.literal('')),
  specialty: z.string().trim().max(120).optional().or(z.literal('')),
  scheduledAt: z.coerce.date({ required_error: 'Informe data e hora.' }),
  kind: z.enum(['in_person', 'telehealth']).default('in_person'),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  meetingLink: z.string().trim().url('Link inválido.').max(500).optional().or(z.literal('')),
  reminders: z.array(z.number().int()).default([1440, 60]),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});
export type AppointmentInput = z.infer<typeof appointmentSchema>;
