import { z } from 'zod';

/**
 * Data OPCIONAL de formulário.
 *
 * Por que este helper existe (bug de perda de dado clínico):
 * um `<input type="date">` vazio não envia `undefined` — envia a string `''`.
 * Com `z.coerce.date().optional()`, o `.optional()` do Zod v3 só reconhece
 * `undefined`, então a string vazia entrava na coerção, virava
 * `new Date('')` = Invalid Date e a validação falhava com `invalid_date`.
 * Como o `handleSubmit` do React Hook Form só chama o `onSubmit` quando a
 * validação passa, e como os campos de data não renderizam mensagem de erro,
 * o usuário clicava em "Salvar" e NADA acontecia: o prontuário rejeitava o
 * registro em silêncio.
 *
 * Regras aqui:
 * - `''`, string só de espaços, `null` e `undefined` significam "não informado"
 *   e saem como `undefined` (campo realmente opcional);
 * - qualquer outro valor continua sendo validado de verdade. Data inventada
 *   ("31/02/2026", "abc") REPROVA — num prontuário, data errada é pior que
 *   data ausente (mesmo critério de `dateBRToIso` em utils/br.ts).
 *
 * Tipo de saída preservado: `Date | undefined`. As telas dependem disso
 * (`values.diagnosedAt?.toISOString()`), então não troque por uma união que
 * deixe `''` vazar para o tipo.
 */
/**
 * Ano primeiro: `AAAA-MM-DD`, `AAAA-M-D` e as variantes com barra.
 *
 * Os dígitos do mês e do dia são `{1,2}` de propósito. Com `{2}` fixo, uma
 * digitação como `2026-2-31` não casava, caía no `return true` e o
 * `new Date` rolava para 3 de março sem avisar ninguém — exatamente o dado
 * inventado que este arquivo existe para impedir.
 */
const DATA_ANO_PRIMEIRO = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ,]|$)/;

/**
 * Mês primeiro: `M/D/AAAA`. É assim que o motor de JS lê data com barra e ano
 * no fim (`new Date('02/31/2026')` = 3 de março). Como ele aceita, nós
 * conferimos. Data em DD/MM/AAAA continua chegando aqui só nas telas que ainda
 * não converteram — e, quando o "mês" passa de 12, reprovamos com a nossa
 * mensagem em português em vez do "Invalid date" do Zod.
 */
const DATA_MES_PRIMEIRO = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T ,]|$)/;

/**
 * O `new Date()` do JS "rola" data impossível em silêncio: `2026-02-31` vira
 * 3 de março. Num prontuário isso é dado inventado, então conferimos o
 * calendário de verdade — mesmo critério de `dateBRToIso` (utils/br.ts).
 */
function diaExisteNoCalendario(texto: string): boolean {
  let ano: number;
  let mes: number;
  let dia: number;

  const anoPrimeiro = DATA_ANO_PRIMEIRO.exec(texto);
  if (anoPrimeiro) {
    ano = Number(anoPrimeiro[1]);
    mes = Number(anoPrimeiro[2]);
    dia = Number(anoPrimeiro[3]);
  } else {
    const mesPrimeiro = DATA_MES_PRIMEIRO.exec(texto);
    if (!mesPrimeiro) return true; // Formato desconhecido: deixa o Date decidir.
    mes = Number(mesPrimeiro[1]);
    dia = Number(mesPrimeiro[2]);
    ano = Number(mesPrimeiro[3]);
  }

  if (mes < 1 || mes > 12 || dia < 1) return false;
  // Dia 0 do mês seguinte = último dia deste mês (resolve ano bissexto sozinho).
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return dia <= ultimoDia;
}

function semValor(valor: unknown): unknown {
  if (valor === null || valor === undefined) return undefined;
  if (typeof valor === 'string') {
    const limpo = valor.trim();
    if (limpo === '') return undefined;
    // NaN garante `new Date(NaN)` = Invalid Date, então o Zod reprova com a
    // nossa mensagem em vez de aceitar uma data que não existe.
    return diaExisteNoCalendario(limpo) ? limpo : Number.NaN;
  }
  return valor;
}

const MENSAGEM_PADRAO = 'Data inválida.';

/**
 * Cria uma data opcional com mensagem própria.
 * Use quando o campo merece um texto mais específico para o público 50+.
 */
export function criaDataOpcional(mensagem: string = MENSAGEM_PADRAO) {
  return z.preprocess(
    semValor,
    z.coerce.date({ errorMap: () => ({ message: mensagem }) }).optional(),
  );
}

/** Data opcional padrão: saída `Date | undefined`. */
export const dataOpcional = criaDataOpcional();

/**
 * Data OBRIGATÓRIA de formulário. Saída: `Date` (nunca `undefined`).
 *
 * Existe pelo mesmo motivo do `dataOpcional`, mas resolvendo o problema
 * oposto: `z.coerce.date({ required_error })` só usa a mensagem quando o valor
 * é `undefined`. Um `<input type="datetime-local">` vazio manda `''`, que virava
 * `new Date('')` = Invalid Date, e o usuário lia **"Invalid date"** — em inglês,
 * num app de saúde em português. Aqui o vazio, o lixo e a data que não existe no
 * calendário caem todos na MESMA mensagem, escrita por nós.
 */
export function criaDataObrigatoria(mensagem: string) {
  return z.preprocess(semValor, z.coerce.date({ errorMap: () => ({ message: mensagem }) }));
}
