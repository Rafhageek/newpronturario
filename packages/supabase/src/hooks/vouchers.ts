'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  hasPlusAccess,
  redeemVoucher,
  listVouchers,
  createVoucher,
  type NewVoucher,
} from '../queries/vouchers';

/** Entitlement Plus do usuário (voucher ativo). */
export function useHasPlusAccess(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.hasPlusAccess(userId ?? ''),
    queryFn: () => hasPlusAccess(client),
    enabled: Boolean(userId),
  });
}

export function useRedeemVoucher(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => redeemVoucher(client, code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.hasPlusAccess(userId) });
      qc.invalidateQueries({ queryKey: queryKeys.communityMember(userId) });
    },
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────
export function useVouchers() {
  const client = useHubPatientsClient();
  return useQuery({ queryKey: queryKeys.vouchers(), queryFn: () => listVouchers(client) });
}

export function useCreateVoucher() {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewVoucher) => createVoucher(client, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vouchers() }),
  });
}
