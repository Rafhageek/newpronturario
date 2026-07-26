import type { HubPatientsClient } from '../types';

export type ClinicalTimelineEventType =
  | 'vital'
  | 'diary'
  | 'exam'
  | 'medication'
  | 'medication_intake'
  | 'appointment'
  | 'condition'
  | 'allergy'
  | 'surgery'
  | 'vaccination';

export interface ClinicalTimelineEvent {
  eventId: string;
  eventKey: string;
  eventType: ClinicalTimelineEventType;
  source: string;
  occurredAt: string;
  title: string;
  summary: string | null;
  status: string | null;
  dateOnly: boolean;
}

export interface ClinicalTimelineCursor {
  occurredAt: string;
  eventKey: string;
}

export interface ClinicalTimelinePage {
  events: ClinicalTimelineEvent[];
  nextCursor: ClinicalTimelineCursor | null;
}

interface TimelineRpcRow {
  event_id: string;
  event_key: string;
  event_type: ClinicalTimelineEventType;
  source: string;
  occurred_at: string;
  title: string;
  summary: string | null;
  status: string | null;
  date_only: boolean;
  has_more: boolean;
}

interface TimelineRpcArgs {
  p_patient_id: string;
  p_limit: number;
  p_before_at?: string;
  p_before_key?: string;
}

interface TimelineRpcError {
  code?: string;
}

interface TimelineRpcClient {
  rpc(
    name: 'clinical_timeline',
    args: TimelineRpcArgs,
  ): PromiseLike<{ data: unknown; error: TimelineRpcError | null }>;
}

const EVENT_TYPES = new Set<ClinicalTimelineEventType>([
  'vital',
  'diary',
  'exam',
  'medication',
  'medication_intake',
  'appointment',
  'condition',
  'allergy',
  'surgery',
  'vaccination',
]);

function isTimelineRow(value: unknown): value is TimelineRpcRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.event_id === 'string'
    && typeof row.event_key === 'string'
    && typeof row.event_type === 'string'
    && EVENT_TYPES.has(row.event_type as ClinicalTimelineEventType)
    && typeof row.source === 'string'
    && typeof row.occurred_at === 'string'
    && typeof row.title === 'string'
    && (row.summary === null || typeof row.summary === 'string')
    && (row.status === null || typeof row.status === 'string')
    && typeof row.date_only === 'boolean'
    && typeof row.has_more === 'boolean'
  );
}

/**
 * Carrega uma página factual da linha do tempo. Classificação clínica e
 * diagnósticos não são calculados no cliente nem no RPC.
 */
export async function getClinicalTimelinePage(
  client: HubPatientsClient,
  patientId: string,
  cursor?: ClinicalTimelineCursor,
  limit = 25,
): Promise<ClinicalTimelinePage> {
  const rpcClient = client as unknown as TimelineRpcClient;
  const { data, error } = await rpcClient.rpc('clinical_timeline', {
    p_patient_id: patientId,
    p_limit: Math.min(Math.max(limit, 1), 100),
    ...(cursor
      ? { p_before_at: cursor.occurredAt, p_before_key: cursor.eventKey }
      : {}),
  });

  if (error?.code === '42501') {
    const accessError = new Error('Você não tem permissão para ver estes registros.');
    Object.assign(accessError, { status: 403 });
    throw accessError;
  }
  if (error) throw new Error('Não foi possível carregar a linha do tempo.');
  if (!Array.isArray(data) || !data.every(isTimelineRow)) {
    throw new Error('Resposta inválida ao carregar a linha do tempo.');
  }

  const events = data.map((row) => ({
    eventId: row.event_id,
    eventKey: row.event_key,
    eventType: row.event_type,
    source: row.source,
    occurredAt: row.occurred_at,
    title: row.title,
    summary: row.summary,
    status: row.status,
    dateOnly: row.date_only,
  }));
  const last = data.at(-1);

  return {
    events,
    nextCursor: last?.has_more
      ? { occurredAt: last.occurred_at, eventKey: last.event_key }
      : null,
  };
}
