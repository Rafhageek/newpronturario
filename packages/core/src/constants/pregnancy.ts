import type { PregnancyRisk } from '../types/db';

/**
 * Textos e rótulos da jornada gestante. Conteúdo educativo e factual; nada
 * aqui interpreta sinais nem orienta conduta — isso é sempre do pré-natal.
 */

/** Disclaimer permanente, não-dispensável, das telas de gestação. */
export const PREGNANCY_DISCLAIMER =
  'Estas informações são educativas. Apenas o profissional que acompanha sua gestação pode interpretá-las com seu contexto completo.';

/** Aviso de emergência (banner permanente no topo da rota). */
export const PREGNANCY_EMERGENCY_NOTICE =
  'Em caso de sangramento, dor forte, redução de movimentos do bebê ou qualquer dúvida urgente, contate seu obstetra ou a maternidade imediatamente.';

export const PREGNANCY_RISK_LABELS: Record<PregnancyRisk, string> = {
  habitual: 'Risco habitual',
  alto: 'Alto risco',
};

export const MILESTONE_CATEGORY_LABELS: Record<string, string> = {
  consulta: 'Consulta',
  exame: 'Exame',
  vacina: 'Vacina',
};

/** Semana a partir da qual o registro de movimentos fetais é oferecido. */
export const FETAL_MOVEMENTS_FROM_WEEK = 28;

export const IOM_CATEGORY_LABELS: Record<string, string> = {
  underweight: 'Abaixo do peso',
  normal: 'Peso adequado',
  overweight: 'Sobrepeso',
  obese: 'Obesidade',
};
