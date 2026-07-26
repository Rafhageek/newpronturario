import type { ExamMetric, MetricFlag } from '../types/db';
import { CRITICAL_THRESHOLDS } from '../constants/exams';

/**
 * Classificação apresentada ao usuário. `unclassified` é derivada quando
 * faltam valor ou limites de referência.
 */
export type MetricClassification = MetricFlag;

/** Normaliza um nome de métrica para casar com a chave do dicionário de explicações. */
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

export function normalizeMetricKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Classifica uma métrica em faixa de REFERÊNCIA (não diagnóstico):
 * dentro da faixa → ok; fora por pouco → atenção; muito fora → alerta.
 */
export function classifyMetric(
  value: number | null,
  refMin: number | null,
  refMax: number | null,
): MetricClassification {
  if (value == null || (refMin == null && refMax == null)) return 'unclassified';
  const margin = 0.2;
  if (refMax != null && value > refMax) {
    return value > refMax * (1 + margin) ? 'alert' : 'attention';
  }
  if (refMin != null && value < refMin) {
    return value < refMin * (1 - margin) ? 'alert' : 'attention';
  }
  return 'ok';
}

/**
 * Recalcula a classificação a partir dos dados-fonte. Isso corrige também
 * registros legados que foram persistidos como `ok` sem faixa de referência.
 */
export function classifyExamMetric(
  metric: Pick<ExamMetric, 'value' | 'reference_min' | 'reference_max'>,
): MetricClassification {
  return classifyMetric(metric.value, metric.reference_min, metric.reference_max);
}

/**
 * Mantém explícita a fronteira de persistência para impedir que uma
 * classificação ausente volte a ser convertida silenciosamente em `ok`.
 */
export function metricClassificationForPersistence(
  classification: MetricClassification,
): MetricFlag {
  return classification;
}

/** Valor crítico → aciona o banner vermelho de "procure avaliação". */
export function isCriticalValue(metricKey: string, value: number | null): boolean {
  if (value == null) return false;
  const t = CRITICAL_THRESHOLDS[normalizeMetricKey(metricKey)];
  if (!t) return false;
  if (t.high != null && value >= t.high) return true;
  if (t.low != null && value <= t.low) return true;
  return false;
}

export interface ExamNarrative {
  /** Resumo em ~3 frases (regras determinísticas, não-diagnóstico). */
  summary: string[];
  attention: ExamMetric[];
  normal: ExamMetric[];
  unclassified: ExamMetric[];
  /** Perguntas práticas para levar ao médico. */
  questions: string[];
  hasCritical: boolean;
}

/**
 * Gera a narrativa didática a partir das métricas (sem IA, sem diagnóstico).
 * O resumo de 30s e as perguntas saem de regras simples sobre os achados.
 */
export function buildExamNarrative(metrics: ExamMetric[]): ExamNarrative {
  const classified = metrics.map((metric) => ({
    metric,
    classification: classifyExamMetric(metric),
  }));
  const attention = classified
    .filter(({ classification }) => classification === 'attention' || classification === 'alert')
    .map(({ metric }) => metric);
  const normal = classified
    .filter(({ classification }) => classification === 'ok')
    .map(({ metric }) => metric);
  const unclassified = classified
    .filter(({ classification }) => classification === 'unclassified')
    .map(({ metric }) => metric);
  const total = metrics.length;
  const evaluated = attention.length + normal.length;
  const hasCritical = metrics.some((m) => isCriticalValue(m.metric_code ?? m.name, m.value));

  const summary: string[] = [];
  if (total === 0) {
    summary.push('Ainda não há valores estruturados neste exame.');
  } else if (evaluated === 0) {
    summary.push('Nenhum resultado pôde ser classificado porque faltam valor ou faixa de referência.');
  } else if (attention.length === 0) {
    summary.push(`Os ${normal.length} resultados classificáveis estão dentro das faixas informadas.`);
  } else {
    summary.push(`${normal.length} de ${evaluated} resultados classificáveis estão dentro das faixas informadas.`);
  }
  if (unclassified.length > 0) {
    summary.push(
      `${unclassified.length} resultado(s) não classificado(s) por falta de valor ou faixa de referência.`,
    );
  }
  if (evaluated > 0) {
    summary.push(
      attention.length === 0
        ? 'Nenhum resultado classificável ficou fora das faixas informadas.'
        : `${attention.length} ponto(s) de atenção para conversar com seu médico.`,
    );
  }
  summary.push('Estas informações são educativas — só o seu médico interpreta com seu contexto completo.');

  const questions: string[] = [];
  attention.slice(0, 3).forEach((m) => {
    questions.push(`O que pode estar deixando meu(minha) ${m.name} fora da faixa de referência?`);
  });
  if (unclassified.length > 0) {
    questions.push('Qual faixa de referência deve ser usada para os resultados não classificados?');
  }
  questions.push('Preciso de algum exame complementar ou de acompanhamento?');
  if (attention.length > 0) {
    questions.push('Algum hábito, alimentação ou tratamento pode ajudar nesses resultados?');
  }

  return { summary, attention, normal, unclassified, questions: questions.slice(0, 5), hasCritical };
}
