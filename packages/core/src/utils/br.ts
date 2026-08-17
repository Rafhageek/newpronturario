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

/**
 * Máscara de CPF PROGRESSIVA, para aplicar a cada tecla digitada.
 * Diferente de `formatCPF`, que só formata o valor completo: aqui o separador
 * aparece conforme a pessoa digita, sem travar quando ainda faltam dígitos.
 */
export function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara progressiva de CEP: 00000-000. */
export function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** CEP tem 8 dígitos. Não confere se existe — só o formato. */
export function isValidCEP(value: string): boolean {
  return onlyDigits(value).length === 8;
}

/* ───────────────────────────── Números em pt-BR ─────────────────────────────
 * O Brasil escreve 36,5 e 1.234,5 — vírgula decimal, ponto de milhar. O
 * `Number()` do JavaScript só entende o formato inglês, e as telas vinham
 * resolvendo isso com `v.replace(',', '.')`, que tem DOIS furos:
 *
 *   1. `String.replace` com string literal troca só a PRIMEIRA ocorrência;
 *   2. o ponto de milhar não era tratado — `'1.234,5'` virava `'1.234.5'` e
 *      `Number` devolvia NaN.
 *
 * Onde isso doía: glicemia. É o campo de sinal vital em que a casa do milhar
 * aparece de verdade, e é o campo de quem tem diabetes — exatamente o
 * registro que não pode ser recusado por causa da pontuação.
 * ========================================================================== */

/**
 * Milhar brasileiro, com ou sem decimal: `1.234`, `1.234,5`, `1.234.567`.
 *
 * O primeiro grupo NÃO pode começar com zero. É isso que separa `1.234`
 * (mil duzentos e trinta e quatro) de `0.123` — quem escreve zero antes do
 * ponto está escrevendo um decimal em formato inglês, não um milhar.
 */
const MILHAR_BR = /^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/;

/** Decimal com vírgula, sem milhar: `36,5`, `1234,5`, `42`. */
const DECIMAL_VIRGULA = /^-?\d+(,\d+)?$/;

/**
 * Texto de campo → número, aceitando a pontuação brasileira.
 *
 *   `'36,5'`    → 36.5     (vírgula decimal, o jeito certo daqui)
 *   `'36.5'`    → 36.5     (ponto decimal; teclado numérico do celular)
 *   `'1.234'`   → 1234     (ponto de milhar)
 *   `'1.234,5'` → 1234.5   (milhar + decimal)
 *   `''`        → undefined
 *   `'abc'`     → NaN
 *
 * Vazio sai como `undefined` (campo em branco = não informado). Tudo o mais
 * que não for número sai como **NaN de propósito**, nunca `undefined`:
 * `undefined` jogaria fora, em silêncio, um valor que a pessoa digitou. Num
 * prontuário, descartar dado calado é pior que recusar com explicação — o NaN
 * cai na validação e volta com a mensagem que diz qual campo é.
 *
 * Pela mesma razão a função não "conserta" o que não reconhece: `'1,5.5'` sai
 * NaN em vez de virar um número que ninguém digitou.
 */
export function parseNumeroBR(value: string): number | undefined {
  const limpo = value.trim();
  if (limpo === '') return undefined;
  // Milhar: tira os pontos ANTES de mexer na vírgula, senão `1.234,5` vira
  // `1.234.5` — o bug original.
  if (MILHAR_BR.test(limpo)) return Number(limpo.replace(/\./g, '').replace(',', '.'));
  if (DECIMAL_VIRGULA.test(limpo)) return Number(limpo.replace(',', '.'));
  // Sobra o formato inglês (`36.5`, `1234`) e o lixo. O `Number` resolve os
  // dois: número de verdade passa, o resto vira NaN e reprova na validação.
  return Number(limpo);
}

/* ────────────────────────────── Datas em pt-BR ──────────────────────────────
 * O Brasil escreve DD/MM/AAAA. O formulário pedia AAAA-MM-DD (formato de banco)
 * e isso é fonte real de erro: "05/03" é março para quem digita e maio para o
 * computador. Aqui a pessoa SEMPRE lê e escreve DD/MM/AAAA, e a conversão para
 * ISO acontece na borda, na hora de salvar.
 *
 * Tudo manual, sem `Intl`: no mobile (Hermes) `Intl` derruba o app.
 * ========================================================================== */

/** Máscara progressiva de data: DD/MM/AAAA. */
export function maskDateBR(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * 'AAAA-MM-DD' (banco) → 'DD/MM/AAAA' (tela). Devolve '' se não reconhecer,
 * para a tela nunca exibir lixo.
 */
export function isoToDateBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * 'DD/MM/AAAA' (tela) → 'AAAA-MM-DD' (banco). Devolve null quando a data não
 * existe de fato — 31/02 é rejeitado, não "ajustado" para 03/03 como o
 * construtor `Date` faria calado. Data inventada em prontuário é pior que
 * data ausente.
 */
export function dateBRToIso(value: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1) return null;
  // Dia 0 do mês seguinte = último dia deste mês (trata ano bissexto sozinho).
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (dia > ultimoDia) return null;
  const dd = String(dia).padStart(2, '0');
  const mm = String(mes).padStart(2, '0');
  return `${ano}-${mm}-${dd}`;
}

/** A data está completa e é real? (Vazio conta como válido: campo opcional.) */
export function isValidDateBR(value: string): boolean {
  const v = value.trim();
  return v === '' || dateBRToIso(v) !== null;
}
