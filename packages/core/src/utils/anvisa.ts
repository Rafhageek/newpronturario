/**
 * Helpers de bula oficial Anvisa.
 *
 * Estratégia v1 = LINK direto para o Bulário Eletrônico da Anvisa (sempre
 * atualizado, zero manutenção). NÃO copiamos nem resumimos o conteúdo da bula —
 * apenas montamos a URL de busca/consulta.
 */

const BULARIO_BASE = 'https://consultas.anvisa.gov.br/#/bulario/';
// Marcas diacríticas combinantes (acentos) — removidas após normalize('NFD').
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Normaliza o nome para busca: maiúsculas, sem acentos, sem espaços extras. */
export function normalizeAnvisaName(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** URL de busca no Bulário pelo nome do medicamento. */
export function buildBulaSearchUrl(drugName: string): string {
  return `${BULARIO_BASE}?nomeProduto=${encodeURIComponent(drugName.trim())}`;
}

/**
 * URL mais específica quando há número de registro Anvisa. O campo de busca do
 * Bulário aceita o número de registro, então buscamos por ele.
 */
export function buildBulaProfessionalUrl(registration: string): string {
  return `${BULARIO_BASE}?nomeProduto=${encodeURIComponent(registration.trim())}`;
}

export interface BulaResolvable {
  name: string;
  anvisa_registration?: string | null;
  anvisa_drug_name?: string | null;
}

/** Melhor URL para a bula: registro (mais específico) > nome padronizado > nome. */
export function resolveBulaUrl(med: BulaResolvable): string {
  if (med.anvisa_registration && med.anvisa_registration.trim()) {
    return buildBulaProfessionalUrl(med.anvisa_registration);
  }
  return buildBulaSearchUrl(med.anvisa_drug_name?.trim() || med.name);
}

/** Aviso padrão exibido ao sair do app para o site da Anvisa. */
export const ANVISA_EXIT_NOTICE =
  'Você está saindo do HubPatients para o site oficial da Anvisa (Bulário Eletrônico).';
