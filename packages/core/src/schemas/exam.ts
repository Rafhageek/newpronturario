import { z } from 'zod';
// Garante as mensagens em português mesmo sem passar pelo `schemas/index.ts`.
import './erros-pt-br';
import { dataOpcional } from './data-opcional';
import { numeroOpcional } from './numero-opcional';

export const examSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do exame.'),
  category: z.enum(['lab', 'imaging', 'cardio']).default('lab'),
  labName: z.string().trim().max(160, 'Use no máximo 160 caracteres.').optional().or(z.literal('')),
  examDate: dataOpcional,
  doctorName: z.string().trim().max(160, 'Use no máximo 160 caracteres.').optional().or(z.literal('')),
  doctorCrm: z.string().trim().max(40, 'Use no máximo 40 caracteres.').optional().or(z.literal('')),
  rawText: z.string().trim().max(8000, 'Use no máximo 8000 caracteres.').optional().or(z.literal('')),
});
export type ExamInput = z.infer<typeof examSchema>;

/**
 * Métrica adicionada manualmente (ou revisada após extração por IA).
 *
 * `value`, `refMin` e `refMax` usam `numeroOpcional` por um motivo clínico, não
 * de estilo: com `z.coerce.number().optional()`, tanto `''` quanto `null`
 * devolviam `{ success: true, data: 0 }` — e aqui não há `.positive()` para
 * barrar, então o 0 passava CALADO. Uma faixa de referência que ninguém
 * informou virava "0" e o app podia exibir referência INVENTADA ao lado do
 * resultado do exame. De quebra, o helper aceita a vírgula decimal do Brasil
 * ("12,5"), que antes reprovava com "Expected number, received nan".
 */
export const examMetricSchema = z.object({
  name: z.string().trim().min(1, 'Informe a métrica.'),
  metricCode: z.string().trim().max(40, 'Use no máximo 40 caracteres.').optional().or(z.literal('')),
  value: numeroOpcional,
  unit: z.string().trim().max(20, 'Use no máximo 20 caracteres.').optional().or(z.literal('')),
  refMin: numeroOpcional,
  refMax: numeroOpcional,
});
export type ExamMetricInput = z.infer<typeof examMetricSchema>;

/** Saída esperada da Edge Function de extração (validação do JSON da IA). */
export const extractedMetricsSchema = z.object({
  metrics: z.array(
    z.object({
      name: z.string(),
      metric_code: z.string().nullable().optional(),
      value: z.number().nullable(),
      unit: z.string().nullable().optional(),
      reference_min: z.number().nullable().optional(),
      reference_max: z.number().nullable().optional(),
    }),
  ),
});
export type ExtractedMetrics = z.infer<typeof extractedMetricsSchema>;
