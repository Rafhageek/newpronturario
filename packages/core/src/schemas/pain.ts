import { z } from 'zod';

/** Um ponto de dor marcado no mapa corporal. */
export const painPointSchema = z.object({
  bodyRegion: z.string().min(1, 'Selecione uma região do corpo.'),
  side: z.enum(['left', 'right', 'center']).optional(),
  intensity: z.coerce
    .number({ invalid_type_error: 'Informe a intensidade.' })
    .int()
    .min(0)
    .max(10),
  type: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(300).optional(),
});
export type PainPointInput = z.infer<typeof painPointSchema>;
