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
  CID10_SOURCE_URL,
  LOINC_ATTRIBUTION,
  LOINC_CATEGORY_LABELS,
  LOINC_CHECKED_AT,
  LOINC_EXAMS,
  LOINC_SOURCE_URL,
  LOINC_VERIFICATION_URL,
};
export type { Cid10Category, Cid10Chapter, LoincCategory, LoincExam };

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
}

let CID10_INDEX: IndexedCid10[] | null = null;
function cid10Index(): IndexedCid10[] {
  if (!CID10_INDEX) {
    CID10_INDEX = CID10_CATEGORIES.map((category) => {
      const description = normalizeClinicalText(category.description_pt);
      return {
        category,
        description,
        haystack: `${normalizeClinicalText(category.code)} ${description}`,
      };
    });
  }
  return CID10_INDEX;
}

let CID10_BY_CODE: Map<string, Cid10Category> | null = null;
function cid10ByCode(): Map<string, Cid10Category> {
  if (!CID10_BY_CODE) {
    CID10_BY_CODE = new Map(CID10_CATEGORIES.map((c) => [normalizeCode(c.code), c]));
  }
  return CID10_BY_CODE;
}

/**
 * Busca categorias da CID-10 por código ou descrição.
 *
 * Sem acento, sem caixa, exige todas as palavras: "i10" e "hipertensao
 * essencial" chegam ao mesmo item.
 */
export function searchCid10(query: string, limit = 30): Cid10Category[] {
  const q = normalizeClinicalText(query);
  if (!q) return [];
  const terms = q.split(' ').filter(Boolean);
  const matches: IndexedCid10[] = [];
  for (const item of cid10Index()) {
    if (terms.every((t) => item.haystack.includes(t))) matches.push(item);
  }
  matches.sort((a, b) => {
    // Código digitado inteiro vem primeiro; depois descrição que começa com o termo.
    const ca = normalizeClinicalText(a.category.code) === q ? 0 : 1;
    const cb = normalizeClinicalText(b.category.code) === q ? 0 : 1;
    if (ca !== cb) return ca - cb;
    const sa = a.description.startsWith(q) ? 0 : 1;
    const sb = b.description.startsWith(q) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.category.code < b.category.code ? -1 : 1;
  });
  return matches.slice(0, limit).map((m) => m.category);
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
