/**
 * ════════════════════════════════════════════════════════════════════════════
 * ESTADO DE UMA SEÇÃO DE DADOS — quando o app pode dizer "nenhum registro"
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O defeito que este módulo existe para impedir: o app AFIRMAR um fato que não
 * confirmou. "Alergias — Nenhuma registrada" só pode aparecer quando o servidor
 * de fato respondeu isso. Lista vazia por falha, por consulta ainda em curso ou
 * por consulta que nem chegou a sair vale como "não sei", nunca como "não tem".
 *
 * O caso difícil (e o que motivou este arquivo) é o TERCEIRO estado, que não
 * aparece nas flags do React Query: **ainda não sabemos de quem é o prontuário**.
 * Enquanto o `patientId` está vazio a consulta fica `enabled: false`, e aí
 * `isLoading` e `isError` são AMBOS `false` — as duas travas habituais são
 * contornadas ao mesmo tempo e a tela renderiza com tudo `undefined`. Por isso
 * `sujeitoConhecido` entra como pergunta separada, antes de qualquer flag.
 *
 * Regra de leitura: só `'confirmada'` autoriza uma afirmação de ausência.
 */

/** Em que pé está uma seção antes de ela poder afirmar qualquer coisa. */
export type EstadoSecao =
  /** Não sabemos DE QUEM é o prontuário — nada pode ser afirmado sobre ninguém. */
  | 'sujeito-indefinido'
  /** A consulta está em curso. */
  | 'carregando'
  /** A consulta falhou. Ausência aqui é ignorância, não ausência. */
  | 'falhou'
  /** O servidor respondeu. Vazio aqui significa vazio de verdade. */
  | 'confirmada';

export interface EntradaEstadoSecao {
  /**
   * Já sabemos de quem é o prontuário? (sessão resolvida e `patientId` real)
   * Falso enquanto a autenticação não terminou ou o perfil ativo não foi
   * definido — momento em que as consultas ficam desligadas e mentem silêncio.
   */
  sujeitoConhecido: boolean;
  /** `isSuccess` da consulta. */
  isSuccess: boolean;
  /** `isError` da consulta. */
  isError: boolean;
}

/**
 * Traduz o estado de uma consulta para o que a tela tem direito de dizer.
 *
 * A ordem importa: `sujeito-indefinido` vem ANTES das flags porque, com a
 * consulta desligada, elas descrevem um pedido que nunca foi feito.
 */
export function estadoSecao({
  sujeitoConhecido,
  isSuccess,
  isError,
}: EntradaEstadoSecao): EstadoSecao {
  if (!sujeitoConhecido) return 'sujeito-indefinido';
  if (isError) return 'falhou';
  if (isSuccess) return 'confirmada';
  return 'carregando';
}

/**
 * Única porta para "nenhum registro", "nenhuma alergia", "ninguém está vendo".
 * Toda tela que for negar a existência de algo passa por aqui.
 */
export function podeAfirmarAusencia(estado: EstadoSecao): boolean {
  return estado === 'confirmada';
}

/**
 * Estado de uma tela feita de várias seções (o painel, por exemplo).
 *
 * Prioridade: não saber de quem é > ainda carregando > alguma falhou > tudo
 * confirmado. "Carregando" vence "falhou" de propósito — enquanto houver
 * consulta em curso a tela ainda pode se recuperar sozinha, e um erro exibido
 * cedo demais vira ruído que a pessoa aprende a ignorar.
 *
 * Lista vazia devolve `'confirmada'`: nenhuma seção significa nada a negar.
 */
export function estadoAgregado(estados: readonly EstadoSecao[]): EstadoSecao {
  if (estados.includes('sujeito-indefinido')) return 'sujeito-indefinido';
  if (estados.includes('carregando')) return 'carregando';
  if (estados.includes('falhou')) return 'falhou';
  return 'confirmada';
}
