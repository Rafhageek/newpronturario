import { z } from 'zod';

/**
 * Mensagens de validação do Zod em PORTUGUÊS DO BRASIL.
 *
 * Por que este arquivo existe (regressão de experiência confirmada por execução):
 * quando os formulários passaram a EXIBIR a mensagem de erro embaixo do campo,
 * frases que antes ficavam invisíveis viraram texto na tela — e várias estavam
 * em inglês, escritas pelo próprio Zod:
 *
 *   - colar texto longo no campo CID-10 → "String must contain at most 10 character(s)"
 *   - deixar o sexo da criança em branco → "Required"
 *   - digitar letra num campo numérico    → "Expected number, received nan"
 *
 * Num app de saúde em português, para público 50+, uma frase em inglês embaixo
 * do campo não é um detalhe de acabamento: é o usuário parado sem saber o que
 * fazer. Traduzir `.max()` a `.max()` resolveria só o que já sangrou hoje e
 * deixaria o PRÓXIMO campo nascer em inglês de novo — por isso a correção é
 * aqui, no mapa de erros, que cobre todos os códigos de uma vez.
 *
 * COMO A PRECEDÊNCIA FUNCIONA (verificado no fonte do zod, `makeIssue`):
 *   1. mensagem literal passada no schema (`.max(10, 'Use no máximo 10…')`)
 *      curto-circuita tudo e vence sempre;
 *   2. `errorMap` do próprio schema (é o caso de `criaDataOpcional`);
 *   3. ESTE mapa global;
 *   4. o mapa padrão em inglês — que a partir daqui nunca chega ao usuário.
 * Ou seja: nada do que já estava escrito à mão em português muda de texto.
 *
 * DETERMINISMO (o cuidado que o `z.setErrorMap` global exige):
 * o mapa é instalado na avaliação deste módulo E exportado como função para
 * quem quiser chamar explicitamente. `schemas/index.ts` importa este arquivo na
 * primeira linha, e TODO consumidor do app entra pelo pacote (`@hubpatients/core`
 * → `src/index.ts` → `./schemas`) — não há um único import relativo profundo em
 * `apps/` (conferido: 253 imports, todos da raiz do pacote). Como o `errorMap` é
 * consultado na HORA DO PARSE, e não na hora de construir o schema, a ordem de
 * avaliação entre os módulos de schema é irrelevante: basta que este módulo
 * tenha rodado antes do primeiro `safeParse`, o que o grafo de imports garante.
 */

/** `2026-08-12` → `12/08/2026`. Formatação própria para não depender de ICU. */
function dataLegivel(valor: unknown): string {
  const d = valor instanceof Date ? valor : new Date(Number(valor));
  if (Number.isNaN(d.getTime())) return 'a data informada';
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

function caracteres(n: number): string {
  return n === 1 ? '1 caractere' : `${n} caracteres`;
}

function itens(n: number): string {
  return n === 1 ? '1 item' : `${n} itens`;
}

/** Nome do tipo como o usuário entende, não como o JavaScript chama. */
const TIPO_EM_PORTUGUES: Record<string, string> = {
  string: 'um texto',
  number: 'um número',
  bigint: 'um número inteiro',
  boolean: 'sim ou não',
  date: 'uma data',
  array: 'uma lista',
  object: 'um formulário',
  integer: 'um número inteiro',
  float: 'um número',
};

export const mapaDeErrosPtBr: z.ZodErrorMap = (issue) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type: {
      // Campo não enviado. É o "Required" que aparecia no seletor de sexo.
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: 'Campo obrigatório.' };
      }
      if (issue.expected === 'date') return { message: 'Data inválida.' };
      // `received: 'nan'` é o texto que não virou número. NÃO pode ser tratado
      // como 0: num prontuário, 0 é valor plausível e viraria dado inventado.
      if (issue.expected === 'number' || issue.expected === 'integer') {
        return { message: 'Informe um número.' };
      }
      const esperado = TIPO_EM_PORTUGUES[String(issue.expected)] ?? 'um valor válido';
      return { message: `Informe ${esperado}.` };
    }

    case z.ZodIssueCode.invalid_literal:
    case z.ZodIssueCode.invalid_union:
    case z.ZodIssueCode.invalid_intersection_types:
    case z.ZodIssueCode.invalid_arguments:
    case z.ZodIssueCode.invalid_return_type:
      return { message: 'Valor inválido.' };

    case z.ZodIssueCode.invalid_enum_value:
    case z.ZodIssueCode.invalid_union_discriminator:
      return { message: 'Escolha uma das opções da lista.' };

    case z.ZodIssueCode.unrecognized_keys:
      return { message: 'Há campos não reconhecidos neste formulário.' };

    case z.ZodIssueCode.invalid_date:
      return { message: 'Data inválida.' };

    case z.ZodIssueCode.invalid_string: {
      const v = issue.validation;
      if (v === 'email') return { message: 'E-mail inválido.' };
      if (v === 'url') return { message: 'Link inválido.' };
      if (v === 'uuid') return { message: 'Identificador inválido.' };
      if (v === 'datetime' || v === 'date' || v === 'time') {
        return { message: 'Data ou hora inválida.' };
      }
      return { message: 'Formato inválido.' };
    }

    case z.ZodIssueCode.too_small: {
      const minimo = Number(issue.minimum);
      if (issue.type === 'string') {
        // `min(1)` num texto é, na prática, "não pode ficar em branco".
        if (minimo <= 1) return { message: 'Campo obrigatório.' };
        return { message: `Use pelo menos ${caracteres(minimo)}.` };
      }
      if (issue.type === 'array') {
        if (minimo <= 1) return { message: 'Selecione ao menos uma opção.' };
        return { message: `Selecione pelo menos ${itens(minimo)}.` };
      }
      if (issue.type === 'date') {
        return { message: `A data não pode ser antes de ${dataLegivel(issue.minimum)}.` };
      }
      if (issue.exact) return { message: `Informe exatamente ${minimo}.` };
      if (issue.inclusive) return { message: `Informe um número a partir de ${minimo}.` };
      if (minimo === 0) return { message: 'Informe um número maior que zero.' };
      return { message: `Informe um número maior que ${minimo}.` };
    }

    case z.ZodIssueCode.too_big: {
      const maximo = Number(issue.maximum);
      if (issue.type === 'string') return { message: `Use no máximo ${caracteres(maximo)}.` };
      if (issue.type === 'array') return { message: `Selecione no máximo ${itens(maximo)}.` };
      if (issue.type === 'date') {
        return { message: `A data não pode ser depois de ${dataLegivel(issue.maximum)}.` };
      }
      if (issue.exact) return { message: `Informe exatamente ${maximo}.` };
      if (issue.inclusive) return { message: `Informe um número até ${maximo}.` };
      return { message: `Informe um número menor que ${maximo}.` };
    }

    case z.ZodIssueCode.not_multiple_of:
      return { message: `Informe um número múltiplo de ${Number(issue.multipleOf)}.` };

    case z.ZodIssueCode.not_finite:
      return { message: 'Informe um número válido.' };

    default:
      // Nunca devolvemos `ctx.defaultError`: ele é justamente o texto em inglês.
      return { message: 'Valor inválido.' };
  }
};

/**
 * Instala as mensagens em português no Zod. Idempotente e seguro de chamar de
 * novo — está exportado para quem precisar garantir a instalação num ponto de
 * entrada próprio (um script, um worker) sem depender do efeito de import.
 */
export function instalaMensagensPtBr(): void {
  z.setErrorMap(mapaDeErrosPtBr);
}

instalaMensagensPtBr();
