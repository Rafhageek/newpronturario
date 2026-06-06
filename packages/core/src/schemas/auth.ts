import { z } from 'zod';

export const emailSchema = z
  .string({ required_error: 'Informe o e-mail.' })
  .trim()
  .min(1, 'Informe o e-mail.')
  .email('E-mail inválido.');

/** Senha: mínimo 8, com letra e número (regra básica de segurança). */
export const passwordSchema = z
  .string({ required_error: 'Informe a senha.' })
  .min(8, 'A senha deve ter ao menos 8 caracteres.')
  .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra.')
  .regex(/[0-9]/, 'A senha deve conter ao menos um número.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Informe seu nome completo.'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: 'É necessário aceitar os termos e a política de privacidade.' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem.',
    path: ['confirmPassword'],
  });
export type SignupInput = z.infer<typeof signupSchema>;
