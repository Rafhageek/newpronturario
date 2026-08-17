/**
 * ════════════════════════════════════════════════════════════════════════════
 * OS SINÔNIMOS DO MENU NÃO PODEM VOLTAR A SER DADO MORTO — trava automatizada
 * ════════════════════════════════════════════════════════════════════════════
 *
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * O idealizador pediu "coloquem um campo de nutrição" com o Diário alimentar
 * pronto desde julho (tabela TACO, 597 alimentos). Ele digitou "nutrição" na
 * busca do topo, não veio nada, e concluiu que a tela não existia. O nome
 * oficial é do produto; o vocabulário é de quem usa.
 *
 * A correção teve DUAS metades, e por um tempo só a primeira existiu:
 *
 *   1. `nav.ts` ganhou `sinonimos` em todos os itens (sem acento, minúsculas).
 *   2. `app-search.tsx` passou a INCLUIR esse campo no texto pesquisável.
 *
 * Entre uma e outra, o campo viajou no bundle sem nenhum consumidor: escrito,
 * revisado, versionado — e inútil. Digitar "nutrição" continuava devolvendo
 * nada. É o pior tipo de defeito, porque o código parece resolvido.
 *
 * Este arquivo trava as duas metades: o FIO (a busca lê o campo) e o
 * VOCABULÁRIO (os termos que o cliente de fato digita continuam lá, no item
 * certo). Sem um deles, "nutrição" volta a não achar nada.
 *
 * POR QUE UM TESTE DE TEXTO, AQUI EM `core`
 *
 * `apps/web` não tem infraestrutura de teste unitário — zero arquivos
 * `*.test.*` em `src` (só Playwright e2e, que não roda em CI de unidade). Mover
 * `NAV` para cá para poder testá-lo arrastaria os ícones do lucide-react e a
 * tipagem de rota para dentro de um pacote sem React; o preço não vale o teste.
 * Ler os dois arquivos como TEXTO é o mesmo caminho já usado por
 * `regra-cor-clinica.test.ts` e `relatorio-veracidade.test.ts`.
 *
 * SE ELE TE ACORDOU
 *
 *  · Reescreveu a busca? Ótimo — só garanta que os sinônimos continuam entrando
 *    no texto que é comparado com o que a pessoa digitou.
 *  · Removeu um termo de `nav.ts`? Confira se não é um dos que o cliente usa.
 *    A lista `VOCABULARIO_DO_CLIENTE` aqui embaixo é curta de propósito: são
 *    termos observados, não um dicionário. Inflar sinônimo piora a busca.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const AQUI = dirname(fileURLToPath(import.meta.url));
/** packages/core/src/utils → raiz do monorepo. */
const RAIZ = resolve(AQUI, '..', '..', '..', '..');

const NAV_TS = 'apps/web/src/components/app/nav.ts';
const BUSCA_TSX = 'apps/web/src/components/app/app-search.tsx';

function ler(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), 'utf8');
}

/**
 * Linhas de comentário viram vazio. Sem isto o teste se enganaria duas vezes:
 * o cabeçalho de `nav.ts` cita `sinonimos` em prosa, e há itens de menu
 * COMENTADOS (Plano e Assinatura, ocultos pela migração 0043) que não estão no
 * ar e não podem contar como se estivessem.
 */
function semComentarios(fonte: string): string {
  return fonte
    .split(/\r?\n/)
    .map((linha) => {
      const t = linha.trimStart();
      return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('{/*')
        ? ''
        : linha;
    })
    .join('\n');
}

interface ItemLido {
  href: string;
  label: string;
  section: string;
  sinonimos: string[];
}

/** Lê os itens de `NAV` do texto de `nav.ts` — só as linhas que estão no ar. */
function itensDoMenu(): ItemLido[] {
  const fonte = semComentarios(ler(NAV_TS));
  const corpo = fonte.slice(fonte.indexOf('export const NAV'));
  const itens: ItemLido[] = [];

  for (const linha of corpo.split('\n')) {
    const cabeca = /\{\s*href:\s*'([^']+)',\s*label:\s*'([^']+)'/.exec(linha);
    if (!cabeca) continue;
    const secao = /section:\s*'([^']+)'/.exec(linha);
    const lista = /sinonimos:\s*\[([^\]]*)\]/.exec(linha);
    itens.push({
      href: cabeca[1] ?? '',
      label: cabeca[2] ?? '',
      section: secao?.[1] ?? '',
      sinonimos: [...(lista?.[1] ?? '').matchAll(/'([^']*)'/g)].map((m) => m[1] ?? ''),
    });
  }
  return itens;
}

/** Mesma normalização da busca: tira acento e caixa dos dois lados. */
const normalize = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** O texto pesquisável de um item, do jeito que `app-search.tsx` monta. */
function textoPesquisavel(item: ItemLido): string {
  return normalize(`${item.label} ${item.section} ${item.sinonimos.join(' ')}`);
}

function buscar(termo: string): ItemLido[] {
  const alvo = normalize(termo);
  return itensDoMenu().filter((item) => textoPesquisavel(item).includes(alvo));
}

/**
 * Termos observados de quem usa o app — não um dicionário. Cada um aponta para
 * a tela que a pessoa QUERIA quando digitou aquilo.
 */
const VOCABULARIO_DO_CLIENTE: [termo: string, href: string][] = [
  // O caso que originou tudo: o pedido veio com a tela pronta havia um mês.
  ['nutricao', '/diario-alimentar'],
  ['nutrição', '/diario-alimentar'],
  ['alimentacao', '/diario-alimentar'],
  ['dieta', '/diario-alimentar'],
  ['sodio', '/diario-alimentar'],
  ['sal', '/diario-alimentar'],
  ['exercicio', '/atividade-fisica'],
  ['caminhada', '/atividade-fisica'],
  ['atividade fisica', '/atividade-fisica'],
];

describe('busca do topo: o vocabulário de quem usa acha a tela', () => {
  it('a busca inclui os sinônimos no texto pesquisável (o campo tem consumidor)', () => {
    const fonte = semComentarios(ler(BUSCA_TSX));

    const iFiltro = fonte.indexOf('NAV.filter(');
    expect(iFiltro, `${BUSCA_TSX}: não achei o \`NAV.filter(\` da busca`).toBeGreaterThan(-1);
    const filtro = fonte.slice(iFiltro, fonte.indexOf('.slice(', iFiltro));

    expect(
      filtro.includes('sinonimos'),
      `${BUSCA_TSX}: o filtro casa só \`label\`/\`section\`. O campo \`sinonimos\` de ` +
        '`nav.ts` volta a ser dado morto: "nutrição" não acha o Diário alimentar, e os ' +
        'termos viajam no bundle sem efeito.',
    ).toBe(true);

    expect(
      filtro.includes('normalize('),
      `${BUSCA_TSX}: os sinônimos precisam passar pela mesma \`normalize\` do resto — ` +
        'sem isso "nutrição" (com til) não casa com "nutricao" (como está escrito em nav.ts).',
    ).toBe(true);

    // O campo é OPCIONAL: item sem sinônimo não pode quebrar a busca inteira.
    expect(
      /sinonimos\?\.|sinonimos\s*\?\?|\?\?\s*''|\?\?\s*\[\]/.test(filtro),
      `${BUSCA_TSX}: \`sinonimos\` é opcional (\`sinonimos?: string[]\`). Sem \`?.\`/\`??\`, ` +
        'um item sem sinônimo derruba a busca em tempo de execução.',
    ).toBe(true);
  });

  it('a normalização continua tirando acento — o cliente digita "nutrição", com til', () => {
    const fonte = ler(BUSCA_TSX);
    expect(fonte).toContain("normalize('NFD')");
    expect(fonte).toContain('[\\u0300-\\u036f]');
    expect(fonte).toContain('.toLowerCase()');
  });

  it('cada termo que o cliente usaria devolve a tela certa', () => {
    for (const [termo, href] of VOCABULARIO_DO_CLIENTE) {
      const encontrados = buscar(termo).map((item) => item.href);
      expect(
        encontrados,
        `"${termo}" não acha ${href}. Falta o termo em \`sinonimos\` daquele item em ` +
          `${NAV_TS} — escrito sem acento e em minúsculas.`,
      ).toContain(href);
    }
  });

  it('item sem sinônimo continua sendo achado pelo próprio nome', () => {
    // O `?? ''` da busca existe para isto: `sinonimos` é opcional de propósito
    // (telas de equipe não têm apelido). Elas não podem sumir da busca.
    const itens = itensDoMenu();
    expect(itens.length, `${NAV_TS}: não consegui ler nenhum item de NAV`).toBeGreaterThan(10);

    for (const item of itens) {
      expect(
        buscar(item.label).map((achado) => achado.href),
        `"${item.label}" não acha a própria tela (${item.href}).`,
      ).toContain(item.href);
    }
  });

  it('os sinônimos seguem sem acento e em minúsculas, como a busca espera', () => {
    for (const item of itensDoMenu()) {
      for (const termo of item.sinonimos) {
        expect(
          termo,
          `"${termo}" (${item.href}) tem acento ou maiúscula. A busca normaliza a pergunta, ` +
            'não o dicionário: escrito assim, ele nunca casa.',
        ).toBe(normalize(termo));
      }
    }
  });
});
