import { CRISIS_NOTICE } from '../constants/social';

/**
 * Resultado da triagem de conteúdo da comunidade.
 *
 * A triagem é um AUXÍLIO de moderação/UX (avisos no editor), não censura:
 * só `medSale` (compra/venda/troca de medicamentos — proibido por lei no Brasil)
 * deixa `blocked = true`. Posologia gera aviso (não bloqueia). Crise gera apoio
 * (CVV), nunca bloqueia — desabafo é permitido e acolhido.
 */
export interface ContentRisk {
  /** Recomendação de dose/posologia detectada. */
  posology: boolean;
  /** Compra/venda/troca/doação de medicamento (proibido). */
  medSale: boolean;
  /** Sinais de crise (ideação suicida, automutilação, TA). */
  crisis: boolean;
  /** Verdadeiro só quando há venda de medicamento. */
  blocked: boolean;
  /** Mensagens de aviso/apoio aplicáveis, na ordem de severidade. */
  messages: string[];
}

const POSOLOGY_MESSAGE =
  'Experiências pessoais são bem-vindas; recomendações de dose só podem vir do seu médico.';
const MED_SALE_MESSAGE =
  'Compra, venda, troca ou doação de medicamentos é proibida por lei no Brasil e não é permitida aqui.';

// Normaliza acentos básicos e caixa para tornar os regex tolerantes.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Dose numérica explícita: "500 mg", "10ml", "2 comprimidos", "3 gotas"…
const DOSE_RE = /\b\d+(?:[.,]\d+)?\s?(mg|ml|mcg|ug|g|comprimidos?|gotas?|capsulas?|drageas?)\b/;
// Verbos de instrução de uso + ajuste de tratamento.
const POSOLOGY_PHRASE_RE =
  /\b(tome|tomar|tome|use)\b|\bem vez do que o medico\b|\bsubstitu[ae]?\s+o?\s*(remedio|medicamento)\b|\b(aumente|diminua|dobre|reduza|pare de tomar|suspenda)\s+(a\s+)?(dose|o remedio|o medicamento)\b/;

// Comércio de medicamentos: verbo de transação próximo de um termo de medicamento.
const MED_TERM = '(remedio|remedios|medicamento|medicamentos|comprimido|comprimidos|insulina|antibiotico|antibioticos)';
const MED_SALE_RE = new RegExp(
  `\\b(vendo|vende-se|venda|a venda|compro|troco|troca-se|doacao|doo)\\b[\\s\\S]{0,40}?\\b${MED_TERM}\\b` +
    `|\\b${MED_TERM}\\b[\\s\\S]{0,40}?\\b(a venda|para vender|para troca|para doacao)\\b`,
);

// Crise: ideação suicida, automutilação, transtorno alimentar.
const CRISIS_RE =
  /\bme matar\b|\bme mato\b|\bsuicid|\btirar (a |minha )?vida\b|\bnao quero mais viver\b|\bnao aguento mais viver\b|\bacabar com tudo\b|\bdar fim (a |na )?(minha )?vida\b|\bme cortar\b|\bme cortando\b|\bautomutil|\bme machucar de proposito\b|\bvomitar pra emagrecer\b|\bvomitar para emagrecer\b|\bprovocar vomito\b|\bparar de comer pra emagrecer\b/;

/**
 * Triagem de risco de um texto da comunidade (PT-BR, case/acento-insensível).
 */
export function detectContentRisk(text: string): ContentRisk {
  const t = normalize(text ?? '');
  const messages: string[] = [];

  const medSale = MED_SALE_RE.test(t);
  const posology = DOSE_RE.test(t) || POSOLOGY_PHRASE_RE.test(t);
  const crisis = CRISIS_RE.test(t);

  // Ordem: bloqueio (lei) → apoio (crise) → aviso (posologia).
  if (medSale) messages.push(MED_SALE_MESSAGE);
  if (crisis) messages.push(CRISIS_NOTICE);
  if (posology) messages.push(POSOLOGY_MESSAGE);

  return { posology, medSale, crisis, blocked: medSale, messages };
}
