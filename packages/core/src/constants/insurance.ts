/**
 * Plano de saúde — rótulos e regras puras, compartilhados por web e mobile.
 *
 * NOTA DE PRODUTO: o app NÃO se conecta ao sistema da operadora. Não existe API
 * pública de plano de saúde no Brasil; cada operadora tem portal fechado. Tudo
 * aqui é registro do próprio titular, e `portal_url` é atalho para abrir o site
 * dela — não sincronização. A tela diz isso ao usuário, para não prometer o que
 * não acontece.
 */

export type InsurancePaymentMethod = 'boleto' | 'pix' | 'debito' | 'cartao' | 'outro';

export const PAYMENT_METHOD_LABELS: Record<InsurancePaymentMethod, string> = {
  boleto: 'Boleto',
  pix: 'PIX',
  debito: 'Débito automático',
  cartao: 'Cartão',
  outro: 'Outro',
};

export type InsuranceClaimKind = 'reembolso' | 'autorizacao' | 'outro';

export const CLAIM_KIND_LABELS: Record<InsuranceClaimKind, string> = {
  reembolso: 'Reembolso',
  autorizacao: 'Autorização',
  outro: 'Outro',
};

export type InsuranceClaimStatus = 'aberto' | 'em_analise' | 'aprovado' | 'negado' | 'pago';

export const CLAIM_STATUS_LABELS: Record<InsuranceClaimStatus, string> = {
  aberto: 'Aberto',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  negado: 'Negado',
  pago: 'Pago',
};

/**
 * Situação de um pagamento, derivada de `paid_at` e `due_date` — não é campo
 * guardado, para não existir a chance de o banco dizer "pago" e a data dizer
 * outra coisa.
 */
export type PaymentSituation = 'pago' | 'vence_hoje' | 'a_vencer' | 'atrasado';

export const PAYMENT_SITUATION_LABELS: Record<PaymentSituation, string> = {
  pago: 'Pago',
  vence_hoje: 'Vence hoje',
  a_vencer: 'A vencer',
  atrasado: 'Em atraso',
};

/**
 * Compara só a parte da DATA, em UTC. Usar `new Date()` direto compararia
 * horário e faria um boleto que vence hoje aparecer como atrasado à tarde.
 */
function diaUtc(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function paymentSituation(
  payment: { due_date: string; paid_at: string | null },
  hoje: Date = new Date(),
): PaymentSituation {
  if (payment.paid_at) return 'pago';
  const venc = diaUtc(payment.due_date);
  if (Number.isNaN(venc)) return 'a_vencer';
  const hojeUtc = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  if (venc < hojeUtc) return 'atrasado';
  if (venc === hojeUtc) return 'vence_hoje';
  return 'a_vencer';
}

/** Centavos → "R$ 1.234,56". Manual: no mobile o Hermes não é confiável com `Intl`. */
export function formatBRL(cents: number): string {
  const negativo = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100);
  const centavos = String(abs % 100).padStart(2, '0');
  const comMilhar = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}R$ ${comMilhar},${centavos}`;
}

/** "1.234,56" ou "1234.56" → centavos. Devolve null quando não é número. */
export function parseBRLToCents(input: string): number | null {
  const limpo = input.replace(/[^\d,.-]/g, '').trim();
  if (limpo === '') return null;
  // Se tem vírgula, ela é o separador decimal (padrão BR) e o ponto é milhar.
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;
  const n = Number(normalizado);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Soma dos pagamentos QUITADOS no período — o número que serve para o IR. */
export function totalPaidCents(payments: { paid_at: string | null; amount_cents: number }[]): number {
  return payments.reduce((soma, p) => (p.paid_at ? soma + p.amount_cents : soma), 0);
}

/**
 * Aviso permanente da tela. O app registra o que o titular informa; ele não
 * fala com a operadora nem confirma pagamento junto ao banco.
 */
export const INSURANCE_DISCLAIMER =
  'Estes registros são seus e ficam só aqui. O aplicativo não se conecta ao sistema da '
  + 'operadora nem confirma pagamentos — em caso de divergência, a informação que vale é a dela.';
