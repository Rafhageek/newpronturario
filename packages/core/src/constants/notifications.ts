// Notificações "de atividade" — o feed do sino reage às ações do usuário.
// Cópia calorosa e centralizada (a mesma em web e mobile). O ícone é escolhido
// por plataforma a partir da categoria semântica.

export interface NotificationDraft {
  type: string;
  title: string;
  body: string;
  resourceType?: string | null;
  resourceId?: string | null;
}

/** Fábricas de notificação por ação (tom humano e acolhedor). */
export const activityNotification = {
  diarySaved: (): NotificationDraft => ({
    type: 'diary_saved',
    title: 'Diário registrado',
    body: 'Você anotou como se sentiu hoje. Cuidar de si também é isso. 💙',
  }),
  examAdded: (name?: string | null): NotificationDraft => ({
    type: 'exam_added',
    title: 'Exame adicionado',
    body: name
      ? `“${name}” entrou no seu histórico de saúde.`
      : 'Seu exame entrou no histórico. Tudo organizado num lugar só.',
  }),
  appointmentScheduled: (whenLabel?: string | null): NotificationDraft => ({
    type: 'appointment_scheduled',
    title: 'Consulta agendada',
    body: whenLabel
      ? `Sua consulta ${whenLabel} está marcada. A gente te lembra perto da hora.`
      : 'Sua consulta está marcada. A gente te lembra perto da hora.',
  }),
} as const;

export type NotificationCategory =
  | 'diary'
  | 'medication'
  | 'exam'
  | 'appointment'
  | 'milestone'
  | 'growth'
  | 'community'
  | 'system';

const CATEGORY_BY_TYPE: Record<string, NotificationCategory> = {
  diary_saved: 'diary',
  intake_taken: 'medication',
  low_stock: 'medication',
  refill: 'medication',
  exam_added: 'exam',
  appointment_scheduled: 'appointment',
  milestone_reached: 'milestone',
  growth_added: 'growth',
  professional_verified: 'community',
  professional_rejected: 'community',
  professional_expired: 'community',
  mod_hidden: 'community',
  mod_strike: 'community',
  mod_suspended: 'community',
};

/** Categoria semântica de uma notificação (para o ícone/cor no sino). */
export function notificationCategory(type: string): NotificationCategory {
  return CATEGORY_BY_TYPE[type] ?? 'system';
}
