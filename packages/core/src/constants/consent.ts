import type { ConsentPurpose } from '../types/db';

export type DataCategory = 'vitals' | 'exams' | 'medications' | 'diary' | 'profile';

export const DATA_CATEGORY_LABELS: Record<DataCategory, string> = {
  vitals: 'Sinais vitais',
  exams: 'Exames',
  medications: 'Medicamentos',
  diary: 'Diário',
  profile: 'Dados pessoais',
};

export interface ConsentScope {
  purpose: ConsentPurpose;
  label: string;
  description: string;
  /** Categorias de dados sugeridas para este compartilhamento. */
  defaultData: DataCategory[];
}

/** Escopos granulares de compartilhamento (LGPD). */
export const CONSENT_SCOPES: ConsentScope[] = [
  {
    purpose: 'data_sharing_family',
    label: 'Família e cuidadores',
    description: 'Pessoas que você autorizar podem acompanhar seu cuidado.',
    defaultData: ['vitals', 'medications', 'diary'],
  },
  {
    purpose: 'data_sharing_doctor',
    label: 'Médicos',
    description: 'Profissionais que você convidar podem ver seus registros.',
    defaultData: ['vitals', 'exams', 'medications', 'diary'],
  },
  {
    purpose: 'data_sharing_lab',
    label: 'Laboratórios',
    description: 'Receba e compartilhe exames com laboratórios parceiros.',
    defaultData: ['exams'],
  },
  {
    purpose: 'data_sharing_insurance',
    label: 'Operadora de saúde',
    description: 'Compartilhe o necessário com seu convênio, quando você quiser.',
    defaultData: ['exams'],
  },
  {
    purpose: 'research',
    label: 'Pesquisa (anonimizado)',
    description: 'Contribua com dados anonimizados para pesquisa em saúde.',
    defaultData: ['vitals'],
  },
];

/** Base legal LGPD por finalidade (rótulo curto para o log de acessos). */
export const LEGAL_BASIS_LABEL = 'Consentimento (LGPD Art. 7º, I)';
