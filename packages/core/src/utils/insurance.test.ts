import { describe, expect, it } from 'vitest';
import {
  formatBRL,
  parseBRLToCents,
  paymentSituation,
  totalPaidCents,
} from '../constants/insurance';

describe('dinheiro em centavos', () => {
  it('formata em real brasileiro', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(100000000)).toBe('R$ 1.000.000,00');
  });

  it('lê o que a pessoa digita, com ou sem separador', () => {
    expect(parseBRLToCents('1.234,56')).toBe(123456);
    expect(parseBRLToCents('1234,56')).toBe(123456);
    expect(parseBRLToCents('R$ 890,10')).toBe(89010);
    expect(parseBRLToCents('450')).toBe(45000);
  });

  it('rejeita entrada que não é número', () => {
    expect(parseBRLToCents('')).toBeNull();
    expect(parseBRLToCents('abc')).toBeNull();
  });

  it('ida e volta preserva o valor', () => {
    for (const c of [1, 99, 12345, 987654321]) {
      expect(parseBRLToCents(formatBRL(c))).toBe(c);
    }
  });

  it('soma SÓ o que foi pago (é o número que vai para o imposto de renda)', () => {
    const pagamentos = [
      { paid_at: '2026-01-10', amount_cents: 50000 },
      { paid_at: null, amount_cents: 50000 }, // em aberto: não entra
      { paid_at: '2026-02-10', amount_cents: 25000 },
    ];
    expect(totalPaidCents(pagamentos)).toBe(75000);
    expect(totalPaidCents([])).toBe(0);
  });
});

describe('situação do pagamento', () => {
  const hoje = new Date(Date.UTC(2026, 7, 4)); // 04/08/2026

  it('pago vence a data: se tem baixa, está pago mesmo se venceu antes', () => {
    expect(paymentSituation({ due_date: '2026-01-01', paid_at: '2026-01-05' }, hoje)).toBe('pago');
  });

  it('distingue vencido, hoje e futuro', () => {
    expect(paymentSituation({ due_date: '2026-08-03', paid_at: null }, hoje)).toBe('atrasado');
    expect(paymentSituation({ due_date: '2026-08-04', paid_at: null }, hoje)).toBe('vence_hoje');
    expect(paymentSituation({ due_date: '2026-08-05', paid_at: null }, hoje)).toBe('a_vencer');
  });

  it('boleto que vence HOJE nunca aparece como atrasado, a qualquer hora do dia', () => {
    // Comparar `Date` completo faria o boleto de hoje virar "atraso" à tarde.
    const tarde = new Date(Date.UTC(2026, 7, 4, 23, 59, 59));
    expect(paymentSituation({ due_date: '2026-08-04', paid_at: null }, tarde)).toBe('vence_hoje');
  });

  it('data irreconhecível não vira "atrasado" por engano', () => {
    expect(paymentSituation({ due_date: 'sem data', paid_at: null }, hoje)).toBe('a_vencer');
  });
});
