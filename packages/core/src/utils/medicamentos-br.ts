/**
 * Busca na base embarcada de medicamentos brasileiros.
 *
 * Mesma mecânica do `searchFoods` da nutrição: índice normalizado construído sob
 * demanda, busca sem acento, exige todas as palavras e prioriza quem começa com
 * o termo. Zero rede em runtime — a base viaja no bundle e é atualizada por OTA.
 *
 * O que isto FAZ: ajudar a pessoa a achar o nome do que ela já toma.
 * O que isto NÃO faz: prescrever, sugerir dose, indicar troca ou dizer que o
 * medicamento é adequado. Procedência e limites: ver `../data/medicamentos-br.ts`.
 */

import {
  MEDICAMENTOS_BR,
  MEDICAMENTOS_BR_CHECKED_AT,
  MEDICAMENTOS_BR_SOURCE_URL,
  MEDICAMENTO_CATEGORY_LABELS,
  MEDICAMENTO_TARJA_LABELS,
  type MedicamentoBr,
  type MedicamentoCategory,
  type MedicamentoTarja,
} from '../data/medicamentos-br';

export {
  MEDICAMENTOS_BR,
  MEDICAMENTOS_BR_CHECKED_AT,
  MEDICAMENTOS_BR_SOURCE_URL,
  MEDICAMENTO_CATEGORY_LABELS,
  MEDICAMENTO_TARJA_LABELS,
};
export type { MedicamentoBr, MedicamentoCategory, MedicamentoTarja };

// Marcas diacríticas combinantes (acentos), removidas após normalize('NFD').
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Normaliza para busca: sem acento, minúsculo, símbolo vira espaço. */
export function normalizeMedicamentoText(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface IndexedMedicamento {
  med: MedicamentoBr;
  /** Texto onde a busca acontece: princípio ativo + marca + sinônimos. */
  haystack: string;
  /** Só o princípio ativo normalizado — usado para priorizar prefixo. */
  ingredient: string;
  /** Termos que valem como "início": princípio ativo, marca e sinônimos. */
  starts: string[];
}

// Índice construído sob demanda (uma vez por processo).
let INDEX: IndexedMedicamento[] | null = null;
function index(): IndexedMedicamento[] {
  if (!INDEX) {
    INDEX = MEDICAMENTOS_BR.map((med) => {
      const ingredient = normalizeMedicamentoText(med.activeIngredient);
      const brand = med.brand ? normalizeMedicamentoText(med.brand) : '';
      const extra = (med.terms ?? []).map(normalizeMedicamentoText);
      const starts = [ingredient, ...extra];
      if (brand) starts.push(brand);
      return {
        med,
        ingredient,
        starts: starts.filter((s) => s.length > 0),
        haystack: [ingredient, brand, ...extra].filter(Boolean).join(' '),
      };
    });
  }
  return INDEX;
}

/**
 * Busca medicamentos por princípio ativo, marca ou sinônimo.
 *
 * Sem acento e sem caixa. Exige TODAS as palavras da consulta (assim "losartana
 * hidro" não traz losartana pura). Ordena: quem começa com o termo primeiro,
 * depois o princípio ativo mais curto — o nome "puro" vem antes das combinações.
 */
export function searchMedicamentos(query: string, limit = 30): MedicamentoBr[] {
  const q = normalizeMedicamentoText(query);
  if (!q) return [];
  const terms = q.split(' ').filter(Boolean);
  const matches: IndexedMedicamento[] = [];
  for (const item of index()) {
    if (terms.every((t) => item.haystack.includes(t))) matches.push(item);
  }
  matches.sort((a, b) => {
    const sa = a.starts.some((s) => s.startsWith(q)) ? 0 : 1;
    const sb = b.starts.some((s) => s.startsWith(q)) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    if (a.ingredient.length !== b.ingredient.length) return a.ingredient.length - b.ingredient.length;
    return a.ingredient < b.ingredient ? -1 : 1;
  });
  return matches.slice(0, limit).map((m) => m.med);
}

/**
 * Encontra o medicamento a partir de um nome livre digitado pela pessoa
 * ("Losartana 50mg", "puran t4 75", "AAS 100").
 *
 * O termo precisa casar em INÍCIO DE PALAVRA — evita que "rosuvastatina" case
 * com "sinvastatina" ou "estradiol" com "etinilestradiol". Entre vários
 * candidatos, ganha o termo mais longo (o mais específico).
 */
export function findMedicamentoByName(name: string): MedicamentoBr | null {
  const normalized = normalizeMedicamentoText(name);
  if (!normalized) return null;
  const haystack = ` ${normalized} `;
  let best: { med: MedicamentoBr; length: number } | null = null;
  for (const item of index()) {
    for (const term of item.starts) {
      if (!haystack.includes(` ${term}`)) continue;
      if (!best || term.length > best.length) best = { med: item.med, length: term.length };
    }
  }
  return best ? best.med : null;
}

/** Todos os medicamentos de uma categoria, na ordem em que estão na base. */
export function medicamentosByCategory(category: MedicamentoCategory): MedicamentoBr[] {
  return MEDICAMENTOS_BR.filter((m) => m.category === category);
}

/** Rótulo curto da tarja ("Tarja vermelha — sob prescrição médica"). */
export function medicamentoTarjaLabel(med: MedicamentoBr): string {
  return MEDICAMENTO_TARJA_LABELS[med.tarja];
}

/** Rótulo curto da categoria ("Coração e pressão"). */
export function medicamentoCategoryLabel(med: MedicamentoBr): string {
  return MEDICAMENTO_CATEGORY_LABELS[med.category];
}

/**
 * Linha de apresentação para exibir sob o nome ("50 mg · comprimido").
 * Junta concentrações e formas sem repetir separador quando um deles falta.
 */
export function medicamentoPresentation(med: MedicamentoBr): string {
  return [med.strengths, med.forms].filter((s) => s.trim().length > 0).join(' · ');
}

/** Aviso obrigatório em qualquer tela que use esta base. */
export const MEDICAMENTOS_BR_DISCLAIMER =
  'Lista de referência para você encontrar o nome do que já usa. Concentrações, formas e tarja são as mais comuns no Brasil e podem não corresponder à sua apresentação. O HubPatients não prescreve, não indica dose e não substitui a bula, a receita nem a orientação do seu médico ou farmacêutico.';
