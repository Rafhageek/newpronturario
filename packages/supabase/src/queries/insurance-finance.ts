import type { HubPatientsClient } from '../types';

/**
 * Pagamentos e requerimentos do plano de saúde.
 *
 * Tudo passa pela RLS dono-apenas (migração 0044): não existe `patient_id` vindo
 * do cliente na leitura — o banco decide o que aparece. Na escrita ele é
 * enviado e conferido de novo pela política, então divergência é recusada em
 * vez de gravar no nome de outra pessoa.
 */

export interface InsurancePayment {
  id: string;
  patient_id: string;
  plan_id: string | null;
  reference_month: string | null;
  due_date: string;
  paid_at: string | null;
  amount_cents: number;
  method: 'boleto' | 'pix' | 'debito' | 'cartao' | 'outro' | null;
  notes: string | null;
  receipt_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsuranceClaim {
  id: string;
  patient_id: string;
  plan_id: string | null;
  kind: 'reembolso' | 'autorizacao' | 'outro';
  protocol: string | null;
  title: string;
  requested_at: string;
  status: 'aberto' | 'em_analise' | 'aprovado' | 'negado' | 'pago';
  status_at: string | null;
  amount_cents: number | null;
  notes: string | null;
  document_path: string | null;
  created_at: string;
  updated_at: string;
}

type PaymentInput = Omit<
  InsurancePayment,
  'id' | 'patient_id' | 'created_at' | 'updated_at'
>;
type ClaimInput = Omit<InsuranceClaim, 'id' | 'patient_id' | 'created_at' | 'updated_at'>;

/* ─────────────────────────── Pagamentos ─────────────────────────── */

export async function listInsurancePayments(
  client: HubPatientsClient,
): Promise<InsurancePayment[]> {
  const { data, error } = await client
    .from('insurance_payments')
    .select('*')
    .order('due_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InsurancePayment[];
}

export async function addInsurancePayment(
  client: HubPatientsClient,
  patientId: string,
  input: Partial<PaymentInput> & Pick<PaymentInput, 'due_date' | 'amount_cents'>,
): Promise<InsurancePayment> {
  const { data, error } = await client
    .from('insurance_payments')
    // `patient_id` explícito: a política confere contra o usuário da sessão.
    .insert({ ...input, patient_id: patientId } as never)
    .select('*')
    .single();
  if (error) throw error;
  return data as unknown as InsurancePayment;
}

/** Baixa/estorno de pagamento. `paidAt = null` desfaz, sem apagar o registro. */
export async function setInsurancePaymentPaid(
  client: HubPatientsClient,
  paymentId: string,
  paidAt: string | null,
): Promise<void> {
  const { error } = await client
    .from('insurance_payments')
    .update({ paid_at: paidAt } as never)
    .eq('id', paymentId);
  if (error) throw error;
}

export async function deleteInsurancePayment(
  client: HubPatientsClient,
  paymentId: string,
): Promise<void> {
  const { error } = await client.from('insurance_payments').delete().eq('id', paymentId);
  if (error) throw error;
}

/* ────────────────────────── Requerimentos ────────────────────────── */

export async function listInsuranceClaims(client: HubPatientsClient): Promise<InsuranceClaim[]> {
  const { data, error } = await client
    .from('insurance_claims')
    .select('*')
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as InsuranceClaim[];
}

export async function addInsuranceClaim(
  client: HubPatientsClient,
  patientId: string,
  input: Partial<ClaimInput> & Pick<ClaimInput, 'kind' | 'title' | 'requested_at'>,
): Promise<InsuranceClaim> {
  const { data, error } = await client
    .from('insurance_claims')
    .insert({ ...input, patient_id: patientId } as never)
    .select('*')
    .single();
  if (error) throw error;
  return data as unknown as InsuranceClaim;
}

export async function setInsuranceClaimStatus(
  client: HubPatientsClient,
  claimId: string,
  status: InsuranceClaim['status'],
  statusAt: string,
): Promise<void> {
  const { error } = await client
    .from('insurance_claims')
    .update({ status, status_at: statusAt } as never)
    .eq('id', claimId);
  if (error) throw error;
}

export async function deleteInsuranceClaim(
  client: HubPatientsClient,
  claimId: string,
): Promise<void> {
  const { error } = await client.from('insurance_claims').delete().eq('id', claimId);
  if (error) throw error;
}
