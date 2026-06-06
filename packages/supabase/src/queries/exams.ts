import type {
  Exam,
  ExamCategory,
  ExamMetric,
  ExamMetricExplanation,
  InsertRow,
} from '@vidalog/core';
import type { VidaLogClient } from '../types';

export interface ExamFilters {
  category?: ExamCategory;
  status?: string;
  sinceIso?: string;
}

export async function listExams(
  client: VidaLogClient,
  patientId: string,
  filters: ExamFilters = {},
): Promise<Exam[]> {
  let query = client
    .from('exams')
    .select('*')
    .eq('patient_id', patientId)
    .order('exam_date', { ascending: false, nullsFirst: false });
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.sinceIso) query = query.gte('exam_date', filters.sinceIso);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getExam(client: VidaLogClient, examId: string): Promise<Exam | null> {
  const { data, error } = await client.from('exams').select('*').eq('id', examId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getExamMetrics(client: VidaLogClient, examId: string): Promise<ExamMetric[]> {
  const { data, error } = await client
    .from('exam_metrics')
    .select('*')
    .eq('exam_id', examId)
    .order('flag', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createExam(client: VidaLogClient, row: InsertRow<'exams'>): Promise<Exam> {
  const { data, error } = await client.from('exams').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function createExamMetrics(
  client: VidaLogClient,
  rows: InsertRow<'exam_metrics'>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await client.from('exam_metrics').insert(rows);
  if (error) throw error;
}

/** Dicionário educativo completo (tabela pequena, cacheável). */
export async function getExplanations(client: VidaLogClient): Promise<ExamMetricExplanation[]> {
  const { data, error } = await client.from('exam_metric_explanations').select('*');
  if (error) throw error;
  return data ?? [];
}

/** Histórico de uma métrica ao longo do tempo (evolução temporal). */
export async function getMetricHistory(
  client: VidaLogClient,
  patientId: string,
  metricName: string,
  metricCode: string | null,
): Promise<ExamMetric[]> {
  let query = client.from('exam_metrics').select('*').eq('patient_id', patientId);
  query = metricCode ? query.eq('metric_code', metricCode) : query.eq('name', metricName);
  const { data, error } = await query.order('measured_at', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data ?? [];
}

/** Quantos exames o paciente criou no mês atual (limite Free). */
export async function monthlyUploadCount(client: VidaLogClient, patientId: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { count, error } = await client
    .from('exams')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .gte('created_at', start.toISOString());
  if (error) throw error;
  return count ?? 0;
}

// ── Storage ─────────────────────────────────────────────────────────────────
export async function uploadExamFile(
  client: VidaLogClient,
  patientId: string,
  file: File,
): Promise<string> {
  const safe = file.name.replace(/[^\w.-]/g, '_');
  const path = `${patientId}/${Date.now()}_${safe}`;
  const { error } = await client.storage.from('exams').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function getExamSignedUrl(
  client: VidaLogClient,
  storagePath: string,
  expiresIn = 60,
): Promise<string | null> {
  const { data, error } = await client.storage.from('exams').createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data?.signedUrl ?? null;
}
