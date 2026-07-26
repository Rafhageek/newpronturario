/**
 * Casamento de medicamentos cadastrados pelo paciente com o elenco gratuito do
 * Programa Farmácia Popular.
 *
 * O que isto FAZ: dizer que o princípio ativo CONSTA no elenco do programa.
 * O que isto NÃO faz: prescrever, indicar troca de medicamento, afirmar que a
 * pessoa "tem direito" ou garantir que a marca/apresentação dela será aceita.
 * Elegibilidade, receita e autorização são decisão do serviço de saúde.
 *
 * Fonte e data da checagem do elenco: ver `../data/farmacia-popular.ts`.
 */

import {
  FARMACIA_POPULAR_AUTHORIZATION_DAYS,
  FARMACIA_POPULAR_CATEGORY_LABELS,
  FARMACIA_POPULAR_CHECKED_AT,
  FARMACIA_POPULAR_ITEMS,
  FARMACIA_POPULAR_SOURCE_URL,
  type FarmaciaPopularCategory,
  type FarmaciaPopularItem,
} from '../data/farmacia-popular';

export {
  FARMACIA_POPULAR_AUTHORIZATION_DAYS,
  FARMACIA_POPULAR_CATEGORY_LABELS,
  FARMACIA_POPULAR_CHECKED_AT,
  FARMACIA_POPULAR_ITEMS,
  FARMACIA_POPULAR_SOURCE_URL,
};
export type { FarmaciaPopularCategory, FarmaciaPopularItem };

// Marcas diacríticas combinantes (acentos), removidas após normalize('NFD').
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Normaliza para comparação: sem acento, minúsculo, pontuação/símbolos viram
 * espaço (assim "Carbidopa+Levodopa" e "Losartana-50mg" ficam comparáveis) e
 * espaços repetidos colapsam.
 */
export function normalizeFarmaciaPopularText(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Termos de busca de um item (cai no princípio ativo quando não há `terms`). */
function termsOf(item: FarmaciaPopularItem): string[] {
  const list = item.terms && item.terms.length > 0 ? item.terms : [item.activeIngredient];
  return list.map(normalizeFarmaciaPopularText).filter((t) => t.length > 0);
}

// Índice construído sob demanda: termos maiores primeiro, para que o match mais
// específico vença (ex.: "insulina humana nph" antes de "insulina humana").
let INDEX: { term: string; item: FarmaciaPopularItem }[] | null = null;
function index() {
  if (!INDEX) {
    const entries: { term: string; item: FarmaciaPopularItem }[] = [];
    for (const item of FARMACIA_POPULAR_ITEMS) {
      for (const term of termsOf(item)) entries.push({ term, item });
    }
    entries.sort((a, b) => b.term.length - a.term.length);
    INDEX = entries;
  }
  return INDEX;
}

/**
 * Procura o item do elenco correspondente a um nome livre de medicamento
 * ("Losartana 50mg", "losartana potássica", "Insulina NPH 100UI").
 *
 * O termo precisa começar em início de palavra — evita falso positivo como
 * "rosuvastatina" casar com "sinvastatina" ou "etinilestradiol" com "estradiol".
 */
export function findFarmaciaPopularItem(nomeOuPrincipioAtivo: string): FarmaciaPopularItem | null {
  const normalized = normalizeFarmaciaPopularText(nomeOuPrincipioAtivo);
  if (!normalized) return null;
  const haystack = ` ${normalized} `;
  for (const entry of index()) {
    if (haystack.includes(` ${entry.term}`)) return entry.item;
  }
  return null;
}

/** `true` quando o princípio ativo consta no elenco gratuito do programa. */
export function isFarmaciaPopular(nomeOuPrincipioAtivo: string): boolean {
  return findFarmaciaPopularItem(nomeOuPrincipioAtivo) != null;
}

/** Rótulo curto da condição atendida pelo item ("Hipertensão", "Diabetes"…). */
export function farmaciaPopularCategoryLabel(item: FarmaciaPopularItem): string {
  return FARMACIA_POPULAR_CATEGORY_LABELS[item.category];
}

/** Etiqueta curta usada nos badges de web e mobile. */
export const FARMACIA_POPULAR_LABEL = 'Grátis na Farmácia Popular';

/**
 * Texto exibido junto do badge. Fala do ELENCO do programa, nunca de direito
 * adquirido: quem decide é a receita + a autorização no Meu SUS Digital.
 */
export const FARMACIA_POPULAR_NOTE =
  'Este princípio ativo consta no elenco gratuito do programa Farmácia Popular (Ministério da Saúde). A retirada não é automática: depende de receita médica válida, documento com foto e da autorização gerada no Meu SUS Digital, que vale 180 dias, em farmácia credenciada. Marca e apresentação específicas podem não estar cobertas — confirme na farmácia. O HubPatients não prescreve nem substitui a avaliação do seu médico ou farmacêutico.';
