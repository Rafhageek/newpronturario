/** Opções/rótulos PT-BR de domínios de saúde, compartilhados entre web e mobile. */

import type {
  VitalType,
  MedicationForm,
  MedicationFrequency,
  IntakeStatus,
  BloodType,
  BiologicalSex,
  ConditionStatus,
  AllergySeverity,
  AppointmentKind,
  AppointmentStatus,
  FamilyRelationship,
  InteractionSeverity,
} from '../types/db';

export interface VitalTypeMeta {
  type: VitalType;
  label: string;
  unit: string;
  /** Tem valor secundário (ex.: PA diastólica)? */
  hasSecondary: boolean;
  secondaryLabel?: string;
}

export const VITAL_TYPES: Record<VitalType, VitalTypeMeta> = {
  blood_pressure: {
    type: 'blood_pressure',
    label: 'Pressão arterial',
    unit: 'mmHg',
    hasSecondary: true,
    secondaryLabel: 'Diastólica',
  },
  glucose: { type: 'glucose', label: 'Glicemia', unit: 'mg/dL', hasSecondary: false },
  weight: { type: 'weight', label: 'Peso', unit: 'kg', hasSecondary: false },
  heart_rate: { type: 'heart_rate', label: 'Frequência cardíaca', unit: 'bpm', hasSecondary: false },
  temperature: { type: 'temperature', label: 'Temperatura', unit: '°C', hasSecondary: false },
  oxygen_saturation: {
    type: 'oxygen_saturation',
    label: 'Saturação de O₂',
    unit: '%',
    hasSecondary: false,
  },
};

export const MEDICATION_FORM_LABELS: Record<MedicationForm, string> = {
  tablet: 'Comprimido',
  capsule: 'Cápsula',
  liquid: 'Líquido',
  injection: 'Injeção',
  drops: 'Gotas',
  inhaler: 'Inalador',
  cream: 'Pomada/Creme',
  other: 'Outro',
};

export const MEDICATION_FREQUENCY_LABELS: Record<MedicationFrequency, string> = {
  daily: 'Diariamente',
  weekly: 'Semanalmente',
  as_needed: 'Quando necessário',
};

export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  pending: 'Pendente',
  taken: 'Tomado',
  skipped: 'Pulado',
};

export const BLOOD_TYPES: BloodType[] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown',
];

export const BIOLOGICAL_SEX_LABELS: Record<BiologicalSex, string> = {
  female: 'Feminino',
  male: 'Masculino',
  intersex: 'Intersexo',
  unspecified: 'Não informado',
};

export const MOOD_LABELS: Record<number, string> = {
  1: 'Muito mal',
  2: 'Mal',
  3: 'Neutro',
  4: 'Bem',
  5: 'Muito bem',
};

export const CONDITION_STATUS_LABELS: Record<ConditionStatus, string> = {
  active: 'Ativa',
  controlled: 'Controlada',
  resolved: 'Resolvida',
  suspected: 'Suspeita',
};

export interface AllergySeverityMeta {
  label: string;
  /** Token de cor semântica (mapeia para o semáforo da UI). */
  tone: 'attention' | 'alert';
}
export const ALLERGY_SEVERITY: Record<AllergySeverity, AllergySeverityMeta> = {
  mild: { label: 'Leve', tone: 'attention' },
  moderate: { label: 'Moderada', tone: 'attention' },
  severe: { label: 'Grave', tone: 'alert' },
};

export const APPOINTMENT_KIND_LABELS: Record<AppointmentKind, string> = {
  in_person: 'Presencial',
  telehealth: 'Telemedicina',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Agendada',
  completed: 'Realizada',
  cancelled: 'Cancelada',
};

/** Opções de lembrete (minutos antes da consulta). Envio real = Fase 4. */
export const REMINDER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 1440, label: '1 dia antes' },
  { minutes: 120, label: '2 horas antes' },
  { minutes: 60, label: '1 hora antes' },
  { minutes: 30, label: '30 min antes' },
];

export const FAMILY_RELATIONSHIP_LABELS: Record<FamilyRelationship, string> = {
  mother: 'Mãe',
  father: 'Pai',
  sibling: 'Irmão(ã)',
  grandparent: 'Avô(ó)',
  child: 'Filho(a)',
  other: 'Outro',
};

export const MEDICATION_UNITS = ['mg', 'mcg', 'g', 'mL', 'UI', 'gota(s)', 'comprimido(s)', 'puff'];

/** Sintomas comuns para multi-seleção no diário (campo livre também permitido). */
export const COMMON_SYMPTOMS = [
  'Dor de cabeça',
  'Tontura',
  'Náusea',
  'Cansaço',
  'Febre',
  'Tosse',
  'Falta de ar',
  'Dor no peito',
  'Dor abdominal',
  'Insônia',
  'Ansiedade',
  'Palpitação',
  'Diarreia',
  'Dor nas costas',
  'Dor muscular',
];

export interface InteractionSeverityMeta {
  label: string;
  tone: 'attention' | 'alert';
}
export const INTERACTION_SEVERITY: Record<InteractionSeverity, InteractionSeverityMeta> = {
  minor: { label: 'Leve', tone: 'attention' },
  moderate: { label: 'Moderada', tone: 'attention' },
  major: { label: 'Grave', tone: 'alert' },
};

/** Lista curada de CID-10 comuns para autocomplete (offline). Não é a base oficial completa. */
export interface Cid10Entry {
  code: string;
  label: string;
}
export const CID10_COMMON: Cid10Entry[] = [
  { code: 'I10', label: 'Hipertensão essencial (primária)' },
  { code: 'E11', label: 'Diabetes mellitus tipo 2' },
  { code: 'E10', label: 'Diabetes mellitus tipo 1' },
  { code: 'J45', label: 'Asma' },
  { code: 'E78', label: 'Distúrbios do metabolismo de lipoproteínas' },
  { code: 'F41', label: 'Outros transtornos ansiosos' },
  { code: 'F32', label: 'Episódios depressivos' },
  { code: 'M54', label: 'Dorsalgia' },
  { code: 'K21', label: 'Doença do refluxo gastroesofágico' },
  { code: 'E03', label: 'Hipotireoidismo' },
  { code: 'J30', label: 'Rinite alérgica' },
  { code: 'G43', label: 'Enxaqueca' },
  { code: 'N39', label: 'Outros transtornos do trato urinário' },
  { code: 'E66', label: 'Obesidade' },
  { code: 'I25', label: 'Doença isquêmica crônica do coração' },
];
