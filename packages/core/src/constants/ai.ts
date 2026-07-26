// ============================================================================
// Acesso de IA ao prontuário (tokens pessoais). Escopos de LEITURA por ora;
// escrita é fase futura. O token NUNCA dá login — só leitura do próprio dado.
// ============================================================================

export const AI_TOKEN_SCOPES = [
  { key: 'read:profile', label: 'Perfil', hint: 'Nome, nascimento, sexo, tipo sanguíneo' },
  { key: 'read:medications', label: 'Medicamentos', hint: 'Lista de medicamentos ativos' },
  { key: 'read:vitals', label: 'Sinais vitais', hint: 'Pressão, glicemia, peso…' },
  { key: 'read:allergies', label: 'Alergias', hint: 'Substâncias e gravidade' },
  { key: 'read:exams', label: 'Exames', hint: 'Metadados dos exames (sem arquivos)' },
] as const;

export type AiTokenScope = (typeof AI_TOKEN_SCOPES)[number]['key'];

export const AI_ACCESS_DISCLAIMER =
  'O token dá apenas LEITURA dos seus próprios dados, restrita aos escopos que você marcar. ' +
  'Ele não permite login nem escrita. Você pode revogar a qualquer momento. ' +
  'A IA é informativa e nunca substitui avaliação médica.';
