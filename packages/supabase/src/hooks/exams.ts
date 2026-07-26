'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InsertRow } from '@hubpatients/core';
import {
  classifyMetric,
  metricClassificationForPersistence,
  activityNotification,
} from '@hubpatients/core';
import { enqueueNotification } from '../queries/notifications';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  listExams,
  getExam,
  getExamMetrics,
  getExplanations,
  getMetricHistory,
  monthlyUploadCount,
  createExam,
  createExamMetrics,
  type ExamFilters,
} from '../queries/exams';

export function useExams(patientId: string | undefined, filters: ExamFilters = {}) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: [...queryKeys.exams(patientId ?? ''), filters],
    queryFn: () => listExams(client, patientId as string, filters),
    enabled: Boolean(patientId),
  });
}

export function useExam(examId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.exam(examId ?? ''),
    queryFn: () => getExam(client, examId as string),
    enabled: Boolean(examId),
  });
}

export function useExamMetrics(examId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.examMetrics(examId ?? ''),
    queryFn: () => getExamMetrics(client, examId as string),
    enabled: Boolean(examId),
  });
}

export function useExplanations() {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.explanations(),
    queryFn: () => getExplanations(client),
    staleTime: 60 * 60 * 1000, // dicionário muda raramente
  });
}

export function useMetricHistory(
  patientId: string | undefined,
  name: string,
  code: string | null,
) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.metricHistory(patientId ?? '', code ?? name),
    queryFn: () => getMetricHistory(client, patientId as string, name, code),
    enabled: Boolean(patientId && name),
  });
}

export function useMonthlyUploadCount(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.monthlyUploads(patientId ?? ''),
    queryFn: () => monthlyUploadCount(client, patientId as string),
    enabled: Boolean(patientId),
  });
}

export interface NewExamMetric {
  name: string;
  metric_code?: string | null;
  value?: number | null;
  unit?: string | null;
  reference_min?: number | null;
  reference_max?: number | null;
}

/** Indica que o exame foi salvo, mas uma etapa dependente falhou. */
export class ExamRecordPersistedError extends Error {
  constructor(readonly examId: string) {
    super('O registro do exame foi salvo, mas os resultados não foram concluídos.');
    this.name = 'ExamRecordPersistedError';
  }
}

/** Cria o exame e suas métricas (classificando o status por faixa de referência). */
export function useCreateExam(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      exam: Omit<InsertRow<'exams'>, 'patient_id'>;
      metrics: NewExamMetric[];
    }) => {
      const exam = await createExam(client, { ...input.exam, patient_id: patientId });
      const measuredAt = exam.exam_date ? `${exam.exam_date}T00:00:00Z` : new Date().toISOString();
      const rows: InsertRow<'exam_metrics'>[] = input.metrics.map((m) => ({
        exam_id: exam.id,
        patient_id: patientId,
        name: m.name,
        metric_code: m.metric_code ?? null,
        value: m.value ?? null,
        unit: m.unit ?? null,
        reference_min: m.reference_min ?? null,
        reference_max: m.reference_max ?? null,
        flag: metricClassificationForPersistence(
          classifyMetric(m.value ?? null, m.reference_min ?? null, m.reference_max ?? null),
        ),
        measured_at: measuredAt,
      }));
      try {
        await createExamMetrics(client, rows);
      } catch {
        // O anexo não é órfão: a linha de exame já existe e o referencia.
        throw new ExamRecordPersistedError(exam.id);
      }
      return exam;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.exams(patientId) });
      qc.invalidateQueries({ queryKey: queryKeys.monthlyUploads(patientId) });
      void enqueueNotification(client, activityNotification.examAdded());
    },
  });
}
