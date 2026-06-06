import { z } from 'zod';

export const examSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do exame.'),
  category: z.enum(['lab', 'imaging', 'cardio']).default('lab'),
  labName: z.string().trim().max(160).optional().or(z.literal('')),
  examDate: z.coerce.date().optional(),
  doctorName: z.string().trim().max(160).optional().or(z.literal('')),
  doctorCrm: z.string().trim().max(40).optional().or(z.literal('')),
  rawText: z.string().trim().max(8000).optional().or(z.literal('')),
});
export type ExamInput = z.infer<typeof examSchema>;

/** Métrica adicionada manualmente (ou revisada após extração por IA). */
export const examMetricSchema = z.object({
  name: z.string().trim().min(1, 'Informe a métrica.'),
  metricCode: z.string().trim().max(40).optional().or(z.literal('')),
  value: z.coerce.number().optional(),
  unit: z.string().trim().max(20).optional().or(z.literal('')),
  refMin: z.coerce.number().optional(),
  refMax: z.coerce.number().optional(),
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
