import { z } from 'zod';

/**
 * Número OPCIONAL de formulário. Irmão do `dataOpcional`, mesma filosofia.
 *
 * Por que este helper existe (o formulário travado):
 * um `<input type="number">` vazio não envia `undefined` — envia a string `''`.
 * Com `z.coerce.number().optional()`, o `.optional()` do Zod v3 só reconhece
 * `undefined`, então a string vazia entrava na coerção e `Number('')` vira
 * **0**. A partir daí, `.positive()` reprovava e a tela acusava "Altura
 * inválida." sobre um número que o usuário NUNCA digitou — e, como o
 * `handleSubmit` do React Hook Form só chama o `onSubmit` quando tudo passa,
 * nem o nome, nem o tipo sanguíneo, nem a observação de emergência eram salvos.
 *
 * Regras aqui:
 * - `''`, string só de espaços, `null` e `undefined` significam "não informado"
 *   e saem como `undefined` (campo realmente opcional);
 * - vírgula é o separador decimal do Brasil: `"170,5"` vale 170,5, não NaN.
 *   O público deste app digita com vírgula, e um número recusado por causa da
 *   pontuação é um dado clínico perdido;
 * - qualquer outro valor continua sendo validado de verdade. Texto que não é
 *   número REPROVA — ele NÃO pode virar 0, porque 0 é um valor plausível num
 *   prontuário (peso, dose, glicemia) e viraria dado inventado.
 *
 * Tipo de saída preservado: `number | undefined`. As telas dependem disso
 * (`values.heightCm ?? null`), então não troque por uma união que deixe `''`
 * vazar para o tipo.
 */

/** Uma vírgula decimal, sem ponto junto: `"170,5"`, `"3,2"`. */
const DECIMAL_COM_VIRGULA = /^-?\d+,\d+$/;

function semValor(valor: unknown): unknown {
  if (valor === null || valor === undefined) return undefined;
  if (typeof valor === 'string') {
    const limpo = valor.trim();
    if (limpo === '') return undefined;
    if (DECIMAL_COM_VIRGULA.test(limpo)) return limpo.replace(',', '.');
    // Espaço no meio ("1 70") e texto viram NaN na coerção e REPROVAM, em vez
    // de serem "corrigidos" para um número que ninguém digitou.
    return limpo;
  }
  // `true` vira 1 e `[]` vira 0 no `Number()`: não é número de formulário,
  // é acidente. Reprova.
  if (typeof valor !== 'number') return Number.NaN;
  return valor;
}

const MENSAGEM_PADRAO = 'Número inválido.';

/**
 * Cria um número opcional com mensagem própria.
 * Use quando o campo merece um texto mais específico para o público 50+.
 */
export function criaNumeroOpcional(mensagem: string = MENSAGEM_PADRAO) {
  return z.preprocess(
    semValor,
    z.coerce.number({ errorMap: () => ({ message: mensagem }) }).optional(),
  );
}

/** Número opcional padrão: saída `number | undefined`. */
export const numeroOpcional = criaNumeroOpcional();
