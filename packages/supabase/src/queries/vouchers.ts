import type { Voucher } from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

/** O usuário tem Plus ativo? (voucher resgatado e não expirado.) */
export async function hasPlusAccess(client: HubPatientsClient): Promise<boolean> {
  const { data, error } = await client.rpc('has_plus_access', {});
  if (error) throw error;
  return Boolean(data);
}

/** Resgata um voucher; retorna o vencimento do Plus (ISO) em sucesso. */
export async function redeemVoucher(client: HubPatientsClient, code: string): Promise<string> {
  const { data, error } = await client.rpc('redeem_voucher', { p_code: code });
  if (error) throw error;
  return data as string;
}

/** (admin) Lista todos os vouchers. */
export async function listVouchers(client: HubPatientsClient): Promise<Voucher[]> {
  const { data, error } = await client
    .from('vouchers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface NewVoucher {
  code: string;
  kind: 'plus_trial' | 'plus_full';
  durationDays: number;
  maxUses: number;
  expiresAt?: string | null;
}

/** (admin) Cria um voucher via RPC (gera o código). */
export async function createVoucher(client: HubPatientsClient, input: NewVoucher): Promise<string> {
  const { data, error } = await client.rpc('create_voucher', {
    p_code: input.code,
    p_kind: input.kind,
    p_duration_days: input.durationDays,
    p_max_uses: input.maxUses,
    p_expires_at: input.expiresAt ?? null,
  });
  if (error) throw error;
  return data as string;
}
