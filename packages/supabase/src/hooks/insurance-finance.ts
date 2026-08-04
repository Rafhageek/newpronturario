'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import {
  addInsuranceClaim,
  addInsurancePayment,
  deleteInsuranceClaim,
  deleteInsurancePayment,
  listInsuranceClaims,
  listInsurancePayments,
  setInsuranceClaimStatus,
  setInsurancePaymentPaid,
  type InsuranceClaim,
  type InsurancePayment,
} from '../queries/insurance-finance';

const keyPayments = (patientId: string) => ['insurance-payments', patientId] as const;
const keyClaims = (patientId: string) => ['insurance-claims', patientId] as const;

export function useInsurancePayments(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: keyPayments(patientId ?? ''),
    queryFn: () => listInsurancePayments(client),
    enabled: Boolean(patientId),
  });
}

export function useInsuranceClaims(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: keyClaims(patientId ?? ''),
    queryFn: () => listInsuranceClaims(client),
    enabled: Boolean(patientId),
  });
}

/** Mutações de pagamento. Todas invalidam a lista para a tela refletir na hora. */
export function useInsurancePaymentMutations(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keyPayments(patientId) });

  return {
    add: useMutation({
      mutationFn: (input: Parameters<typeof addInsurancePayment>[2]) =>
        addInsurancePayment(client, patientId, input),
      onSuccess: invalidate,
    }),
    setPaid: useMutation({
      mutationFn: ({ id, paidAt }: { id: string; paidAt: string | null }) =>
        setInsurancePaymentPaid(client, id, paidAt),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteInsurancePayment(client, id),
      onSuccess: invalidate,
    }),
  };
}

export function useInsuranceClaimMutations(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keyClaims(patientId) });

  return {
    add: useMutation({
      mutationFn: (input: Parameters<typeof addInsuranceClaim>[2]) =>
        addInsuranceClaim(client, patientId, input),
      onSuccess: invalidate,
    }),
    setStatus: useMutation({
      mutationFn: ({
        id,
        status,
        statusAt,
      }: {
        id: string;
        status: InsuranceClaim['status'];
        statusAt: string;
      }) => setInsuranceClaimStatus(client, id, status, statusAt),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteInsuranceClaim(client, id),
      onSuccess: invalidate,
    }),
  };
}

export type { InsurancePayment, InsuranceClaim };
