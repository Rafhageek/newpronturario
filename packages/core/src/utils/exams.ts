import type { ExamMetric, MetricFlag } from '../types/db';
import { CRITICAL_THRESHOLDS } from '../constants/exams';

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
): MetricFlag {
  if (value == null || (refMin == null && refMax == null)) return 'ok';
  const margin = 0.2;
  if (refMax != null && value > refMax) {
    return value > refMax * (1 + margin) ? 'alert' : 'attention';
  }
  if (refMin != null && value < refMin) {
    return value < refMin * (1 - margin) ? 'alert' : 'attention';
  }
  return 'ok';
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
  /** Perguntas práticas para levar ao médico. */
  questions: string[];
  hasCritical: boolean;
}

/**
 * Gera a narrativa didática a partir das métricas (sem IA, sem diagnóstico).
 * O resumo de 30s e as perguntas saem de regras simples sobre os achados.
 */
export function buildExamNarrative(metrics: ExamMetric[]): ExamNarrative {
  const attention = metrics.filter((m) => m.flag === 'attention' || m.flag === 'alert');
  const normal = metrics.filter((m) => m.flag === 'ok');
  const total = metrics.length;
  const hasCritical = metrics.some((m) => isCriticalValue(m.metric_code ?? m.name, m.value));

  const summary: string[] = [];
  if (total === 0) {
    summary.push('Ainda não há valores estruturados neste exame.');
  } else if (attention.length === 0) {
    summary.push(`Todos os ${total} resultados avaliados estão dentro da faixa de referência. 👍`);
  } else {
    summary.push(`${normal.length} de ${total} resultados estão dentro da faixa de referência.`);
  }
  summary.push(
    attention.length === 0
      ? 'Nenhum ponto de atenção identificado.'
      : `${attention.length} ponto(s) de atenção para conversar com seu médico.`,
  );
  summary.push('Estas informações são educativas — só o seu médico interpreta com seu contexto completo.');

  const questions: string[] = [];
  attention.slice(0, 3).forEach((m) => {
    questions.push(`O que pode estar deixando meu(minha) ${m.name} fora da faixa de referência?`);
  });
  questions.push('Preciso de algum exame complementar ou de acompanhamento?');
  if (attention.length > 0) {
    questions.push('Algum hábito, alimentação ou tratamento pode ajudar nesses resultados?');
  }

  return { summary, attention, normal, questions: questions.slice(0, 5), hasCritical };
}
