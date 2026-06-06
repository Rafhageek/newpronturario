/** Utilidades específicas do Brasil (CPF, telefone). Puras e testáveis. */

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Valida CPF (com dígitos verificadores). Aceita com ou sem máscara. */
export function isValidCPF(cpf: string): boolean {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return false;
  // Rejeita sequências repetidas (000..., 111..., etc.).
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const d1 = calcCheckDigit(9);
  const d2 = calcCheckDigit(10);
  return d1 === Number(digits[9]) && d2 === Number(digits[10]);
}

/** Formata CPF como 000.000.000-00 (não valida). */
export function formatCPF(cpf: string): string {
  const d = onlyDigits(cpf).slice(0, 11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
}
