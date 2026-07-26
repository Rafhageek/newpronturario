/**
 * Cliente da Open Food Facts — consulta de alimento pelo código de barras.
 *
 * FONTE: Open Food Facts (https://world.openfoodfacts.org), API pública v2,
 * gratuita e sem chave. Os dados são COLABORATIVOS: qualquer pessoa no mundo
 * cadastra e edita produtos. Isso significa, na prática:
 *   - o produto pode simplesmente não existir na base (muito comum no Brasil);
 *   - o nome pode estar em outro idioma, abreviado ou errado;
 *   - a tabela nutricional pode estar incompleta, desatualizada ou digitada
 *     errado por quem cadastrou.
 * Por isso NADA daqui pode ser salvo direto no diário: o resultado é sempre um
 * RASCUNHO que a pessoa confere e edita antes de gravar. O rótulo da embalagem
 * é que manda — não este JSON.
 *
 * PRIVACIDADE (LGPD): a única coisa que sai do aparelho é o número do código de
 * barras, na URL. Nenhum identificador do usuário, token, perfil, localização ou
 * dado de saúde acompanha a chamada — e a requisição não leva cookies nem o
 * cabeçalho de autenticação do Supabase. Ainda assim é um terceiro recebendo uma
 * informação sobre o que a pessoa consome, então a tela precisa avisar e pedir
 * um "pode consultar?" antes da primeira busca (ver `hasOpenFoodFactsConsent`).
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from './logger';

/** Resultado já normalizado. Tudo que a base não trouxe vem como `null`. */
export type OpenFoodFactsFood = {
  /** Nome do produto como está na base (pode vir abreviado ou em outro idioma). */
  name: string;
  /** Marca, quando cadastrada. */
  brand: string | null;
  /** Energia por 100 g/ml. */
  kcalPer100g: number | null;
  /** Proteína (g) por 100 g/ml. */
  protein: number | null;
  /** Carboidrato (g) por 100 g/ml. */
  carbs: number | null;
  /** Gordura total (g) por 100 g/ml. */
  fat: number | null;
};

const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';

/** Pede só o necessário: resposta menor, menos dado trafegado. */
const FIELDS = [
  'product_name',
  'product_name_pt',
  'generic_name',
  'generic_name_pt',
  'brands',
  'nutriments',
].join(',');

/** Rede de celular no Brasil é o que é: 6 s e desiste sem travar a tela. */
const TIMEOUT_MS = 6_000;

/** Identificação exigida pela política de uso da API da Open Food Facts. */
const USER_AGENT = 'HubPatients/1.0 (aplicativo de saude pessoal; contato via app)';

/** Nome da fonte, para exibir na tela junto do dado. */
export const OPEN_FOOD_FACTS_SOURCE = 'Open Food Facts';

/** Aviso obrigatório em qualquer tela que mostre dado vindo daqui. */
export const OPEN_FOOD_FACTS_DISCLAIMER =
  'Dados da Open Food Facts, uma base colaborativa mantida por voluntários no mundo todo. Podem estar incompletos, desatualizados ou errados. Confira o rótulo da embalagem e ajuste os valores antes de salvar.';

/** Texto do pedido de consentimento, mostrado uma única vez. */
export const OPEN_FOOD_FACTS_PRIVACY_NOTICE =
  'Para descobrir o produto, o HubPatients envia apenas o número do código de barras para a Open Food Facts, um serviço gratuito e público mantido por voluntários. Nada seu vai junto: nem seu nome, nem seu cadastro, nem seus dados de saúde. Você pode recusar e continuar buscando o alimento pelo nome na Tabela TACO.';

/* ──────────────────────────── Código de barras ──────────────────────────── */

/**
 * Normaliza o que veio da câmera (ou da digitação) para um código de produto.
 *
 * Aceita EAN-13, EAN-8, UPC-A (12) e ITF-14 (caixa de transporte). Devolve
 * `null` para qualquer outra coisa — QR code, código interno de balança de
 * supermercado com tamanho estranho, texto solto.
 */
export function normalizeEan(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return digits;
  }
  return null;
}

/* ──────────────────────────── Consentimento ──────────────────────────── */

const CONSENT_KEY = 'hubpatients.openfoodfacts.consent';

/** A pessoa já autorizou consultar a Open Food Facts neste aparelho? */
export async function hasOpenFoodFactsConsent(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(CONSENT_KEY)) === '1';
  } catch {
    // Sem conseguir ler, tratamos como "ainda não perguntou" e perguntamos de novo.
    return false;
  }
}

/** Guarda o "pode consultar" para não perguntar a cada código lido. */
export async function saveOpenFoodFactsConsent(allowed: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(CONSENT_KEY, allowed ? '1' : '0');
  } catch (e) {
    logger.warn('Falha ao salvar consentimento da Open Food Facts', { error: String(e) });
  }
}

/* ──────────────────────────── Parsing defensivo ──────────────────────────── */

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Texto não-vazio, aparado. Qualquer outra coisa vira `null`. */
function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Número plausível para nutriente por 100 g. A base aceita string ("12.5") e
 * tem lixo eventual (negativo, absurdo) — nada disso pode virar rascunho.
 */
function asAmount(value: unknown, max: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return n;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Energia: kcal direto quando existe; senão converte do kJ (1 kcal = 4,184 kJ). */
function readKcal(nutriments: Record<string, unknown>): number | null {
  const kcal = asAmount(nutriments['energy-kcal_100g'], 1000);
  if (kcal != null) return Math.round(kcal);
  const kj = asAmount(nutriments['energy-kj_100g'], 4200) ?? asAmount(nutriments['energy_100g'], 4200);
  return kj != null ? Math.round(kj / 4.184) : null;
}

/** Marca: a base guarda várias separadas por vírgula; ficamos com a primeira. */
function readBrand(value: unknown): string | null {
  const brands = asText(value);
  if (!brands) return null;
  const first = brands.split(',')[0];
  return asText(first ?? null);
}

/* ──────────────────────────── Consulta ──────────────────────────── */

/**
 * Procura um alimento pelo código de barras.
 *
 * Devolve `null` em TODOS os caminhos infelizes — produto inexistente, sem
 * nome, rede fora do ar, timeout, resposta malformada. A tela chamadora usa
 * isso para cair na busca por nome da Tabela TACO, que funciona offline.
 * Nunca lança: o erro fica no logger (sem o código, que é dado de consumo).
 */
export async function lookupFood(ean: string): Promise<OpenFoodFactsFood | null> {
  const code = normalizeEan(ean);
  if (!code) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/${code}.json?fields=${FIELDS}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });

    // 404 é o caso normal de "não temos esse produto", não é falha.
    if (!response.ok) {
      if (response.status !== 404) {
        logger.warn('Open Food Facts respondeu com erro', { status: response.status });
      }
      return null;
    }

    const body = asRecord(await response.json());
    const product = body ? asRecord(body.product) : null;
    if (!product) return null;

    const name =
      asText(product.product_name_pt) ??
      asText(product.product_name) ??
      asText(product.generic_name_pt) ??
      asText(product.generic_name);
    // Sem nome não há rascunho possível — melhor mandar a pessoa para a TACO.
    if (!name) return null;

    const nutriments = asRecord(product.nutriments) ?? {};
    const protein = asAmount(nutriments.proteins_100g, 100);
    const carbs = asAmount(nutriments.carbohydrates_100g, 100);
    const fat = asAmount(nutriments.fat_100g, 100);

    return {
      name,
      brand: readBrand(product.brands),
      kcalPer100g: readKcal(nutriments),
      protein: protein != null ? round1(protein) : null,
      carbs: carbs != null ? round1(carbs) : null,
      fat: fat != null ? round1(fat) : null,
    };
  } catch (e) {
    // Timeout (AbortError), sem internet, DNS, JSON inválido: tudo vira `null`.
    logger.warn('Não foi possível consultar a Open Food Facts', {
      reason: e instanceof Error ? e.name : 'desconhecido',
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
