/**
 * ════════════════════════════════════════════════════════════════════════════
 * REGRA DE COR CLÍNICA — trava automatizada
 * ════════════════════════════════════════════════════════════════════════════
 *
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * A regra dura do produto está escrita em `packages/ui-tokens/src/index.ts`
 * (~linhas 66-75):
 *
 *   "vermelho e âmbar pertencem ao SISTEMA (remédio atrasado, erro de upload),
 *    NUNCA ao corpo do paciente. Valor de exame fora da faixa usa `neutro` +
 *    seta + 'acima do intervalo informado pelo laboratório' — nós não
 *    interpretamos resultado."
 *
 * Semáforo em dado do corpo (pressão, dor, peso, IMC, humor, TENDÊNCIA) é
 * diagnóstico disfarçado, e o HubPatients não diagnostica: exibe e organiza,
 * quem interpreta é o médico. Além disso o semáforo é hostil a quem tem
 * daltonismo, lê no sol ou imprime o prontuário (WCAG SC 1.4.1).
 *
 * A regra estava escrita, estava CUMPRIDA em `data/body-regions.ts` (a rampa
 * azul de um matiz da dor)… e estava VIOLADA em três telas, sem nenhum teste
 * segurando. Ela voltou a ser cumprida; este arquivo é o que impede a volta:
 *
 *   1. web  · dashboard/page.tsx  — `iconTone="rose"` fixo na Pressão arterial
 *      e nas Alergias, `"amber"` nas Condições, e
 *      `<StatusChip tone={bpStatus.zone}>` pintando a pressão de vermelho.
 *   2. web  · dashboard/metric-cards.tsx — o chip que traduzia aquele `tone`
 *      direto para as tintas de semáforo dos tokens.
 *   3. mobile · app/(tabs)/index.tsx — `ZONE_TONE` com `amber-100`/`rose-100`
 *      na pressão, e o `TrendIcon` pintando tendência que SOBE de vermelho e
 *      que CAI de verde ("tendência" é o caso citado na regra em letra).
 *
 * COMO ELE TRAVA
 *
 * Lê as telas como TEXTO e procura as formas concretas do erro (classe de
 * semáforo, tinta de semáforo, mapa de zona clínica → cor). É um teste de
 * guarda, não de unidade: um regex que pega o caso real vale mais que uma
 * análise de AST perfeita e frágil. Se ele te acordou:
 *
 *  · É dado do CORPO? Então a correção não é apagar a informação — é trocar o
 *    CANAL: tinta `neutro` + seta + o texto dizendo a posição em relação ao
 *    intervalo de referência. Modelos prontos no repositório:
 *      `apps/web/src/components/dashboard/clinical-range-chip.tsx`
 *      `apps/web/src/components/dashboard/trend-chip.tsx`
 *      `Trend` em `apps/web/src/components/dashboard/metric-cards.tsx`
 *      `apps/mobile/src/components/clinical-value.tsx`
 *  · É do SISTEMA (agenda, lembrete, upload, privacidade, alerta de segurança)?
 *    Então âmbar/vermelho são legítimos: ABRA uma região com um comentário
 *    `@cor-do-sistema` explicando o porquê, FECHE com `@fim-cor-do-sistema` no
 *    fim do bloco, e ajuste `EXCECOES_ESPERADAS` no mesmo commit — para uma
 *    exceção nova sempre passar por revisão humana em vez de entrar de carona.
 *
 *    A região é delimitada à mão, e não por uma janela de N linhas, porque a
 *    janela é traiçoeira: na primeira versão deste teste, o marcador do selo
 *    "Dados protegidos · LGPD" alcançava 20 linhas adiante e engolia em silêncio
 *    o `iconTone="rose"` do cartão de Pressão arterial — a violação nº 1 da
 *    lista. Delimitar dá trabalho uma vez; janela erra para sempre.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { painIntensityColor } from '../data/body-regions';

const AQUI = dirname(fileURLToPath(import.meta.url));
/** packages/core/src/utils → raiz do monorepo. */
const RAIZ = resolve(AQUI, '..', '..', '..', '..');

/** Telas que exibem dado do corpo do paciente e por isso entram na varredura. */
const ARQUIVOS_AVULSOS = [
  'apps/web/src/app/(app)/dashboard/page.tsx',
  'apps/mobile/app/(tabs)/index.tsx',
  /*
   * Diário alimentar (web e mobile). Entrou na varredura junto com o redesenho:
   * o mockup aprovado trazia anel e barras VERDES, e caloria é o pior caso da
   * regra — verde ali afirma "você está indo bem" sobre o que a pessoa comeu,
   * que é justamente o julgamento que o app não faz. O progresso passou a ser
   * comprimento + número num matiz só, e este teste é o que impede o verde de
   * voltar na próxima iteração do design.
   */
  'apps/web/src/app/(app)/diario-alimentar/page.tsx',
  'apps/mobile/app/diario-alimentar.tsx',
];

/** Pastas varridas por inteiro — arquivo novo aqui já nasce coberto. */
const PASTAS = [
  'apps/web/src/components/dashboard',
  'apps/web/src/components/diario-alimentar',
  'apps/mobile/src/components/diario-alimentar',
];

/** Abre uma região onde a cor pertence ao SISTEMA, com justificativa escrita. */
const ABRE = '@cor-do-sistema';
/** Fecha a região. Sem ele a região não existe — e o teste acusa. */
const FECHA = '@fim-cor-do-sistema';

/**
 * Quantas exceções de SISTEMA existem hoje, somando todos os arquivos varridos.
 * Mexer neste número é o pedágio consciente para abrir uma exceção nova.
 * Hoje: badge "Dados protegidos · LGPD" e o card de constância (web); status do
 * dia, aviso de alergia grave e o cartão de agenda "Próxima consulta" (mobile).
 */
const EXCECOES_ESPERADAS = 5;

interface Regra {
  nome: string;
  padrao: RegExp;
  /** `false` = nem com marcador passa: é a forma exata do bug original. */
  dispensavel: boolean;
  conserto: string;
}

const REGRAS: Regra[] = [
  {
    nome: 'classe Tailwind de semáforo',
    padrao:
      /(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|shadow|decoration|placeholder|caret|accent)-(?:red|rose|orange|amber|yellow|green|emerald|lime)-\d{2,3}\b/,
    dispensavel: true,
    conserto: 'use a tinta `neutro` (ou a paleta neutra-clínica dos gráficos) + seta + texto',
  },
  {
    nome: 'tinta de semáforo dos tokens',
    padrao:
      /(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:status-(?:alert|attention|ok)-(?:ink|mark|tint)|semaphore(?:-mark|-tint)?-(?:ok|attention|alert))\b/,
    dispensavel: true,
    conserto: 'troque por `status-neutro-*`, que é a rampa reservada a dado do corpo',
  },
  {
    nome: 'cor de semáforo da paleta JS (mobile)',
    padrao: /\bcolors\.(?:alert|attention|ok)\b/,
    dispensavel: true,
    conserto: 'use `colors.primary`/`colors.muted` ou `status[tema].neutro`',
  },
  {
    nome: 'mapa de zona clínica → cor',
    padrao: /\bZONE_(?:TONE|TONES|COLOR|COLORS|TINT|TINTS|STYLE|STYLES|BG)\b/,
    dispensavel: false,
    conserto:
      'um mapa zona→cor É o semáforo. Mapeie a zona para TEXTO e SETA (ver `ZONE_READING` em app/(tabs)/index.tsx)',
  },
  {
    nome: 'zona clínica entrando em prop de cor',
    padrao: /(?:^|[^\w-])(?:iconTone|tone|accent|color|fill|stroke)=\{[^}]*\bzone\b/,
    dispensavel: false,
    conserto:
      'a faixa de referência não escolhe cor. Use <ClinicalRangeChip zone={…}> (web) ou o chip `neutro` do mobile',
  },
  {
    nome: 'tinta de semáforo em prop decorativa de ícone',
    padrao:
      /(?:^|[^\w-])(?:iconTone|accent)="(?:rose|red|orange|amber|yellow|green|emerald|alert|attention|danger|warning)"/,
    dispensavel: true,
    conserto:
      'o ícone identifica a CATEGORIA do cartão, não a gravidade do valor — nenhum cartão pode nascer "grave"',
  },
];

/** Linhas de comentário viram vazio: documentação pode citar o erro pelo nome. */
function apagarComentarios(linhas: string[]): string[] {
  return linhas.map((linha) => {
    const t = linha.trimStart();
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('{/*')) {
      return '';
    }
    return linha;
  });
}

function arquivosVarridos(): string[] {
  const lista = [...ARQUIVOS_AVULSOS];
  for (const pasta of PASTAS) {
    const absoluto = join(RAIZ, pasta);
    // Uma pasta que sumiu significa refatoração — quem refatorou atualiza aqui.
    expect(existsSync(absoluto), `pasta varrida não existe mais: ${pasta}`).toBe(true);
    for (const nome of readdirSync(absoluto)) {
      if (nome.endsWith('.tsx') || nome.endsWith('.ts')) lista.push(`${pasta}/${nome}`);
    }
  }
  return lista;
}

interface Violacao {
  arquivo: string;
  linha: number;
  regra: string;
  conserto: string;
  trecho: string;
}

/**
 * Marca, linha a linha, se ela está dentro de uma região `@cor-do-sistema`.
 * Região aberta e não fechada é erro: seria uma exceção de alcance infinito.
 */
function regioesDeSistema(cruas: string[], arquivo: string): boolean[] {
  const dentro: boolean[] = [];
  let aberta = false;

  for (const linha of cruas) {
    const abre = linha.includes(ABRE) && !linha.includes(FECHA);
    if (abre) aberta = true;
    dentro.push(aberta);
    if (linha.includes(FECHA)) aberta = false;
  }

  expect(aberta, `região \`${ABRE}\` aberta e nunca fechada em ${arquivo}`).toBe(false);
  return dentro;
}

function varrer(): { violacoes: Violacao[]; excecoes: number } {
  const violacoes: Violacao[] = [];
  let excecoes = 0;

  for (const relativo of arquivosVarridos()) {
    const absoluto = join(RAIZ, relativo);
    // Renomear a tela não pode desligar a trava em silêncio.
    expect(existsSync(absoluto), `arquivo varrido não existe mais: ${relativo}`).toBe(true);

    const cruas = readFileSync(absoluto, 'utf8').split(/\r?\n/);
    const codigo = apagarComentarios(cruas);
    const dentroDeRegiao = regioesDeSistema(cruas, relativo);
    excecoes += cruas.filter((linha) => linha.includes(ABRE) && !linha.includes(FECHA)).length;

    for (let i = 0; i < codigo.length; i += 1) {
      const linha = codigo[i] ?? '';
      if (linha.trim() === '') continue;

      for (const regra of REGRAS) {
        if (!regra.padrao.test(linha)) continue;
        if (regra.dispensavel && dentroDeRegiao[i]) continue;

        violacoes.push({
          arquivo: relativo,
          linha: i + 1,
          regra: regra.nome,
          conserto: regra.conserto,
          trecho: linha.trim().slice(0, 110),
        });
      }
    }
  }

  return { violacoes, excecoes };
}

describe('regra de cor clínica: semáforo nunca no corpo do paciente', () => {
  it('nenhuma tela pinta dado do corpo com vermelho, âmbar ou verde', () => {
    const { violacoes } = varrer();

    const relatorio = violacoes
      .map(
        (v) =>
          `\n  ${v.arquivo}:${v.linha}\n    ${v.regra} → ${v.trecho}\n    conserto: ${v.conserto}`,
      )
      .join('');

    expect(
      violacoes,
      'Semáforo em dado do corpo do paciente é diagnóstico disfarçado, e o app não ' +
        'diagnostica. Se o caso for de SISTEMA (agenda, upload, lembrete, segurança), ' +
        `abra a região com \`${ABRE}\`, feche com \`${FECHA}\` e ajuste ` +
        `EXCECOES_ESPERADAS.${relatorio}\n`,
    ).toEqual([]);
  });

  it('as exceções de sistema continuam sendo as declaradas — nenhuma entrou de carona', () => {
    const { excecoes } = varrer();
    expect(
      excecoes,
      `Apareceu (ou sumiu) uma região \`${ABRE}\`. Toda exceção passa por revisão ` +
        'humana: confirme que o bloco é mesmo do SISTEMA e atualize EXCECOES_ESPERADAS.',
    ).toBe(EXCECOES_ESPERADAS);
  });
});

describe('regra de cor clínica: o lado que já estava certo não pode regredir', () => {
  it('a intensidade de dor continua numa rampa de UM matiz (azul), sem virar semáforo', () => {
    for (let intensidade = 0; intensidade <= 10; intensidade += 1) {
      const hex = painIntensityColor(intensidade);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);

      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);

      // Azul sempre manda, e o vermelho nunca passa na frente do verde: é o que
      // caracteriza a rampa de um matiz só. Um "10 = vermelho" quebraria aqui.
      expect(b, `intensidade ${intensidade} (${hex}) deixou de ser azul`).toBeGreaterThanOrEqual(g);
      expect(g, `intensidade ${intensidade} (${hex}) puxou para o quente`).toBeGreaterThanOrEqual(r);
    }
  });

  it('a seta de tendência da web segue neutra (a direção está na FORMA, não na cor)', () => {
    const trend = readFileSync(
      join(RAIZ, 'apps/web/src/components/dashboard/metric-cards.tsx'),
      'utf8',
    );
    expect(trend).toContain('text-status-neutro-ink');
  });

  it('a regra continua escrita nos tokens (é ela que este teste faz valer)', () => {
    const tokens = readFileSync(join(RAIZ, 'packages/ui-tokens/src/index.ts'), 'utf8');
    expect(tokens).toContain('vermelho e âmbar pertencem ao SISTEMA');
    expect(tokens).toContain('NUNCA ao corpo do paciente');
  });
});
