/**
 * Busca nos códigos clínicos embarcados: LOINC (exames) e CID-10 (diagnósticos).
 *
 * Mesma mecânica da nutrição: índice normalizado sob demanda, sem acento, sem
 * caixa, exige todas as palavras e prioriza prefixo. Zero rede em runtime.
 *
 * ⚠️ Rotular ≠ diagnosticar. Estas funções ajudam a ORGANIZAR o que já está no
 * laudo ou no atestado do paciente. Não interpretam resultado, não sugerem
 * diagnóstico e não servem para faturamento. Procedência, licença e limites de
 * cada base: ver `../data/loinc-br.ts` e `../data/cid10-br.ts`.
 */

import {
  CID10_CATEGORIES,
  CID10_CHAPTERS,
  CID10_CHECKED_AT,
  CID10_SOURCE_URL,
  type Cid10Category,
  type Cid10Chapter,
} from '../data/cid10-br';
import {
  CID10_SINONIMOS,
  CID10_SINONIMOS_RECUSADOS,
  type Cid10Sinonimo,
} from '../data/cid10-sinonimos';
import {
  LOINC_ATTRIBUTION,
  LOINC_CATEGORY_LABELS,
  LOINC_CHECKED_AT,
  LOINC_EXAMS,
  LOINC_SOURCE_URL,
  LOINC_VERIFICATION_URL,
  type LoincCategory,
  type LoincExam,
} from '../data/loinc-br';

export {
  CID10_CATEGORIES,
  CID10_CHAPTERS,
  CID10_CHECKED_AT,
  CID10_SINONIMOS,
  CID10_SINONIMOS_RECUSADOS,
  CID10_SOURCE_URL,
  LOINC_ATTRIBUTION,
  LOINC_CATEGORY_LABELS,
  LOINC_CHECKED_AT,
  LOINC_EXAMS,
  LOINC_SOURCE_URL,
  LOINC_VERIFICATION_URL,
};
export type { Cid10Category, Cid10Chapter, Cid10Sinonimo, LoincCategory, LoincExam };

// Marcas diacríticas combinantes (acentos), removidas após normalize('NFD').
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Normaliza para busca: sem acento, minúsculo, símbolo vira espaço. */
export function normalizeClinicalText(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Normaliza um código para comparação: sem espaço, sem pontuação supérflua,
 * maiúsculo. Aceita "i10", "I 10", "i-10" → "I10"; "4548 4" → "4548-4".
 *
 * O hífen do LOINC é preservado porque faz parte do código (é o dígito
 * verificador). Já o ponto do CID-10 marca subcategoria de 4 dígitos, que esta
 * base não tem — quem trata isso é `findCid10ByCode`.
 */
function normalizeCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/* ───────────────────────────────── LOINC ───────────────────────────────── */

interface IndexedLoinc {
  exam: LoincExam;
  haystack: string;
  starts: string[];
}

let LOINC_INDEX: IndexedLoinc[] | null = null;
function loincIndex(): IndexedLoinc[] {
  if (!LOINC_INDEX) {
    LOINC_INDEX = LOINC_EXAMS.map((exam) => {
      const name = normalizeClinicalText(exam.name_pt);
      const extra = (exam.terms ?? []).map(normalizeClinicalText).filter((t) => t.length > 0);
      const code = normalizeClinicalText(exam.code);
      return {
        exam,
        starts: [name, ...extra],
        haystack: [name, ...extra, code].join(' '),
      };
    });
  }
  return LOINC_INDEX;
}

let LOINC_BY_CODE: Map<string, LoincExam> | null = null;
function loincByCode(): Map<string, LoincExam> {
  if (!LOINC_BY_CODE) {
    LOINC_BY_CODE = new Map(LOINC_EXAMS.map((e) => [normalizeCode(e.code), e]));
  }
  return LOINC_BY_CODE;
}

/**
 * Busca exames LOINC por nome, sigla ou código.
 *
 * Sem acento, sem caixa, exige todas as palavras. "hb1ac" não acha nada, mas
 * "hba1c", "glicada" e "4548-4" acham a hemoglobina glicada.
 */
export function searchLoinc(query: string, limit = 30): LoincExam[] {
  const q = normalizeClinicalText(query);
  if (!q) return [];
  const terms = q.split(' ').filter(Boolean);
  const matches: IndexedLoinc[] = [];
  for (const item of loincIndex()) {
    if (terms.every((t) => item.haystack.includes(t))) matches.push(item);
  }
  matches.sort((a, b) => {
    const sa = a.starts.some((s) => s.startsWith(q)) ? 0 : 1;
    const sb = b.starts.some((s) => s.startsWith(q)) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const la = a.exam.name_pt.length;
    const lb = b.exam.name_pt.length;
    if (la !== lb) return la - lb;
    return a.exam.name_pt < b.exam.name_pt ? -1 : 1;
  });
  return matches.slice(0, limit).map((m) => m.exam);
}

/** Exame pelo código LOINC exato. Tolera espaços e caixa ("4548-4", " 4548-4 "). */
export function findLoincByCode(code: string): LoincExam | null {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return loincByCode().get(normalized) ?? null;
}

/** Exames de uma categoria, na ordem em que estão na base. */
export function loincByCategory(category: LoincCategory): LoincExam[] {
  return LOINC_EXAMS.filter((e) => e.category === category);
}

/* ───────────────────────────────── CID-10 ──────────────────────────────── */

interface IndexedCid10 {
  category: Cid10Category;
  haystack: string;
  description: string;
  /** Código + palavras da descrição, para casar por INÍCIO de palavra. */
  words: string[];
}

let CID10_INDEX: IndexedCid10[] | null = null;
function cid10Index(): IndexedCid10[] {
  if (!CID10_INDEX) {
    CID10_INDEX = CID10_CATEGORIES.map((category) => {
      const description = normalizeClinicalText(category.description_pt);
      const haystack = `${normalizeClinicalText(category.code)} ${description}`;
      return {
        category,
        description,
        haystack,
        words: haystack.split(' ').filter(Boolean),
      };
    });
  }
  return CID10_INDEX;
}

/* ─────────────────── CID-10: sinônimos populares (busca) ─────────────────── */

/**
 * Mínimo de caracteres para a busca "ampla" — casar no MEIO da palavra e
 * consultar os sinônimos.
 *
 * Por quê: com 2 caracteres e casamento por substring em qualquer posição, a
 * lista abria no meio das palavras e trazia item alarmante sem relação com o que
 * a pessoa estava escrevendo. Digitar "ca" trazia, entre outros, "Neoplasia
 * maligna do cólon" (por "neoplasia"), "Varicela" e "Escabiose". Agora 1 e 2
 * caracteres só casam por INÍCIO de palavra — "ca" traz "Catarata senil",
 * "Cárie dentária", "Candidíase", "Calculose do rim e do ureter" — e a busca
 * ampla entra a partir do 3º caractere, quando a intenção já está clara.
 */
const CID10_MIN_BUSCA_AMPLA = 3;

/** Palavras de ligação: não carregam sentido na comparação com o sinônimo. */
const CID10_LIGACOES = new Set(
  'de do da dos das no na nos nas e em com a o as os ao aos um uma'.split(' '),
);

function palavrasSignificativas(texto: string): string[] {
  const todas = texto.split(' ').filter(Boolean);
  const uteis = todas.filter((p) => !CID10_LIGACOES.has(p));
  return uteis.length > 0 ? uteis : todas;
}

interface IndexedSinonimo {
  termo: string;
  palavras: string[];
  codigos: readonly string[];
}

let CID10_SINONIMO_INDEX: IndexedSinonimo[] | null = null;
function sinonimoIndex(): IndexedSinonimo[] {
  if (!CID10_SINONIMO_INDEX) {
    CID10_SINONIMO_INDEX = CID10_SINONIMOS.map((s) => {
      const termo = normalizeClinicalText(s.termo);
      return { termo, palavras: palavrasSignificativas(termo), codigos: s.codigos };
    });
  }
  return CID10_SINONIMO_INDEX;
}

/**
 * A consulta e o sinônimo começam igual, palavra a palavra?
 *
 * Compara alinhado desde a primeira palavra, porque paciente digita pela metade
 * e também digita demais: "coleste" alcança "colesterol", "acucar no sangue
 * alto" alcança "acucar no sangue" e "artrose joelho" alcança "artrose".
 *
 * Alinhar importa: sem isso, quem digitasse "tireoide" cairia também em "câncer
 * de tireoide" e veria uma neoplasia no topo da lista sem ter escrito nada
 * parecido. Casar só o final da expressão popular assusta e não ajuda.
 */
function comecaIgual(consulta: string[], palavras: string[]): boolean {
  const n = Math.min(consulta.length, palavras.length);
  if (n === 0) return false;
  for (let i = 0; i < n; i += 1) {
    const a = consulta[i] ?? '';
    const b = palavras[i] ?? '';
    const maior = a.length >= b.length ? a : b;
    const menor = a.length >= b.length ? b : a;
    if (!maior.startsWith(menor)) return false;
  }
  return true;
}

/**
 * Códigos que a consulta alcança pelos sinônimos populares, com a posição em que
 * o sinônimo os declarou (ordem de exibição escolhida na curadoria).
 */
function sinonimoRanks(q: string): Map<string, number> {
  const encontrados = new Map<string, number>();
  if (q.length < CID10_MIN_BUSCA_AMPLA) return encontrados;
  const consulta = palavrasSignificativas(q);
  for (const s of sinonimoIndex()) {
    if (!comecaIgual(consulta, s.palavras)) continue;
    s.codigos.forEach((codigo, ordem) => {
      const anterior = encontrados.get(codigo);
      if (anterior === undefined || ordem < anterior) encontrados.set(codigo, ordem);
    });
  }
  return encontrados;
}

/* Faixas de relevância. Menor = aparece antes. */
const RANK_CODIGO = 0; // a pessoa digitou o código inteiro ("I70")
const RANK_DESCRICAO_INICIO = 1; // a descrição oficial começa com o que foi digitado
const RANK_SINONIMO = 2; // chegou pelo vocabulário popular ("pressão alta")
const RANK_PALAVRA = 3; // todo termo casa no início de alguma palavra
const RANK_SUBSTRING = 4; // algum termo só casa no meio da palavra
const SEM_RANK = Number.POSITIVE_INFINITY;

/** Relevância do item pela descrição oficial, ou `SEM_RANK` se não casa. */
function rankPorDescricao(item: IndexedCid10, termos: string[], q: string): number {
  let todoInicio = true;
  for (const termo of termos) {
    if (item.words.some((w) => w.startsWith(termo))) continue;
    // Casar no meio da palavra só a partir do 3º caractere: com 2, a lista
    // abria cheia de item sem relação com o que a pessoa estava escrevendo.
    if (termo.length >= CID10_MIN_BUSCA_AMPLA && item.haystack.includes(termo)) {
      todoInicio = false;
      continue;
    }
    return SEM_RANK;
  }
  if (!todoInicio) return RANK_SUBSTRING;
  return item.description.startsWith(q) ? RANK_DESCRICAO_INICIO : RANK_PALAVRA;
}

let CID10_BY_CODE: Map<string, Cid10Category> | null = null;
function cid10ByCode(): Map<string, Cid10Category> {
  if (!CID10_BY_CODE) {
    CID10_BY_CODE = new Map(CID10_CATEGORIES.map((c) => [normalizeCode(c.code), c]));
  }
  return CID10_BY_CODE;
}

/**
 * Busca categorias da CID-10 por código, por descrição oficial ou pelo
 * vocabulário popular do paciente.
 *
 * Sem acento, sem caixa, exige todas as palavras: "i10" e "hipertensao
 * essencial" chegam ao mesmo item. E "pressao alta" chega nele também — pela
 * camada de sinônimos de `../data/cid10-sinonimos`, que é só CHAVE DE BUSCA: o
 * que sai daqui é sempre a categoria oficial do DATASUS, com a descrição
 * original intacta.
 *
 * Ordem: código digitado inteiro → descrição que começa com o texto → sinônimo
 * popular → todo termo no início de alguma palavra → termo no meio da palavra.
 */
export function searchCid10(query: string, limit = 30): Cid10Category[] {
  const q = normalizeClinicalText(query);
  if (!q) return [];
  const terms = q.split(' ').filter(Boolean);
  const porSinonimo = sinonimoRanks(q);
  const matches: { item: IndexedCid10; rank: number; sub: number; ordem: number }[] = [];
  for (const item of cid10Index()) {
    const porDescricao = rankPorDescricao(item, terms, q);
    let rank = normalizeClinicalText(item.category.code) === q ? RANK_CODIGO : porDescricao;
    let ordem = 0;
    let sub = 0;
    const sinonimo = porSinonimo.get(item.category.code);
    if (sinonimo !== undefined && RANK_SINONIMO < rank) {
      rank = RANK_SINONIMO;
      ordem = sinonimo;
      // Quem veio pelo sinônimo E ainda casa com a descrição é o mais próximo do
      // que a pessoa escreveu ("artrose joelho" → M17 antes do resto da família).
      sub = porDescricao === SEM_RANK ? 1 : 0;
    }
    if (rank === SEM_RANK) continue;
    matches.push({ item, rank, sub, ordem });
  }
  matches.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.sub !== b.sub) return a.sub - b.sub;
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return a.item.category.code < b.item.category.code ? -1 : 1;
  });
  return matches.slice(0, limit).map((m) => m.item.category);
}

/**
 * Categoria pelo código CID-10. Aceita a subcategoria de 4 dígitos que o médico
 * costuma escrever ("I10.0", "E11.9") e devolve a categoria de 3 dígitos
 * correspondente — esta base não tem o 4º dígito, e fingir que tem seria mentira.
 */
export function findCid10ByCode(code: string): Cid10Category | null {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const direct = cid10ByCode().get(normalized);
  if (direct) return direct;
  // "I10.0" / "I100" → tenta a categoria de 3 caracteres (letra + 2 dígitos).
  const base = normalized.replace(/\./g, '').slice(0, 3);
  if (base.length < 3) return null;
  return cid10ByCode().get(base) ?? null;
}

/** Capítulo de uma categoria (ex.: I10 → capítulo IX, aparelho circulatório). */
export function cid10ChapterOf(category: Cid10Category): Cid10Chapter | null {
  return CID10_CHAPTERS.find((c) => c.number === category.chapter) ?? null;
}

/** Categorias de um capítulo, na ordem em que estão na base. */
export function cid10ByChapter(chapter: number): Cid10Category[] {
  return CID10_CATEGORIES.filter((c) => c.chapter === chapter);
}

/** Aviso obrigatório em qualquer tela que exiba código CID-10. */
export const CID10_DISCLAIMER =
  'Recorte da CID-10 para etiquetar seus registros. Não é diagnóstico, não é a lista completa e não substitui o que está no seu laudo ou atestado — quem codifica é o profissional de saúde.';

/** Aviso obrigatório em qualquer tela que exiba código LOINC. */
export const LOINC_DISCLAIMER =
  'Recorte do LOINC para reconhecer exames comuns. As unidades são as mais usadas no Brasil e servem só de referência: vale sempre a unidade e o valor de referência do laboratório que fez o exame.';
