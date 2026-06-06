import { z } from 'zod';

export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  locale: z.string().default('pt-BR'),
  notifPush: z.boolean().default(true),
  notifEmail: z.boolean().default(true),
  notifWhatsapp: z.boolean().default(false),
  quietHoursStart: z.string().optional().or(z.literal('')),
  quietHoursEnd: z.string().optional().or(z.literal('')),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

/** Confirmação de exclusão de conta: senha + palavra de confirmação. */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Informe sua senha.'),
  confirm: z.literal('EXCLUIR', {
    errorMap: () => ({ message: 'Digite EXCLUIR para confirmar.' }),
  }),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
