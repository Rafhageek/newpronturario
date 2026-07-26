/**
 * Logger do app — desenhado para NUNCA carregar PHI.
 *
 * Regra do projeto: nenhum `catch` relevante fica silencioso; todo erro passa
 * por aqui. Só que "registrar o erro" num app de saúde não pode significar
 * despejar a resposta do Supabase no log: no Android o `console.*` vai para o
 * logcat, legível por `adb` e por qualquer SDK de crash — ou seja, um log
 * descuidado é vazamento de dado sensível (LGPD art. 11).
 *
 * Três camadas de defesa:
 *   1. ALLOWLIST de campos — só passa id, código, contador, status e afins.
 *      Chave fora da lista é descartada (contabilizada em `campos_omitidos`).
 *   2. SCRUBBER de valores — redige CPF, CNS, e-mail, telefone, token/JWT,
 *      querystring e sequências longas de dígitos; trunca strings compridas.
 *      Objetos e arrays NUNCA são serializados (resposta inteira nunca vaza).
 *   3. PRODUÇÃO SILENCIOSA — `console.*` é neutralizado no build de produção e
 *      o erro sai como mensagem genérica + id de correlação, que é o que o
 *      usuário pode informar no suporte sem revelar nada clínico.
 *
 * A API pública (`logger.error` / `logger.warn`) é a mesma de antes; ambas
 * agora devolvem o id de correlação, útil para exibir na tela de erro.
 */

export type LogContext = Record<string, unknown>;

/**
 * `__DEV__` é injetado pelo Metro. O `typeof` protege ambientes que carregam
 * este módulo fora do bundler (jest sem preset, script de node) — nesses casos
 * assume-se desenvolvimento, que é o modo verboso e nunca o modo silencioso.
 */
const DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

const PREFIXO = '[HubPatients]';
const MAX_MENSAGEM = 200;
const MAX_VALOR = 120;
const MAX_STACK = 300;
const MAX_LINHAS_STACK = 3;
const MAX_CAMPOS = 12;

/**
 * Campos permitidos: identificadores, códigos, contadores e nomes de evento.
 * Nada que carregue texto livre do usuário (nota, sintoma, descrição, nome,
 * endereço) entra aqui. Para adicionar um campo, pergunte antes: "se isso
 * aparecer inteiro no logcat de um aparelho perdido, alguém se identifica?".
 */
const CAMPOS_PERMITIDOS = new Set([
  'action',
  'attempt',
  'code',
  'count',
  'duration',
  'durationMs',
  'error',
  'event',
  'kind',
  'method',
  'platform',
  'prefix',
  'reason',
  'route',
  'scope',
  'scopes',
  'screen',
  'source',
  'stack',
  'status',
  'statusCode',
  'table',
  'total',
  'type',
  'version',
]);

/** Aceita também qualquer identificador: `id`, `medicationId`, `exam_id`… */
const CHAVE_DE_ID = /(^id$|Id$|_id$|Ids$|_ids$)/;

const chavePermitida = (chave: string): boolean =>
  CAMPOS_PERMITIDOS.has(chave) || CHAVE_DE_ID.test(chave);

/**
 * UUID é identificador legítimo e precisa sobreviver ao scrubber (senão o
 * regex de telefone o despedaça). Ele é retirado antes e devolvido depois.
 */
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Ordem importa: do padrão mais específico para o mais genérico. */
const PADROES: Array<readonly [RegExp, string]> = [
  // JWT (access token do Supabase) e segredos nomeados.
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, '[token]'],
  [
    /\b(bearer|token|apikey|api_key|access_token|refresh_token|password|senha)\b["'\s:=]+[A-Za-z0-9._-]{6,}/gi,
    '$1 [redigido]',
  ],
  // E-mail.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  // Cartão Nacional de Saúde (15 dígitos) antes do CPF (11), para não colidir.
  [/\b\d{15}\b/g, '[cns]'],
  // CPF com ou sem máscara.
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf]'],
  // Telefone brasileiro (fixo ou celular, com ou sem DDI/DDD/máscara).
  [/(\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g, '[telefone]'],
  // Qualquer outra sequência longa de dígitos (CEP+, cartão, prontuário…).
  [/\b\d{7,}\b/g, '[numero]'],
  // Valor de querystring (URL assinada de exame, filtro do PostgREST…).
  [/([?&][A-Za-z0-9_-]+=)[^&\s]+/g, '$1[redigido]'],
];

/** Redige PII/PHI de uma string. Exportada para poder ser testada. */
export function scrubTexto(valor: string): string {
  const uuids: string[] = [];
  let texto = valor.replace(UUID, (achado) => {
    uuids.push(achado);
    return `«uuid${uuids.length - 1}»`;
  });

  for (const [padrao, substituto] of PADROES) {
    texto = texto.replace(padrao, substituto);
  }

  return texto.replace(/«uuid(\d+)»/g, (_todo, indice: string) => uuids[Number(indice)] ?? '[uuid]');
}

const truncar = (texto: string, limite: number): string =>
  texto.length > limite ? `${texto.slice(0, limite)}…[truncado]` : texto;

const scrub = (valor: string, limite: number): string => truncar(scrubTexto(valor), limite);

/** Stack só interessa pelos primeiros quadros; o resto é ruído (e risco). */
function scrubStack(valor: string): string {
  const linhas = valor.split('\n').slice(0, MAX_LINHAS_STACK).map((l) => l.trim());
  return scrub(linhas.join(' | '), MAX_STACK);
}

/**
 * Converte um valor arbitrário no que pode ir para o log.
 * Objetos e arrays viram um marcador: resposta de API nunca é serializada.
 */
function valorSeguro(chave: string, valor: unknown): string | number | boolean | undefined {
  if (valor === null || valor === undefined) return undefined;

  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'bigint') return valor.toString();

  if (valor instanceof Error) {
    return scrub(`${valor.name}: ${valor.message}`, MAX_VALOR);
  }

  if (typeof valor === 'string') {
    return chave === 'stack' ? scrubStack(valor) : scrub(valor, MAX_VALOR);
  }

  // Function, Symbol, objeto, array: nunca vão inteiros para o log.
  return '[objeto omitido]';
}

/** Aplica allowlist + scrubber. Exportada para poder ser testada. */
export function scrubContexto(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;

  const seguro: LogContext = {};
  let omitidos = 0;
  let usados = 0;

  for (const chave of Object.keys(context)) {
    if (!chavePermitida(chave) || usados >= MAX_CAMPOS) {
      omitidos += 1;
      continue;
    }
    const valor = valorSeguro(chave, context[chave]);
    if (valor === undefined) continue;
    seguro[chave] = valor;
    usados += 1;
  }

  if (omitidos > 0) seguro.campos_omitidos = omitidos;
  return Object.keys(seguro).length > 0 ? seguro : undefined;
}

/**
 * Id curto para correlacionar o que o usuário vê na tela com o registro no
 * monitoramento. Não é segredo e não deriva de nenhum dado pessoal.
 */
const novoIdCorrelacao = (): string =>
  `hp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Referências capturadas ANTES de neutralizar o console global, para que o
// próprio logger continue conseguindo escrever a linha genérica em produção.
const consoleErroOriginal = console.error.bind(console);
const consoleAvisoOriginal = console.warn.bind(console);

let consoleNeutralizado = false;

/**
 * Neutraliza `console.*` no build de produção. Um `console.log` esquecido em
 * qualquer arquivo (ou dentro de uma dependência) é um vazamento em potencial:
 * aqui ele vira no-op. `console.error` sobrevive, mas só com mensagem genérica
 * e id de correlação — o conteúdo original é descartado.
 */
export function neutralizarConsoleEmProducao(): void {
  if (DEV || consoleNeutralizado) return;
  consoleNeutralizado = true;

  const alvo = console as unknown as Record<string, (...args: unknown[]) => void>;
  const mudos = ['log', 'info', 'debug', 'trace', 'warn', 'dir', 'table', 'group', 'groupEnd'];
  const semRuido = () => undefined;

  for (const metodo of mudos) {
    if (typeof alvo[metodo] === 'function') alvo[metodo] = semRuido;
  }

  alvo.error = () => {
    consoleErroOriginal(`${PREFIXO} Erro inesperado. id=${novoIdCorrelacao()}`);
  };
}

neutralizarConsoleEmProducao();

/**
 * Ponto único de envio ao serviço de observabilidade (Sentry — Q1b).
 * Recebe SEMPRE o payload já filtrado pela allowlist e pelo scrubber.
 */
function enviarAoMonitoramento(
  _nivel: 'error' | 'warn',
  _mensagem: string,
  _contexto: LogContext | undefined,
  _idCorrelacao: string,
): void {
  // TODO (Q1b): Sentry.captureMessage(mensagem, { level, extra: contexto, tags: { idCorrelacao } })
  // O `beforeSend` do Sentry deve reaplicar scrubContexto() como segunda barreira.
}

export const logger = {
  /** Registra um erro. Devolve o id de correlação para exibir ao usuário. */
  error(message: string, context?: LogContext): string {
    const idCorrelacao = novoIdCorrelacao();
    const mensagem = scrub(message, MAX_MENSAGEM);
    const contexto = scrubContexto(context);

    if (DEV) {
      consoleErroOriginal(PREFIXO, mensagem, { idCorrelacao, ...(contexto ?? {}) });
    } else {
      // Produção: nada de mensagem específica no console do aparelho.
      consoleErroOriginal(`${PREFIXO} Erro inesperado. id=${idCorrelacao}`);
    }

    enviarAoMonitoramento('error', mensagem, contexto, idCorrelacao);
    return idCorrelacao;
  },

  /** Registra um aviso. Em produção não imprime nada no console. */
  warn(message: string, context?: LogContext): string {
    const idCorrelacao = novoIdCorrelacao();
    const mensagem = scrub(message, MAX_MENSAGEM);
    const contexto = scrubContexto(context);

    if (DEV) {
      consoleAvisoOriginal(PREFIXO, mensagem, { idCorrelacao, ...(contexto ?? {}) });
    }

    enviarAoMonitoramento('warn', mensagem, contexto, idCorrelacao);
    return idCorrelacao;
  },
};
