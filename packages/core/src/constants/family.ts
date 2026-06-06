import type { CareRelationshipKind } from '../types/db';

export type CaregiverPermission =
  | 'ver_vitais'
  | 'registrar_tomada'
  | 'ver_exames'
  | 'agendar_consulta'
  | 'receber_alertas';

export interface CaregiverPermissionMeta {
  key: CaregiverPermission;
  label: string;
  description: string;
}

export const CAREGIVER_PERMISSIONS: CaregiverPermissionMeta[] = [
  { key: 'ver_vitais', label: 'Ver sinais vitais', description: 'Acompanhar PA, glicemia, peso e diário.' },
  { key: 'registrar_tomada', label: 'Registrar tomada', description: 'Marcar medicamentos como tomados.' },
  { key: 'ver_exames', label: 'Ver exames', description: 'Acessar exames e resultados.' },
  { key: 'agendar_consulta', label: 'Agendar consulta', description: 'Criar consultas em nome da pessoa.' },
  { key: 'receber_alertas', label: 'Receber alertas', description: 'Ser avisado de medicação não registrada.' },
];

export type CaregiverPermissions = Record<CaregiverPermission, boolean>;

export const DEFAULT_CAREGIVER_PERMISSIONS: CaregiverPermissions = {
  ver_vitais: true,
  registrar_tomada: false,
  ver_exames: false,
  agendar_consulta: false,
  receber_alertas: true,
};

export const CARE_KIND_LABELS: Record<CareRelationshipKind, string> = {
  family: 'Família',
  caregiver: 'Cuidador(a)',
  doctor: 'Médico(a)',
  lab: 'Laboratório',
};

/** Plano Família (modo cuidador). */
export const FAMILY_PLAN = {
  name: 'VidaLog Plus Família',
  priceMonthlyBRL: 34.9,
} as const;

/** Idade mínima para consentimento próprio (LGPD Art. 14). Abaixo: responsável. */
export const SELF_CONSENT_MIN_AGE = 16;
