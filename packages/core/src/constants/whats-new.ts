/**
 * "Novidades desta versão" — conteúdo único para web e mobile.
 *
 * COMO USAR: subiu novidade que vale contar? Troque `WHATS_NEW_VERSION` e
 * reescreva os itens. O popup reaparece uma única vez por versão, porque o app
 * guarda a última versão vista. Mesma versão = ninguém vê de novo.
 *
 * REGRA DE CONTEÚDO: falar do que a PESSOA ganha, não do que nós fizemos.
 * "A tela de dor não te classifica mais por cor" é útil; "refatoramos o
 * componente de gráfico" não é. Sem número de versão no texto, sem jargão.
 */
export const WHATS_NEW_VERSION = '2026-07-26';

export interface WhatsNewItem {
  title: string;
  body: string;
}

export const WHATS_NEW_TITLE = 'O que mudou';

export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    title: 'O aplicativo está liberado',
    body: 'Todos os recursos estão abertos, sem plano e sem código para resgatar.',
  },
  {
    title: 'Você escolhe quem acessa seus dados',
    body:
      'Em Dados e privacidade, agora dá para autorizar setor por setor: pesquisa, '
      + 'farmácia, hospital e órgãos públicos. Cada item mostra o que sai e o que a lei permite. '
      + 'Nada é enviado automaticamente, e você desliga quando quiser.',
  },
  {
    title: 'Menu novo, mais fácil de acertar',
    body: 'O menu de baixo ficou com letra maior e área de toque mais larga.',
  },
  {
    title: 'Leitura mais confortável',
    body:
      'Texto e cores foram ajustados para quem tem baixa visão, com uma fonte que '
      + 'não confunde o 1 com o l nem o 0 com o O — importante na hora de ler uma dose.',
  },
  {
    title: 'Correções',
    body: 'Duas telas que fechavam o aplicativo sozinhas (Linha do tempo e Indicadores) foram corrigidas.',
  },
];

/** Chave de armazenamento local da última versão vista (web e mobile). */
export const WHATS_NEW_STORAGE_KEY = 'hubpatients.whats-new-seen';
