import type { HubPatientsClient } from '../types';

/**
 * Eventos de dose (tabela `dose_events`, migração 0040).
 *
 * Registram a RESPOSTA da pessoa ao lembrete — "Tomei", "Adiar 15 min" ou
 * "Pulei" — vinda da notificação ou de dentro do app. É autorrelato: confirma
 * que a pessoa marcou, não que ingeriu. Owner-only (user_id = auth.uid()).
 *
 * Tabela nova ainda não tipada nos Database types → cast controlado, igual a
 * `queries/body.ts`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(client: HubPatientsClient, name: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(name);
}

/** Chave idempotente da migração 0040 (unique index dose_events_idempotent_idx). */
const DOSE_CONFLICT_KEY = 'user_id,medication_id,scheduled_for';

export type DoseEventStatus = 'taken' | 'snoozed' | 'skipped';
export type DoseEventSource = 'notification' | 'app';

export type DoseEvent = {
  id: string;
  user_id: string;
  medication_id: string;
  schedule_id: string | null;
  scheduled_for: string;
  status: DoseEventStatus;
  source: DoseEventSource;
  created_at: string;
};

export type DoseEventInput = {
  medication_id: string;
  schedule_id?: string | null;
  /** ISO do horário PREVISTO da dose (não o do clique) — compõe a chave idempotente. */
  scheduled_for: string;
  status: DoseEventStatus;
  source?: DoseEventSource;
};

/**
 * Grava um evento de dose. IDEMPOTENTE: a mesma dose (pessoa + remédio +
 * horário previsto) atualiza a linha existente em vez de duplicar — é o que
 * segura a fila offline do celular reenviando o mesmo evento.
 */
export async function recordDoseEvent(
  client: HubPatientsClient,
  userId: string,
  input: DoseEventInput,
): Promise<void> {
  await recordDoseEvents(client, userId, [input]);
}

/** Versão em lote (usada para esvaziar a fila offline de uma vez só). */
export async function recordDoseEvents(
  client: HubPatientsClient,
  userId: string,
  inputs: readonly DoseEventInput[],
): Promise<void> {
  if (inputs.length === 0) return;
  const rows = inputs.map((input) => ({
    user_id: userId,
    schedule_id: input.schedule_id ?? null,
    source: input.source ?? 'app',
    medication_id: input.medication_id,
    scheduled_for: input.scheduled_for,
    status: input.status,
  }));
  const { error } = await table(client, 'dose_events').upsert(rows, {
    onConflict: DOSE_CONFLICT_KEY,
  });
  if (error) throw error;
}

export type DoseEventFilter = {
  /** ISO inclusivo. Default: 30 dias atrás. */
  since?: string;
  /** ISO inclusivo. Default: sem limite superior. */
  until?: string;
  medicationId?: string;
  limit?: number;
};

/** Dias atrás em ISO (base dos períodos padrão). */
function daysAgoISO(days: number): string {
  const from = new Date();
  from.setDate(from.getDate() - days);
  return from.toISOString();
}

/** Eventos do período, do mais recente para o mais antigo. */
export async function listDoseEvents(
  client: HubPatientsClient,
  userId: string,
  filter: DoseEventFilter = {},
): Promise<DoseEvent[]> {
  let query = table(client, 'dose_events')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_for', filter.since ?? daysAgoISO(30));

  if (filter.until) query = query.lte('scheduled_for', filter.until);
  if (filter.medicationId) query = query.eq('medication_id', filter.medicationId);

  const { data, error } = await query
    .order('scheduled_for', { ascending: false })
    .limit(filter.limit ?? 500);
  if (error) throw error;
  return (data ?? []) as DoseEvent[];
}

export type DoseAdherenceSummary = {
  /** Início do período (ISO). */
  since: string;
  days: number;
  taken: number;
  snoozed: number;
  skipped: number;
  /** taken + snoozed + skipped. */
  registered: number;
  /** Eventos crus do período — a UI usa com `adherenceByHour` do core. */
  events: DoseEvent[];
};

/**
 * Agregado do período. Devolve as contagens JÁ somadas e os eventos crus (o
 * cálculo de percentual fica no core, que sabe quantas doses eram previstas).
 */
export async function getDoseAdherence(
  client: HubPatientsClient,
  userId: string,
  days = 30,
  medicationId?: string,
): Promise<DoseAdherenceSummary> {
  const since = daysAgoISO(days);
  const events = await listDoseEvents(client, userId, { since, medicationId });

  let taken = 0;
  let snoozed = 0;
  let skipped = 0;
  for (const event of events) {
    if (event.status === 'taken') taken += 1;
    else if (event.status === 'snoozed') snoozed += 1;
    else skipped += 1;
  }

  return { since, days, taken, snoozed, skipped, registered: events.length, events };
}
