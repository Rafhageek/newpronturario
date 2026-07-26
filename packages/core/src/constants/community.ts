// ============================================================================
// Papéis, badges e reputação da comunidade (HubPatients).
// Fonte única dos rótulos/textos; a lógica de precedência visual fica no
// componente <UserBadge> (apps/web). Aqui só dados, sem dependências.
// ============================================================================

export type StaffRole = 'admin' | 'moderator';
export type ProfessionalBadge = 'doctor' | 'nurse' | 'nutritionist' | 'psychologist';
export type MemberTier = 'member' | 'vip';

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin',
  moderator: 'Moderador',
};

/**
 * Rótulo público da verificação profissional. Por ora a UI só exibe 'doctor';
 * os demais já existem no enum para evolução futura (COREN, CRN, CRP).
 */
export const PROFESSIONAL_BADGE_LABELS: Record<ProfessionalBadge, string> = {
  doctor: 'Médico',
  nurse: 'Enfermeiro',
  nutritionist: 'Nutricionista',
  psychologist: 'Psicólogo',
};

export const MEMBER_TIER_LABELS: Record<MemberTier, string> = {
  member: 'Membro',
  vip: 'Membro VIP',
};

/**
 * Níveis de reputação (derivados de reputation_points — NÃO armazenados).
 * Ordem crescente; reputationLevel() escolhe o maior `min` <= pontos.
 */
export const REPUTATION_LEVELS = [
  { min: 0, label: 'Novato' },
  { min: 50, label: 'Participante' },
  { min: 200, label: 'Contribuidor' },
  { min: 500, label: 'Veterano' },
  { min: 1000, label: 'Lenda da Comunidade' },
] as const;

export type ReputationLevelLabel = (typeof REPUTATION_LEVELS)[number]['label'];

/** Pontuação por ação (espelha os triggers da migration 0022). */
export const REPUTATION_POINTS = {
  topic_created: 2,
  reply_created: 1,
  useful_marked: 5,
  reaction_received: 1, // cap 10/dia
  moderation_removed: -10,
} as const;

/**
 * AVISO ÉTICO obrigatório da badge médica (tooltip + rodapé automático em
 * respostas de profissionais). A badge NUNCA implica consulta.
 */
export const PROFESSIONAL_DISCLAIMER =
  'Profissional com registro verificado. As participações são informativas e não substituem consulta.';
