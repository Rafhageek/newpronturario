import { z } from 'zod';

/** Vitais opcionais registrados junto com a entrada do diário. */
export const diaryVitalsSchema = z.object({
  systolic: z.coerce.number().positive().max(300).optional(),
  diastolic: z.coerce.number().positive().max(200).optional(),
  heartRate: z.coerce.number().positive().max(300).optional(),
  temperature: z.coerce.number().positive().max(45).optional(),
  weight: z.coerce.number().positive().max(500).optional(),
  glucose: z.coerce.number().positive().max(900).optional(),
  oxygen: z.coerce.number().positive().max(100).optional(),
});
export type DiaryVitalsInput = z.infer<typeof diaryVitalsSchema>;

export const diaryEntrySchema = z.object({
  entryDate: z.coerce.date().default(() => new Date()),
  mood: z.number().int().min(1, 'Humor entre 1 e 5.').max(5, 'Humor entre 1 e 5.').optional(),
  energy: z.number().int().min(1, 'Energia entre 1 e 5.').max(5, 'Energia entre 1 e 5.').optional(),
  pain: z.number().int().min(0).max(10).optional(),
  symptoms: z.array(z.string().trim().min(1)).max(30).default([]),
  note: z.string().trim().max(2000).optional(),
  vitals: diaryVitalsSchema.optional(),
});
export type DiaryEntryInput = z.infer<typeof diaryEntrySchema>;
