import { z } from 'zod';
// Garante as mensagens em português mesmo sem passar pelo `schemas/index.ts`.
import './erros-pt-br';
import { criaDataObrigatoria, dataOpcional } from './data-opcional';

/** Convênio. */
export const insuranceSchema = z.object({
  operator: z.string().trim().min(2, 'Informe a operadora.'),
  cardNumber: z.string().trim().max(60, 'Use no máximo 60 caracteres.').optional().or(z.literal('')),
  validUntil: dataOpcional,
  isPrimary: z.boolean().default(true),
});
export type InsuranceInput = z.infer<typeof insuranceSchema>;

/** Condição de saúde (CID-10). */
export const conditionSchema = z.object({
  name: z.string().trim().min(2, 'Informe a condição.'),
  cid10Code: z.string().trim().max(10, 'Use no máximo 10 caracteres.').optional().or(z.literal('')),
  status: z.enum(['active', 'controlled', 'resolved', 'suspected']).default('active'),
  diagnosedAt: dataOpcional,
  notes: z.string().trim().max(500, 'Use no máximo 500 caracteres.').optional().or(z.literal('')),
});
export type ConditionInput = z.infer<typeof conditionSchema>;

/** Alergia. */
export const allergySchema = z.object({
  substance: z.string().trim().min(2, 'Informe a substância.'),
  severity: z.enum(['mild', 'moderate', 'severe']).default('moderate'),
  reaction: z.string().trim().max(200, 'Use no máximo 200 caracteres.').optional().or(z.literal('')),
  notes: z.string().trim().max(300, 'Use no máximo 300 caracteres.').optional().or(z.literal('')),
});
export type AllergyInput = z.infer<typeof allergySchema>;

/** Cirurgia / procedimento. */
export const surgerySchema = z.object({
  procedure: z.string().trim().min(2, 'Informe o procedimento.'),
  performedAt: dataOpcional,
  hospital: z.string().trim().max(160, 'Use no máximo 160 caracteres.').optional().or(z.literal('')),
  notes: z.string().trim().max(300, 'Use no máximo 300 caracteres.').optional().or(z.literal('')),
});
export type SurgeryInput = z.infer<typeof surgerySchema>;

/** Antecedente familiar. */
export const familyHistorySchema = z.object({
  condition: z.string().trim().min(2, 'Informe a condição.'),
  relationship: z
    .enum(['mother', 'father', 'sibling', 'grandparent', 'child', 'other'])
    .default('other'),
  notes: z.string().trim().max(300, 'Use no máximo 300 caracteres.').optional().or(z.literal('')),
});
export type FamilyHistoryInput = z.infer<typeof familyHistorySchema>;

/** Consulta. */
export const appointmentSchema = z.object({
  doctorName: z.string().trim().min(2, 'Informe o nome do médico.'),
  doctorCrm: z.string().trim().max(40, 'Use no máximo 40 caracteres.').optional().or(z.literal('')),
  specialty: z.string().trim().max(120, 'Use no máximo 120 caracteres.').optional().or(z.literal('')),
  /**
   * OBRIGATÓRIO — e continua obrigatório. O que mudou: `required_error` só
   * dispara com `undefined`, e o campo de data e hora vazio manda `''`. Quem
   * clicava em "Agendar" sem preencher lia "Invalid date", em inglês. Agora
   * vazio, lixo e data que não existe no calendário dão a mesma frase em
   * português.
   */
  scheduledAt: criaDataObrigatoria('Informe data e hora.'),
  kind: z.enum(['in_person', 'telehealth']).default('in_person'),
  location: z.string().trim().max(200, 'Use no máximo 200 caracteres.').optional().or(z.literal('')),
  meetingLink: z.string().trim().url('Link inválido.').max(500, 'Use no máximo 500 caracteres.').optional().or(z.literal('')),
  reminders: z.array(z.number().int()).default([1440, 60]),
  notes: z.string().trim().max(500, 'Use no máximo 500 caracteres.').optional().or(z.literal('')),
});
export type AppointmentInput = z.infer<typeof appointmentSchema>;
