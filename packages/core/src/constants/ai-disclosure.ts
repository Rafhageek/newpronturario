// ============================================================================
// Disclosure de IA — Resolução CFM nº 2.454/2026
//
// Sempre que a IA for usada como apoio relevante, o paciente precisa saber
// disso de forma clara, entender como aquilo foi gerado e poder RECUSAR o uso.
// A resolução também VEDA delegar à IA a comunicação de diagnóstico,
// prognóstico ou decisão terapêutica — por isso todos os textos abaixo
// enquadram a saída como apoio educativo e estimativa, nunca como conduta.
//
// Fonte única: web e mobile importam daqui (nada de texto solto na UI).
// ============================================================================

/** Selo curto exibido junto de qualquer saída de IA. */
export const AI_DISCLOSURE_BADGE = 'Gerado por IA';

/** Rótulo do botão/ação que abre o painel de transparência. */
export const AI_DISCLOSURE_CTA = 'Como isso foi gerado';

/** Título do painel de transparência. */
export const AI_DISCLOSURE_TITLE = 'Como isso foi gerado';

/** Uma linha, para quando não cabe o texto completo (listas, cards densos). */
export const AI_DISCLOSURE_SHORT =
  'Apoio gerado por IA: é uma estimativa educativa, não é diagnóstico.';

/** Texto completo, obrigatório no painel de transparência. */
export const AI_DISCLOSURE_FULL =
  'Este conteúdo foi gerado com apoio de inteligência artificial e tem finalidade ' +
  'educativa: organiza e explica, em linguagem simples, informações do seu próprio ' +
  'registro. É uma estimativa, pode conter erros e NÃO é diagnóstico, prognóstico ' +
  'nem prescrição — apenas o seu médico interpreta o seu caso com o contexto completo. ' +
  'Nenhuma decisão sobre o seu tratamento é tomada pela IA: toda saída depende de ' +
  'revisão humana. Você pode recusar o uso de IA a qualquer momento, sem perder o ' +
  'acesso ao restante do aplicativo.';

/** Direito de recusa — exibido em destaque no painel. */
export const AI_DISCLOSURE_REFUSAL =
  'Você pode recusar o uso de IA a qualquer momento na tela de Consentimento. ' +
  'Nada é enviado para leitura por IA sem o seu consentimento específico, e a ' +
  'revogação vale para os próximos usos.';

/** Supervisão humana — exigência expressa da resolução. */
export const AI_DISCLOSURE_HUMAN_OVERSIGHT =
  'A IA não comunica diagnóstico, prognóstico nem decisão terapêutica. Esse papel ' +
  'é sempre do profissional de saúde que acompanha você.';

/** Mostrado quando não há metadados registrados para aquela saída. */
export const AI_DISCLOSURE_NO_METADATA = 'Não registrado';

/** Mostrado quando nenhuma fonte foi registrada. */
export const AI_DISCLOSURE_NO_SOURCES = 'Nenhuma fonte registrada para esta saída.';

/** Norma citada no rodapé do painel (rastreabilidade da adequação). */
export const AI_DISCLOSURE_REGULATION =
  'Transparência exigida pela Resolução CFM nº 2.454/2026.';

/** Rótulos dos campos do painel (mesma ordem em web e mobile). */
export const AI_DISCLOSURE_FIELDS = {
  task: 'Tarefa',
  model: 'Modelo',
  promptVersion: 'Versão do prompt',
  sources: 'Fontes usadas',
  createdAt: 'Data do processamento',
} as const;

/**
 * task_type (tabela public.ai_invocations) → rótulo amigável em PT-BR.
 * Mantém o vocabulário do banco alinhado ao que o paciente lê na tela.
 */
export const AI_TASK_LABELS = {
  exam_reading: 'Leitura de exame',
  exam_summary: 'Resumo de exame',
  metric_explanation: 'Explicação de resultado',
  term_translation: 'Tradução de termo médico',
  diary_summary: 'Resumo do diário',
  medication_interaction: 'Checagem de interação de medicamentos',
  record_access: 'Leitura do prontuário por assistente de IA',
  assistant_chat: 'Conversa com assistente de IA',
} as const;

export type AiTaskType = keyof typeof AI_TASK_LABELS;

/** Usado quando o task_type gravado não tem rótulo conhecido. */
export const AI_TASK_FALLBACK_LABEL = 'Apoio por IA';

/** Lookup seguro (o banco aceita task_type livre; a UI nunca mostra a chave crua). */
export function aiTaskLabel(taskType: string | null | undefined): string {
  if (!taskType) return AI_TASK_FALLBACK_LABEL;
  const labels: Record<string, string | undefined> = AI_TASK_LABELS;
  return labels[taskType] ?? AI_TASK_FALLBACK_LABEL;
}

/**
 * Metadados de uma invocação de IA, do jeito que a UI consome.
 * Espelha public.ai_invocations — todos opcionais porque o painel precisa
 * funcionar (degradando para o texto genérico) mesmo sem registro.
 */
export type AiDisclosureMeta = {
  taskType?: string | null;
  modelId?: string | null;
  promptVersion?: string | null;
  sources?: readonly string[] | null;
  createdAt?: string | null;
};
