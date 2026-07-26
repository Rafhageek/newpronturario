/** Reações disponíveis nos posts. */
export const REACTIONS = [
  { emoji: '❤️', label: 'Apoio' },
  { emoji: '🙏', label: 'Força' },
  { emoji: '👏', label: 'Parabéns' },
  { emoji: '🤝', label: 'Estou junto' },
] as const;

/** Flairs (etiquetas) de post. */
export const POST_FLAIRS = ['Dúvida', 'Desabafo', 'Conquista', 'Dica', 'Pergunta ao grupo'];

/** Motivos de denúncia (moderação). */
export const REPORT_REASONS = [
  'Desinformação em saúde',
  'Conteúdo ofensivo',
  'Spam ou propaganda',
  'Exposição de dados de outra pessoa',
  'Outro',
];

export const SOCIAL_DISCLAIMER =
  'O conteúdo da comunidade vem de outros usuários e NÃO é aconselhamento médico. Em caso de dúvida ou sintoma, procure um profissional de saúde.';

/** Aviso fixo no topo de cada categoria do fórum. */
export const CATEGORY_DISCLAIMER =
  'Relatos da comunidade são experiências pessoais, não orientação médica. Em dúvidas sobre seu tratamento, fale com seu médico.';

/** Dica de formatação exibida no editor. */
export const MARKDOWN_HINT = '**negrito**, *itálico*, listas com “- ” e citações com “> ”.';

/** Aviso de apoio emocional (exibido em espaços de conversa). */
export const CRISIS_NOTICE =
  'Se você está passando por um momento difícil, não está sozinho(a). Ligue para o CVV: 188 (24h, gratuito).';

/** Abas de ordenação do fórum. */
export const FORUM_SORTS = [
  { key: 'recent', label: 'Recentes' },
  { key: 'hot', label: 'Em alta' },
  { key: 'unanswered', label: 'Sem resposta' },
  { key: 'solved', label: 'Resolvidos' },
] as const;
export type ForumSort = (typeof FORUM_SORTS)[number]['key'];
