import type { ExamCategory, MetricFlag } from '../types/db';

/** Limite de uploads de exame por mês no plano Free. */
export const FREE_UPLOAD_LIMIT = 5;

export const EXAM_CATEGORY_LABELS: Record<ExamCategory, string> = {
  lab: 'Laboratorial',
  imaging: 'Imagem',
  cardio: 'Cardiológico',
};

export interface MetricFlagMeta {
  label: string;
  tone: 'ok' | 'attention' | 'alert';
}
export const METRIC_FLAG: Record<MetricFlag, MetricFlagMeta> = {
  ok: { label: 'Normal', tone: 'ok' },
  attention: { label: 'Atenção', tone: 'attention' },
  alert: { label: 'Alerta', tone: 'alert' },
};

/** Painéis temáticos: agrupam métricas por sistema (por metric_key). */
export interface ThematicPanel {
  key: string;
  label: string;
  metricKeys: string[];
}
export const THEMATIC_PANELS: ThematicPanel[] = [
  {
    key: 'cardiovascular',
    label: 'Saúde cardiovascular',
    metricKeys: ['colesterol_total', 'ldl', 'hdl', 'triglicerides', 'glicose_jejum', 'hba1c'],
  },
  { key: 'renal', label: 'Função renal', metricKeys: ['creatinina', 'ureia', 'tfg', 'acido_urico'] },
  {
    key: 'hepatica',
    label: 'Função hepática',
    metricKeys: ['tgo', 'tgp', 'ggt', 'bilirrubina_total', 'fosfatase_alcalina'],
  },
  { key: 'hormonal', label: 'Hormonal / Tireoide', metricKeys: ['tsh', 't4_livre'] },
];

/**
 * Limiares de valor CRÍTICO (banner vermelho recomendando procurar atendimento).
 * Conservador e não-diagnóstico — apenas dispara o aviso de "procure avaliação".
 */
export interface CriticalThreshold {
  high?: number;
  low?: number;
  message: string;
}
export const CRITICAL_THRESHOLDS: Record<string, CriticalThreshold> = {
  glicose_jejum: { high: 250, message: 'Glicemia muito elevada.' },
  hba1c: { high: 10, message: 'Hemoglobina glicada muito elevada.' },
  potassio: { high: 6.0, low: 2.8, message: 'Potássio fora de faixa segura.' },
  sodio: { high: 155, low: 125, message: 'Sódio fora de faixa segura.' },
  creatinina: { high: 4.0, message: 'Creatinina muito elevada.' },
  hemoglobina: { low: 7.0, message: 'Hemoglobina muito baixa.' },
  plaquetas: { low: 50000, message: 'Plaquetas muito baixas.' },
};
