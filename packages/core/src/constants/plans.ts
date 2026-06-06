/**
 * Planos e features. Regra ética inegociável: features de SEGURANÇA são
 * gratuitas para sempre (lembrete básico de medicação, registro de tomada,
 * cartão de emergência QR). Paywalls só sobre conveniência/avançado.
 */

export type PlanId = 'free' | 'plus';

/** Limite de medicamentos no plano Free (lembrete/registro continuam grátis). */
export const FREE_MEDICATION_LIMIT = 3;

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthlyBRL: number;
  description: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'VidaLog Free',
    priceMonthlyBRL: 0,
    description: 'Tudo que importa para sua segurança, para sempre grátis.',
  },
  plus: {
    id: 'plus',
    name: 'VidaLog Plus',
    priceMonthlyBRL: 19.9,
    description: 'Recursos avançados de organização e interpretação didática.',
  },
};

/** Catálogo de features e em quais planos estão disponíveis. */
export type FeatureKey =
  | 'medication_reminder_basic'
  | 'medication_intake_log'
  | 'emergency_qr_card'
  | 'diary'
  | 'vitals_tracking'
  | 'exam_storage'
  | 'exam_didactic_analysis'
  | 'family_caregiver_mode'
  | 'whatsapp_reminders'
  | 'community';

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  /** Feature essencial de segurança — SEMPRE gratuita (não pode entrar em paywall). */
  safetyCritical: boolean;
  plans: PlanId[];
}

export const FEATURES: Record<FeatureKey, FeatureDef> = {
  medication_reminder_basic: {
    key: 'medication_reminder_basic',
    label: 'Lembrete básico de medicação',
    safetyCritical: true,
    plans: ['free', 'plus'],
  },
  medication_intake_log: {
    key: 'medication_intake_log',
    label: 'Registro de tomada',
    safetyCritical: true,
    plans: ['free', 'plus'],
  },
  emergency_qr_card: {
    key: 'emergency_qr_card',
    label: 'Cartão de emergência QR',
    safetyCritical: true,
    plans: ['free', 'plus'],
  },
  diary: { key: 'diary', label: 'Diário de saúde', safetyCritical: false, plans: ['free', 'plus'] },
  vitals_tracking: {
    key: 'vitals_tracking',
    label: 'Registro de sinais vitais',
    safetyCritical: false,
    plans: ['free', 'plus'],
  },
  exam_storage: {
    key: 'exam_storage',
    label: 'Guardar exames',
    safetyCritical: false,
    plans: ['free', 'plus'],
  },
  exam_didactic_analysis: {
    key: 'exam_didactic_analysis',
    label: 'Exames didáticos (interpretação em linguagem leiga)',
    safetyCritical: false,
    plans: ['plus'],
  },
  family_caregiver_mode: {
    key: 'family_caregiver_mode',
    label: 'Modo família/cuidador',
    safetyCritical: false,
    plans: ['plus'],
  },
  whatsapp_reminders: {
    key: 'whatsapp_reminders',
    label: 'Lembretes por WhatsApp',
    safetyCritical: false,
    plans: ['plus'],
  },
  community: {
    key: 'community',
    label: 'Comunidade por condição',
    safetyCritical: false,
    plans: ['plus'],
  },
};

/** Uma feature está disponível para um plano? Features de segurança: sempre sim. */
export function isFeatureAvailable(feature: FeatureKey, plan: PlanId): boolean {
  const def = FEATURES[feature];
  if (def.safetyCritical) return true;
  return def.plans.includes(plan);
}
