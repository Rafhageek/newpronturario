import type { PersonalAccessToken } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

export type PersonalAccessTokenSummary = Omit<PersonalAccessToken, 'token_hash'>;

interface RpcResult<T> {
  data: T | null;
  error: { message?: string } | null;
}

type RpcCall = <T>(
  functionName: string,
  params?: Record<string, unknown>,
) => PromiseLike<RpcResult<T>>;

function rpcCall(client: HubPatientsClient): RpcCall {
  // As RPCs são adicionadas pela migration 0035. O cast local evita alterar o
  // snapshot global de tipos antes da próxima geração oficial do schema.
  return client.rpc.bind(client) as unknown as RpcCall;
}

/** Metadados dos tokens do titular. O hash nunca é selecionado pelo cliente. */
export async function listMyTokens(
  client: HubPatientsClient,
  userId: string,
): Promise<PersonalAccessTokenSummary[]> {
  const { data, error } = await client
    .from('personal_access_tokens')
    .select('id,user_id,name,token_prefix,scopes,last_used_at,expires_at,revoked_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PersonalAccessTokenSummary[];
}

export interface NewAccessToken {
  name: string;
  scopes: string[];
  expiresAt: string;
}

export class PatMfaRequiredError extends Error {
  constructor() {
    super('A autenticação em duas etapas é necessária para emitir a credencial.');
    this.name = 'PatMfaRequiredError';
  }
}

interface IssuedAccessToken {
  token: string;
  id: string;
}

function isIssuedAccessToken(value: unknown): value is IssuedAccessToken {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.token === 'string' &&
    /^vlk_[A-Za-z0-9_-]{43,128}$/.test(record.token) &&
    typeof record.id === 'string'
  );
}

/** Emite o segredo no servidor. O bearer em claro é retornado uma única vez. */
export async function createToken(
  client: HubPatientsClient,
  input: NewAccessToken,
): Promise<string> {
  const { data, error } = await rpcCall(client)<unknown>('issue_personal_access_token', {
    p_name: input.name,
    p_scopes: input.scopes,
    p_expires_at: input.expiresAt,
  });
  if (error?.message?.includes('Autenticação reforçada necessária.')) {
    throw new PatMfaRequiredError();
  }
  if (error || !isIssuedAccessToken(data)) {
    throw new Error('Não foi possível emitir a credencial.');
  }
  return data.token;
}

/** Revoga o token server-side, com verificação de titularidade e auditoria. */
export async function revokeToken(client: HubPatientsClient, id: string): Promise<void> {
  const { error } = await rpcCall(client)<null>('revoke_personal_access_token', {
    p_token_id: id,
  });
  if (error) throw new Error('Não foi possível revogar a credencial.');
}

/** Elegibilidade do assistente de IA mínimo (Plus OU consentimento de compartilhamento). */
export async function hasAiAssistant(client: HubPatientsClient): Promise<boolean> {
  const { data, error } = await client.rpc('has_ai_assistant_access', {});
  if (error) throw error;
  return Boolean(data);
}
