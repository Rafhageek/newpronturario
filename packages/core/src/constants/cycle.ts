import type { CyclePhase } from '../utils/cycle';

/** Disclaimer permanente das telas do ciclo. */
export const CYCLE_DISCLAIMER =
  'Estimativa baseada no seu histórico — não é diagnóstico nem método contraceptivo.';

/** Aviso de privacidade (primeira visita). */
export const CYCLE_PRIVACY_NOTICE =
  'Estes dados ficam visíveis apenas para você. O compartilhamento exige autorização explícita por escopo em Configurações → Privacidade, e você pode desativar ou apagar tudo a qualquer momento.';

export const CYCLE_PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstruação',
  follicular: 'Fase folicular',
  ovulatory: 'Janela ovulatória',
  luteal: 'Fase lútea',
};

/** Cores do calendário por fase (claras, com bom contraste com o texto). */
export const CYCLE_PHASE_COLORS: Record<CyclePhase, string> = {
  menstrual: '#fecdd3', // rosa/vermelho claro
  follicular: '#dcfce7', // verde claro
  ovulatory: '#fef9c3', // amarelo claro
  luteal: '#dbeafe', // azul claro
};

export const FLOW_LEVEL_LABELS: Record<number, string> = {
  0: 'Sem fluxo',
  1: 'Leve',
  2: 'Médio',
  3: 'Intenso',
};

export const CYCLE_SYMPTOMS = [
  'Cólica',
  'Dor de cabeça',
  'Inchaço',
  'Sensibilidade nos seios',
  'Acne',
  'Fadiga',
  'Náusea',
  'Dor nas costas',
] as const;

export const CYCLE_MOODS = [
  'Irritável',
  'Ansiosa',
  'Triste',
  'Feliz',
  'Calma',
  'Energética',
  'Sensível',
] as const;
