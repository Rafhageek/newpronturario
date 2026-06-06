import { z } from 'zod';

export const inviteSchema = z.object({
  email: z.string().trim().email('E-mail inválido.'),
  role: z.enum(['i_am_caregiver', 'i_am_patient']).default('i_am_caregiver'),
  kind: z.enum(['family', 'caregiver', 'doctor', 'lab']).default('family'),
  permissions: z.object({
    ver_vitais: z.boolean(),
    registrar_tomada: z.boolean(),
    ver_exames: z.boolean(),
    agendar_consulta: z.boolean(),
    receber_alertas: z.boolean(),
  }),
});
export type InviteInput = z.infer<typeof inviteSchema>;
