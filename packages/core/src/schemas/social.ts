import { z } from 'zod';

export const postSchema = z.object({
  content: z.string().trim().min(1, 'Escreva algo.').max(2000),
  flair: z.string().trim().max(40).optional().or(z.literal('')),
  isAnonymous: z.boolean().default(false),
  isAchievement: z.boolean().default(false),
  // Enquete opcional
  pollQuestion: z.string().trim().max(160).optional().or(z.literal('')),
  pollOptions: z.array(z.string().trim().min(1)).max(6).optional(),
});
export type PostInput = z.infer<typeof postSchema>;

export const commentSchema = z.object({
  content: z.string().trim().min(1, 'Escreva um comentário.').max(1000),
  isAnonymous: z.boolean().default(false),
});
export type CommentInput = z.infer<typeof commentSchema>;

export const socialProfileSchema = z.object({
  displayName: z.string().trim().max(60).optional().or(z.literal('')),
  bio: z.string().trim().max(280).optional().or(z.literal('')),
  isPublic: z.boolean().default(false),
  showAchievements: z.boolean().default(true),
  crm: z.string().trim().max(40).optional().or(z.literal('')),
});
export type SocialProfileInput = z.infer<typeof socialProfileSchema>;

export const reportSchema = z.object({
  reason: z.string().trim().min(1, 'Selecione um motivo.'),
});
export type ReportInput = z.infer<typeof reportSchema>;
