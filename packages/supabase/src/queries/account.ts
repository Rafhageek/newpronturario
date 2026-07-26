import {
  DataExportError,
  buildDataExportManifest,
  collectPaginatedRows,
  type DataExportResourceManifest,
} from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

type ExportRecord = Record<string, unknown>;
type ExportFilter = { column: string; value: string };

interface ExportQuery {
  select(columns: string): ExportQuery;
  eq(column: string, value: string): ExportQuery;
  in(column: string, values: string[]): ExportQuery;
  order(column: string, options: { ascending: boolean }): ExportQuery;
  range(from: number, to: number): PromiseLike<{
    data: ExportRecord[] | null;
    error: unknown | null;
  }>;
}

interface ExportClient {
  from(table: string): ExportQuery;
}

interface ResourcePlan {
  key: string;
  table?: string;
  select?: string;
  filters: ExportFilter[];
  orderBy?: string | string[];
  scope?: string;
}

const PROFILE_FIELDS =
  'id,full_name,date_of_birth,biological_sex,blood_type,phone,cpf,address,height_cm,guardian_id,is_minor,emergency_note,calendar_enabled,calendar_token_rotated_at,created_at,updated_at';
const INVITE_FIELDS =
  'id,inviter_id,invitee_email,role,status,expires_at,accepted_at,created_at';
const PERSONAL_ACCESS_TOKEN_FIELDS =
  'id,user_id,name,token_prefix,scopes,last_used_at,expires_at,revoked_at,created_at';

const DIRECT_PATIENT_TABLES = [
  'diary_entries',
  'vitals',
  'medications',
  'medication_schedules',
  'medication_intakes',
  'exams',
  'exam_metrics',
  'conditions',
  'vaccinations',
  'consents',
  'appointments',
  'allergies',
  'surgeries',
  'family_history',
  'insurance_plans',
] as const;

const DIRECT_USER_TABLES = [
  'reading_list',
  'post_reactions',
  'poll_votes',
  'thread_follows',
  'menstrual_cycle_logs',
  'notification_queue',
  'diary_pain_points',
  'reputation_events',
  'professional_verifications',
  'user_strikes',
  'voucher_redemptions',
  'water_logs',
  'body_composition',
  'body_measurements',
  'meal_logs',
  'user_goals',
  'food_entries',
  'account_deletion_requests',
] as const;

const ORDER_BY_BY_TABLE: Readonly<Record<string, string[]>> = {
  reading_list: ['user_id', 'content_id'],
  poll_votes: ['user_id', 'poll_id'],
  thread_follows: ['user_id', 'post_id'],
  group_members: ['user_id', 'group_id'],
};

function uniqueRows(rows: ExportRecord[]): ExportRecord[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = typeof row.id === 'string'
      ? `id:${row.id}`
      : JSON.stringify(row, Object.keys(row).sort());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fieldsOf(rows: ExportRecord[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
}

/**
 * Exporta todos os registros estruturados vinculados ao titular. Cada recurso
 * é paginado e qualquer erro invalida a operação inteira (fail-closed).
 */
export async function exportUserData(
  client: HubPatientsClient,
  patientId: string,
): Promise<Record<string, unknown>> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user || userData.user.id !== patientId) {
    throw new DataExportError();
  }

  const dynamicClient = client as unknown as ExportClient;
  const data: Record<string, ExportRecord[]> = {};
  const manifests: DataExportResourceManifest[] = [];

  async function load(plan: ResourcePlan): Promise<ExportRecord[]> {
    const table = plan.table ?? plan.key;
    const rows = await collectPaginatedRows<ExportRecord>((from, to) => {
      let query = dynamicClient.from(table).select(plan.select ?? '*');
      for (const filter of plan.filters) query = query.eq(filter.column, filter.value);
      const orderColumns = typeof plan.orderBy === 'string'
        ? [plan.orderBy]
        : plan.orderBy ?? ORDER_BY_BY_TABLE[table] ?? ['id'];
      for (const column of orderColumns) query = query.order(column, { ascending: true });
      return query.range(from, to);
    });
    return rows;
  }

  async function add(plan: ResourcePlan): Promise<ExportRecord[]> {
    const rows = await load(plan);
    data[plan.key] = rows;
    manifests.push({
      key: plan.key,
      source_table: plan.table ?? plan.key,
      record_count: rows.length,
      fields: fieldsOf(rows),
      scope: plan.scope ?? plan.filters.map((filter) => filter.column).join(' OR '),
    });
    return rows;
  }

  async function addUnion(key: string, table: string, plans: ResourcePlan[], scope: string) {
    const rows = uniqueRows((await Promise.all(plans.map(load))).flat());
    data[key] = rows;
    manifests.push({ key, source_table: table, record_count: rows.length, fields: fieldsOf(rows), scope });
    return rows;
  }

  await add({ key: 'profiles', table: 'profiles', select: PROFILE_FIELDS, filters: [{ column: 'id', value: patientId }] });
  data.auth_account = [{
    id: userData.user.id,
    email: userData.user.email ?? null,
    phone: userData.user.phone ?? null,
    created_at: userData.user.created_at,
    updated_at: userData.user.updated_at,
    last_sign_in_at: userData.user.last_sign_in_at ?? null,
    email_confirmed_at: userData.user.email_confirmed_at ?? null,
    phone_confirmed_at: userData.user.phone_confirmed_at ?? null,
    user_metadata: userData.user.user_metadata,
  }];
  manifests.push({
    key: 'auth_account',
    source_table: 'auth.users (sessão autenticada)',
    record_count: 1,
    fields: fieldsOf(data.auth_account),
    scope: 'usuário autenticado; credenciais e sessões omitidas',
  });

  for (const table of DIRECT_PATIENT_TABLES) {
    await add({ key: table, filters: [{ column: 'patient_id', value: patientId }] });
  }

  for (const table of DIRECT_USER_TABLES) {
    await add({ key: table, filters: [{ column: 'user_id', value: patientId }] });
  }

  await add({ key: 'group_members', filters: [{ column: 'user_id', value: patientId }], orderBy: ['user_id', 'group_id'] });
  await add({ key: 'user_settings', filters: [{ column: 'user_id', value: patientId }], orderBy: 'user_id' });
  await add({ key: 'social_profiles', filters: [{ column: 'user_id', value: patientId }], orderBy: 'user_id' });
  await add({ key: 'community_members', filters: [{ column: 'user_id', value: patientId }], orderBy: 'user_id' });
  await add({ key: 'menstrual_cycle_settings', filters: [{ column: 'user_id', value: patientId }], orderBy: 'user_id' });
  await add({
    key: 'personal_access_tokens',
    select: PERSONAL_ACCESS_TOKEN_FIELDS,
    filters: [{ column: 'user_id', value: patientId }],
  });

  const posts = await add({ key: 'posts', filters: [{ column: 'author_id', value: patientId }] });
  await add({ key: 'post_comments', filters: [{ column: 'author_id', value: patientId }] });
  await add({ key: 'user_reports', filters: [{ column: 'reporter_id', value: patientId }] });
  await add({ key: 'useful_marks', filters: [{ column: 'marked_by', value: patientId }] });
  await add({ key: 'health_places', filters: [{ column: 'created_by', value: patientId }] });
  await add({
    key: 'vouchers',
    select: 'id,kind,duration_days,max_uses,uses_count,created_by,expires_at,active,created_at',
    filters: [{ column: 'created_by', value: patientId }],
  });
  await add({ key: 'moderation_actions', filters: [{ column: 'actor_id', value: patientId }] });

  await addUnion(
    'audit_log',
    'audit_log',
    [
      { key: 'audit_log', filters: [{ column: 'patient_id', value: patientId }] },
      { key: 'audit_log', filters: [{ column: 'actor_id', value: patientId }] },
    ],
    'patient_id OR actor_id',
  );

  await addUnion(
    'care_relationships',
    'care_relationships',
    [
      { key: 'care_relationships', filters: [{ column: 'patient_id', value: patientId }] },
      { key: 'care_relationships', filters: [{ column: 'caregiver_id', value: patientId }] },
    ],
    'patient_id OR caregiver_id',
  );
  await addUnion(
    'caregiver_invites',
    'caregiver_invites',
    [
      { key: 'caregiver_invites', select: INVITE_FIELDS, filters: [{ column: 'inviter_id', value: patientId }] },
      { key: 'caregiver_invites', select: INVITE_FIELDS, filters: [{ column: 'invitee_email', value: userData.user.email ?? '' }] },
    ],
    'inviter_id OR invitee_email; token omitido',
  );
  await addUnion(
    'user_connections',
    'user_connections',
    [
      { key: 'user_connections', filters: [{ column: 'follower_id', value: patientId }], orderBy: ['follower_id', 'following_id'] },
      { key: 'user_connections', filters: [{ column: 'following_id', value: patientId }], orderBy: ['follower_id', 'following_id'] },
    ],
    'follower_id OR following_id',
  );

  const postIds = posts.map((row) => row.id).filter((id): id is string => typeof id === 'string');
  if (postIds.length > 0) {
    const pollRows = await collectPaginatedRows<ExportRecord>((from, to) =>
      dynamicClient.from('polls').select('*').in('post_id', postIds).order('id', { ascending: true }).range(from, to),
    );
    data.polls = pollRows;
    manifests.push({ key: 'polls', source_table: 'polls', record_count: pollRows.length, fields: fieldsOf(pollRows), scope: 'post_id de posts do titular' });
  } else {
    data.polls = [];
    manifests.push({ key: 'polls', source_table: 'polls', record_count: 0, fields: [], scope: 'post_id de posts do titular' });
  }

  const journeys = await add({ key: 'pregnancy_journeys', filters: [{ column: 'user_id', value: patientId }] });
  const journeyIds = journeys.map((row) => row.id).filter((id): id is string => typeof id === 'string');
  for (const table of ['pregnancy_weight_log', 'pregnancy_fetal_movements', 'pregnancy_milestones'] as const) {
    const rows = journeyIds.length === 0
      ? []
      : await collectPaginatedRows<ExportRecord>((from, to) =>
          dynamicClient.from(table).select('*').in('journey_id', journeyIds).order('id', { ascending: true }).range(from, to),
        );
    data[table] = rows;
    manifests.push({ key: table, source_table: table, record_count: rows.length, fields: fieldsOf(rows), scope: 'journey_id de gestação do titular' });
  }

  const children = await add({ key: 'children', filters: [{ column: 'parent_profile_id', value: patientId }] });
  const childIds = children.map((row) => row.id).filter((id): id is string => typeof id === 'string');
  for (const table of ['child_growth_measurements', 'child_milestones', 'child_vaccine_schedule'] as const) {
    const rows = childIds.length === 0
      ? []
      : await collectPaginatedRows<ExportRecord>((from, to) =>
          dynamicClient.from(table).select('*').in('child_id', childIds).order('id', { ascending: true }).range(from, to),
        );
    data[table] = rows;
    manifests.push({ key: table, source_table: table, record_count: rows.length, fields: fieldsOf(rows), scope: 'child_id de dependente do titular' });
  }

  const generatedAt = new Date().toISOString();
  return {
    manifest: buildDataExportManifest(patientId, manifests, generatedAt),
    schema: {
      encoding: 'UTF-8',
      container: 'JSON',
      resource_shape: 'Cada chave de data contém uma lista de linhas do recurso indicado no manifesto.',
      null_semantics: 'null representa valor ausente no registro de origem.',
    },
    data,
  };
}

/**
 * Reautentica o titular e registra a solicitação no servidor. O chamador
 * encerra a sessão após a confirmação do RPC.
 */
export async function requestAccountDeletion(
  client: HubPatientsClient,
  email: string,
  password: string,
): Promise<void> {
  const { error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError) throw new Error('Não foi possível confirmar sua identidade.');

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user || userData.user.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error('Sessão inválida.');
  }

  const { error } = await client.rpc('request_account_deletion');
  if (error) throw new Error('Não foi possível registrar a solicitação.');
}
