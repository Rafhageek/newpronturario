import type { HubPatientsClient } from '../types';
import { PatMfaRequiredError } from './personal-tokens';

/**
 * Modo Consulta — compartilhamento TEMPORÁRIO do resumo de saúde com o médico.
 *
 * Reaproveita a infraestrutura de Personal Access Tokens (migrações 0027 + 0035):
 *   • emissão .............. RPC `issue_personal_access_token(p_name, p_scopes, p_expires_at)`
 *   • revogação ............ RPC `revoke_personal_access_token(p_token_id)`
 *   • listagem ............. SELECT em `personal_access_tokens` (RLS `pat_select_own`)
 *   • leitura pública ...... RPC `api_me_bundle_v2(p_token)` (grant só para `anon`)
 *
 * Princípios: escopo mínimo, expiração curta (padrão 1 hora), segredo exibido
 * uma única vez e revogação real (o `revoked_at` invalida na hora, porque
 * `api_me_bundle_v2` exige `revoked_at is null` e `expires_at > now()`).
 *
 * NÃO é prontuário médico: são registros pessoais informados pelo paciente.
 */

// ─────────────────────────────── Escopos ───────────────────────────────

/**
 * Únicos escopos aceitos pelo banco (constraint
 * `personal_access_tokens_scopes_allowed` da migração 0035).
 */
export const SHARE_SCOPES = [
  {
    key: 'read:medications',
    label: 'Medicamentos em uso',
    hint: 'Nome, dose, forma e frequência dos ativos',
  },
  {
    key: 'read:vitals',
    label: 'Sinais vitais',
    hint: 'Pressão, glicemia, peso, temperatura…',
  },
  { key: 'read:exams', label: 'Exames', hint: 'Título, categoria e data (sem os arquivos)' },
  { key: 'read:allergies', label: 'Alergias', hint: 'Substância, gravidade e reação' },
  {
    key: 'read:profile',
    label: 'Identificação',
    hint: 'Nome, nascimento, sexo e tipo sanguíneo',
  },
] as const;

export type ShareScope = (typeof SHARE_SCOPES)[number]['key'];

/**
 * Escopos que o **Modo Consulta** aceita — subconjunto menor que `SHARE_SCOPES`.
 *
 * `SHARE_SCOPES` espelha a constraint da migração 0035 (token de API). O link
 * do médico passa por outra função, `issue_consultation_access_token` (migração
 * 0039), que deixa `read:profile` de fora de propósito: são dados cadastrais que
 * o médico não precisa para ver a evolução.
 *
 * Enquanto as duas listas viveram separadas, a seleção padrão trazia
 * `read:profile` e o banco derrubava a emissão com "Escopo de consulta
 * inválido." — o botão "Gerar acesso para o médico" falhava justamente na
 * configuração que a tela sugeria. Derivar daqui é o que impede a divergência
 * de voltar; `sharing-escopos.test.ts` trava as duas pontas.
 */
export const CONSULTATION_SCOPES = [
  'read:medications',
  'read:vitals',
  'read:allergies',
  'read:exams',
] as const satisfies readonly ShareScope[];

export type ConsultationScope = (typeof CONSULTATION_SCOPES)[number];

/** Sugestão inicial: o essencial de uma consulta, sem excesso. */
export const DEFAULT_SHARE_SCOPES: ConsultationScope[] = [
  'read:medications',
  'read:allergies',
  'read:vitals',
];

const VALID_SCOPES = new Set<string>(SHARE_SCOPES.map((s) => s.key));

export function isShareScope(value: string): value is ShareScope {
  return VALID_SCOPES.has(value);
}

/** Rótulo curto de um escopo (para chips na lista de acessos ativos). */
export function shareScopeLabel(scope: string): string {
  const found = SHARE_SCOPES.find((s) => s.key === scope);
  return found ? found.label : scope.replace('read:', '');
}

// ────────────────────────────── Validade ───────────────────────────────

export type SharePresetId = '1h' | 'today' | '24h';

export interface SharePreset {
  id: SharePresetId;
  label: string;
  hint: string;
}

/** O primeiro item é o padrão recomendado: janela curta = menor exposição. */
export const SHARE_PRESETS: readonly SharePreset[] = [
  { id: '1h', label: '1 hora', hint: 'Recomendado — dura o tempo da consulta' },
  { id: 'today', label: 'Até o fim do dia', hint: 'Expira à meia-noite de hoje' },
  { id: '24h', label: '24 horas', hint: 'Máximo permitido para o Modo Consulta' },
];

/**
 * Horas de validade por preset, dentro do teto de 24 h que a RPC de consulta
 * (`issue_consultation_access_token`, migração 0039) aplica NO BANCO.
 */
export function hoursForPreset(preset: SharePresetId, from: Date = new Date()): number {
  if (preset === '24h') return 24;
  if (preset === 'today') {
    const endOfDay = new Date(from);
    endOfDay.setHours(23, 59, 59, 0);
    const hours = Math.ceil((endOfDay.getTime() - from.getTime()) / 3_600_000);
    return Math.min(24, Math.max(1, hours));
  }
  return 1;
}

export const DEFAULT_SHARE_PRESET: SharePresetId = '1h';

/** O banco recusa expiração <= agora + 5 min; deixamos folga de 10 min. */
const MIN_VALIDITY_MS = 10 * 60_000;
/** Teto do banco: 90 dias (usamos bem menos, mas o clamp evita erro de borda). */
const MAX_VALIDITY_MS = 89 * 24 * 60 * 60_000;

/** Converte um preset em `expires_at` ISO, respeitando os limites do banco. */
export function expiresAtForPreset(preset: SharePresetId, from: Date = new Date()): string {
  const now = from.getTime();
  let target: number;
  if (preset === '24h') {
    target = now + 24 * 60 * 60_000;
  } else if (preset === 'today') {
    const endOfDay = new Date(from);
    endOfDay.setHours(23, 59, 59, 0);
    target = endOfDay.getTime();
  } else {
    target = now + 60 * 60_000;
  }
  const clamped = Math.min(Math.max(target, now + MIN_VALIDITY_MS), now + MAX_VALIDITY_MS);
  return new Date(clamped).toISOString();
}

/**
 * Tempo restante em PT-BR, formatado à mão.
 * Hermes (mobile) não traz `Intl.RelativeTimeFormat` — usar Intl aqui derruba o app.
 */
export function formatTimeLeft(msRemaining: number): string {
  if (!Number.isFinite(msRemaining) || msRemaining <= 0) return 'expirado';
  const totalSeconds = Math.floor(msRemaining / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    const rest = hours > 0 ? ` e ${hours}h` : '';
    return `${days} ${days === 1 ? 'dia' : 'dias'}${rest}`;
  }
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}min`;
  const seconds = totalSeconds % 60;
  return `${minutes}min ${String(seconds).padStart(2, '0')}s`;
}

// ─────────────────────────── Nome / link ───────────────────────────────

/**
 * Marcador no `name` que separa os acessos do Modo Consulta dos tokens de IA
 * (mesma tabela). Não há coluna `kind` hoje.
 * TODO: migração futura com `personal_access_tokens.kind` para não depender do nome.
 */
export const SHARE_TOKEN_MARK = 'Consulta médica';

/** Nome legível do acesso (aparece na lista e no log de auditoria). */
export function buildShareName(at: Date = new Date()): string {
  const d = String(at.getDate()).padStart(2, '0');
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const h = String(at.getHours()).padStart(2, '0');
  const min = String(at.getMinutes()).padStart(2, '0');
  return `${SHARE_TOKEN_MARK} — ${d}/${m} ${h}:${min}`;
}

/** Link público do Modo Consulta. O segredo é o único elemento do caminho. */
export function buildShareUrl(baseUrl: string, token: string): string {
  const root = baseUrl.replace(/\/+$/, '');
  return `${root}/consulta/${encodeURIComponent(token)}`;
}

/** Formato do segredo emitido pelo banco (`vlk_` + 64 hex, ou base64url legado). */
export const SHARE_TOKEN_PATTERN = /^vlk_[A-Za-z0-9_-]{43,128}$/;

// ─────────────────────────────── Dados ─────────────────────────────────

/** Metadados de um acesso. O `token_hash` NUNCA é lido pelo cliente. */
export interface SharedAccess {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

/** Ativo = não revogado e ainda dentro da validade. */
export function isShareActive(access: SharedAccess, now: number = Date.now()): boolean {
  if (access.revoked_at) return false;
  if (!access.expires_at) return false;
  const expires = Date.parse(access.expires_at);
  return Number.isFinite(expires) && expires > now;
}

interface RpcResult<T> {
  data: T | null;
  error: { message?: string } | null;
}

type RpcCall = <T>(
  functionName: string,
  params?: Record<string, unknown>,
) => PromiseLike<RpcResult<T>>;

/**
 * As RPCs da 0035 ainda não constam no snapshot de tipos do schema; o cast é
 * local e restrito a este módulo (mesmo padrão de `queries/personal-tokens.ts`).
 */
function rpc(client: HubPatientsClient): RpcCall {
  return client.rpc.bind(client) as unknown as RpcCall;
}

/**
 * Acessos do Modo Consulta do titular, mais recentes primeiro.
 * Filtra pelo marcador no nome para não listar tokens de assistente de IA.
 */
export async function listAccessTokens(
  client: HubPatientsClient,
  userId: string,
): Promise<SharedAccess[]> {
  const { data, error } = await client
    .from('personal_access_tokens')
    .select('id,name,token_prefix,scopes,last_used_at,expires_at,revoked_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = (data ?? []) as SharedAccess[];
  return rows.filter((row) => typeof row.name === 'string' && row.name.startsWith(SHARE_TOKEN_MARK));
}

export interface IssueAccessTokenInput {
  scopes: ShareScope[];
  /** Preset de validade. `expiresAt` tem precedência se vier preenchido. */
  preset?: SharePresetId;
  expiresAt?: string;
  /** Nome customizado; por padrão usa `buildShareName()`. */
  name?: string;
}

/** Resultado da emissão. O `token` existe SÓ aqui — o banco guarda apenas o hash. */
export interface IssuedAccess {
  id: string;
  token: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string;
  createdAt: string;
}

function asString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function parseIssued(value: unknown): IssuedAccess | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const token = asString(record, 'token');
  const id = asString(record, 'id');
  if (!id || !SHARE_TOKEN_PATTERN.test(token)) return null;
  const rawScopes = record.scopes;
  const scopes = Array.isArray(rawScopes)
    ? rawScopes.filter((s): s is string => typeof s === 'string')
    : [];
  return {
    id,
    token,
    name: asString(record, 'name'),
    tokenPrefix: asString(record, 'token_prefix'),
    scopes,
    expiresAt: asString(record, 'expires_at'),
    createdAt: asString(record, 'created_at'),
  };
}

/**
 * Emite um acesso temporário. O segredo é gerado NO SERVIDOR e devolvido uma
 * única vez — se a tela recarregar, some (é preciso emitir outro).
 *
 * Usa `issue_consultation_access_token` (migração 0039), que NÃO exige 2FA em
 * troca de limites aplicados no banco: validade máxima de 24 h, apenas escopos
 * clínicos de leitura (sem `read:profile`) e no máximo 3 acessos ativos. O PAT
 * de API (90 dias) continua exigindo AAL2 — isso não foi relaxado.
 */
export async function issueAccessToken(
  client: HubPatientsClient,
  input: IssueAccessTokenInput,
): Promise<IssuedAccess> {
  const scopes = Array.from(new Set(input.scopes)).filter(isShareScope).sort();
  if (scopes.length === 0) {
    throw new Error('Escolha ao menos uma informação para compartilhar.');
  }
  const hours = hoursForPreset(input.preset ?? DEFAULT_SHARE_PRESET);

  const { data, error } = await rpc(client)<unknown>('issue_consultation_access_token', {
    p_scopes: scopes,
    p_hours: hours,
  });

  if (error?.message?.includes('Autenticação reforçada necessária.')) {
    throw new PatMfaRequiredError();
  }
  if (error?.message?.includes('acessos de consulta ativos')) {
    throw new Error('Você já tem 3 acessos ativos. Encerre um antes de gerar outro.');
  }
  if (error) throw new Error('Não foi possível gerar o acesso agora.');

  const issued = parseIssued(data);
  if (!issued) throw new Error('Não foi possível gerar o acesso agora.');
  return issued;
}

/**
 * Revoga o acesso de verdade: grava `revoked_at` e audita. A partir daí,
 * `api_me_bundle_v2` recusa o segredo (a página pública passa a dizer "encerrado").
 */
export async function revokeAccessToken(client: HubPatientsClient, id: string): Promise<void> {
  const { error } = await rpc(client)<null>('revoke_personal_access_token', { p_token_id: id });
  if (error) throw new Error('Não foi possível encerrar este acesso.');
}
