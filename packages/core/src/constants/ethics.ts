/**
 * Textos éticos inegociáveis (LGPD + CFM). O app NUNCA diagnostica, NUNCA
 * prescreve. Toda interpretação termina direcionando ao médico.
 *
 * Estes textos são a fonte única — web e mobile importam daqui.
 */

export const DISCLAIMERS = {
  /** Disclaimer permanente e NÃO-dispensável em telas de interpretação de exames. */
  examInterpretation:
    'Apenas seu médico pode interpretar com seu contexto completo. O HubPatients organiza e explica em linguagem simples, mas não substitui avaliação profissional.',

  /** Mostrado ao final de qualquer análise de sintoma/exame. */
  notDiagnosis:
    'O HubPatients não diagnostica nem prescreve. Em caso de dúvida ou sintoma preocupante, procure um profissional de saúde.',

  /** Emergência. */
  emergency:
    'Em caso de emergência, ligue 192 (SAMU) ou procure o pronto-socorro mais próximo.',

  /** Consentimento de compartilhamento (LGPD). */
  dataSharing:
    'Você controla quem vê seus dados. Pode revogar qualquer compartilhamento a qualquer momento.',
} as const;

/** Frase obrigatória ao encerrar qualquer narrativa de exame/sintoma. */
export const DOCTOR_REDIRECT = 'Converse sobre estes resultados com o seu médico.';
