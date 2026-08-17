/**
 * PRIMEIRA LINHA de propósito: instala as mensagens de validação em português
 * antes de qualquer coisa. É por aqui que todo consumidor entra (`@hubpatients/core`
 * → `src/index.ts` → `./schemas`), então nenhum `safeParse` do app acontece sem
 * o mapa instalado. Ver `erros-pt-br.ts`.
 */
export * from './erros-pt-br';
export * from './data-opcional';
export * from './numero-opcional';
export * from './auth';
export * from './vitals';
export * from './medication';
export * from './diary';
export * from './profile';
export * from './clinical';
export * from './exam';
export * from './settings';
export * from './family';
export * from './social';
export * from './pregnancy';
export * from './child';
export * from './cycle';
export * from './pain';
export * from './activity';
