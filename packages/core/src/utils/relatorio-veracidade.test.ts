/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONSULTA QUE FALHA NUNCA VIRA "NENHUM REGISTRO" — trava automatizada
 * ════════════════════════════════════════════════════════════════════════════
 *
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * `(dados?.data ?? [])` transforma o `null` de uma consulta que FALHOU em lista
 * vazia. Uma linha adiante, lista vazia vira a frase "Nenhuma alergia
 * registrada." — que ninguém lê como "a consulta não respondeu". Lê-se como
 * fato clínico, e quem lê pode estar prescrevendo.
 *
 * O mesmo defeito já apareceu em TRÊS superfícies diferentes, uma de cada vez:
 *
 *   1. QR de emergência (lido por socorrista) — dizia "Alergias graves: nenhuma".
 *   2. PDF do prontuário no mobile — seção que não carregou imprimia "Nenhuma…".
 *   3. Relatório A4 da Edge Function `clinical-report` — o mesmo, no papel que
 *      o paciente leva à consulta.
 *
 * Os dois primeiros foram corrigidos e ninguém travou nada; por isso o terceiro
 * passou batido. Este arquivo é a trava.
 *
 * POR QUE UM TESTE DE TEXTO
 *
 * `supabase/functions/**` é Deno e NÃO tem nenhuma cobertura no monorepo: não
 * entra no `pnpm typecheck` (não é workspace), não entra no `eslint`, não tem
 * suíte própria, e não dá para importar aqui (o módulo faz `Deno.env.get(...)!`
 * e `Deno.serve` no escopo do módulo). Ler o arquivo como TEXTO é a única
 * cobertura possível desta camada — e é o mesmo caminho já usado por
 * `regra-cor-clinica.test.ts`.
 *
 * SE ELE TE ACORDOU
 *
 *  · Seção CRÍTICA (alergias, medicamentos)? A resposta não é avisar: é não
 *    gerar o relatório. Levante um erro e deixe o handler responder 503.
 *  · Seção comum (vitais, exames, diário, perfil)? O relatório sai, e a seção
 *    que falhou IMPRIME que não carregou — nunca "nenhum registro".
 *  · Precisa de texto novo para "não carregou"? Não precisa. A frase é uma só
 *    no app inteiro, e este teste exige que continue sendo.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const AQUI = dirname(fileURLToPath(import.meta.url));
/** packages/core/src/utils → raiz do monorepo. */
const RAIZ = resolve(AQUI, '..', '..', '..', '..');

const RELATORIO = 'supabase/functions/clinical-report/index.ts';
const PERFIL_MOBILE = 'apps/mobile/app/(tabs)/perfil.tsx';
const ALERGIAS_WEB = 'apps/web/src/components/profile/allergies-section.tsx';
const CONDICOES_WEB = 'apps/web/src/components/profile/conditions-section.tsx';
const FAMILIA_MOBILE = 'apps/mobile/app/familia.tsx';

function ler(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), 'utf8');
}

/**
 * Linhas de comentário viram vazio. Sem isto o teste se acusaria sozinho: os
 * comentários deste repositório citam o erro pelo nome para explicá-lo.
 */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .map((linha) => {
      const t = linha.trimStart();
      return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('{/*')
        ? ''
        : linha;
    })
    .join('\n');
}

/** Frase única do app para "esta seção não carregou". Uma só, em todo lugar. */
const NAO_CARREGOU =
  'Não foi possível carregar esta seção. O prontuário pode ter registros que não aparecem aqui.';

describe('Relatório clínico — o papel não afirma o que não confirmou', () => {
  it('alergias e medicamentos são fail-closed: consulta que falha impede o relatório', () => {
    const fonte = ler(RELATORIO);

    // Recorte: do FECHAMENTO do Promise.all até o `return` de `loadReportData`.
    // Começar depois do fechamento é essencial — a própria desestruturação cita
    // `allergies` e `medications`, e incluí-la faria o teste passar mesmo com a
    // conferência de erro apagada.
    const iPromise = fonte.indexOf('await Promise.all([');
    expect(iPromise, `${RELATORIO}: não achei o Promise.all das consultas`).toBeGreaterThan(-1);
    const iFecha = fonte.indexOf(']);', iPromise);
    const iRetorno = fonte.indexOf('\n  return {', iFecha);
    expect(iRetorno, `${RELATORIO}: não achei o return de loadReportData`).toBeGreaterThan(-1);

    const conferencia = semComentarios(fonte.slice(iFecha + 3, iRetorno));

    for (const critica of ['allergies', 'medications']) {
      expect(
        new RegExp(`\\b${critica}\\b`).test(conferencia),
        `${RELATORIO}: nada confere o erro de \`${critica}\` antes de montar o relatório. ` +
          'Sem isso, uma consulta que falhou imprime "Nenhuma alergia registrada." no papel ' +
          'que vai para a mão de quem prescreve.',
      ).toBe(true);
    }

    expect(
      /throw new Report\w*Error\(/.test(conferencia),
      `${RELATORIO}: a conferência existe mas não INTERROMPE. Fail-closed significa não ` +
        'gerar relatório nenhum — nenhum papel é melhor que um papel que mente.',
    ).toBe(true);
  });

  it('vitais, exames, diário e perfil marcam o que realmente respondeu', () => {
    const fonte = ler(RELATORIO);

    // O bloco `loaded` do retorno precisa nascer do `.error` de cada consulta —
    // e não de "tem dado?", que é justamente a confusão que originou o defeito.
    //
    // Ancorar no Promise.all, e não no primeiro `return {` do arquivo: aquele é
    // o de `htmlHeaders`, e a busca caía na DECLARAÇÃO de `loaded` na interface
    // (onde não há `.error` nenhum) em vez de no retorno de `loadReportData`.
    const iPromise = fonte.indexOf('await Promise.all([');
    expect(iPromise, `${RELATORIO}: não achei o Promise.all das consultas`).toBeGreaterThan(-1);
    const iLoaded = fonte.indexOf('loaded: {', iPromise);
    expect(iLoaded, `${RELATORIO}: o retorno não declara \`loaded\``).toBeGreaterThan(-1);
    const bloco = fonte.slice(iLoaded, fonte.indexOf('},', iLoaded));

    for (const consulta of ['vitals', 'exams', 'diary', 'profile']) {
      expect(
        new RegExp(`\\b${consulta}\\b[^\\n]*\\.error`).test(bloco),
        `${RELATORIO}: \`loaded.${consulta}\` não vem do \`.error\` da consulta.`,
      ).toBe(true);
    }

    // E cada seção afetada tem de CONSULTAR esse sinal na hora de renderizar.
    const corpo = semComentarios(fonte);
    for (const secao of ['vitals', 'exams', 'diary', 'profile']) {
      expect(
        corpo.includes(`data.loaded.${secao}`),
        `${RELATORIO}: a seção "${secao}" ignora \`loaded\` e vai imprimir "nenhum registro" ` +
          'mesmo quando a consulta falhar.',
      ).toBe(true);
    }
  });

  it('a frase de "não carregou" é a mesma em todo documento e tela', () => {
    // Duas redações para a mesma situação fazem o paciente achar que são
    // problemas diferentes. Os quatro arquivos abaixo mostram esse aviso.
    for (const arquivo of [RELATORIO, PERFIL_MOBILE, ALERGIAS_WEB, CONDICOES_WEB]) {
      expect(
        ler(arquivo).includes(NAO_CARREGOU),
        `${arquivo}: o aviso de seção que não carregou saiu da redação combinada. ` +
          `Use exatamente: "${NAO_CARREGOU}"`,
      ).toBe(true);
    }
  });

  it('as telas de edição da web só afirmam "nenhuma" quando a consulta respondeu', () => {
    // `isSuccess`, e não "não está carregando": consulta desabilitada ou que
    // falhou também devolve vazio.
    const casos: [string, string][] = [
      [ALERGIAS_WEB, 'Nenhuma alergia registrada.'],
      [CONDICOES_WEB, 'Nenhuma condição registrada.'],
    ];
    for (const [arquivo, frase] of casos) {
      const fonte = semComentarios(ler(arquivo));
      const padrao = new RegExp(`isSuccess\\s*\\?\\s*\\(\\s*<p[^>]*>\\s*${frase.replace('.', '\\.')}`);
      expect(
        padrao.test(fonte),
        `${arquivo}: "${frase}" não está atrás de \`isSuccess\` — a tela afirma ausência ` +
          'de registro sem ter recebido resposta do banco.',
      ).toBe(true);
    }
  });

  it('a prévia do Guardião de Dose não inventa um remédio que a pessoa talvez não tome', () => {
    // A tela mostrava "Losartana" (um anti-hipertensivo) e "08:00" fixos quando
    // nenhum remédio estava marcado como crítico.
    const fonte = semComentarios(ler(FAMILIA_MOBILE));
    expect(
      /Losartana/i.test(fonte),
      `${FAMILIA_MOBILE}: nome de medicamento fixo na prévia do aviso. Use o remédio que a ` +
        'pessoa marcou, ou um texto neutro quando não houver nenhum.',
    ).toBe(false);
  });
});
