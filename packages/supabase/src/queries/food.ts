import type { HubPatientsClient } from '../types';
import type { MealType } from '@hubpatients/core';

/**
 * Diário alimentar (tabelas `food_entries`, `food_library`, `saved_meals`).
 * Tudo dono-apenas. Registra o que a pessoa comeu; não prescreve nada.
 *
 * Duas coisas neste arquivo merecem leitura antes de mexer:
 *
 * · A COLUNA `source`. Cada item carrega de onde veio o número (TACO, Open Food
 *   Facts ou digitado pela pessoa). Sem isso a tela assinava "Tabela TACO"
 *   embaixo de valor que veio de base colaborativa — o app afirmando o que não
 *   conferiu, num documento que vai ao médico. `null` significa "não dá para
 *   saber" e é assim que a tela mostra; nunca vira 'taco' por conveniência.
 *
 * · O DIA É LOCAL, NÃO UTC. "O que comi na terça" é fato do calendário de quem
 *   viveu a terça. As funções recebem `AAAA-MM-DD` local e convertem para o
 *   instante só na borda da consulta. Converter antes é o que faz o jantar das
 *   22h aparecer no dia seguinte.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(client: HubPatientsClient, nome: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(nome);
}

export type FoodSource = 'taco' | 'openfoodfacts' | 'manual';

export type FoodEntry = {
  id: string;
  logged_at: string;
  meal_type: MealType;
  food_name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Migração 0047. Linhas anteriores devolvem 0. */
  fiber_g?: number | null;
  /** Migração 0047. `null` em linha antiga = origem desconhecida, e é assim que a tela diz. */
  source?: FoodSource | null;
  /** Id na TACO ou o EAN consultado. Rastro para conferir o número. */
  source_ref?: string | null;
};

export type FoodEntryInput = {
  meal_type: MealType;
  food_name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  source?: FoodSource;
  source_ref?: string | null;
  logged_at?: string;
};

/* ───────────────────────────── Fronteiras do dia ───────────────────────────── */

/** `AAAA-MM-DD` → `Date` à meia-noite LOCAL (o construtor com string vira UTC). */
function meiaNoiteLocal(dia: string): Date {
  const [ano, mes, d] = dia.split('-').map(Number);
  return new Date(ano ?? 1970, (mes ?? 1) - 1, d ?? 1);
}

function inicioDoDiaIso(dia: string): string {
  return meiaNoiteLocal(dia).toISOString();
}

function inicioDoDiaSeguinteIso(dia: string): string {
  const d = meiaNoiteLocal(dia);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/** `AAAA-MM-DD` local de um timestamp — o inverso das funções acima. */
export function diaLocalDeIso(iso: string): string {
  const d = new Date(iso);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/* ───────────────────────────── Janela de migração ───────────────────────────── */

/**
 * Colunas que só existem depois da 0047.
 *
 * Enquanto a migração não for aplicada em produção, o PostgREST recusa o insert
 * inteiro com "column ... does not exist" (42703) ou "could not find the column
 * in the schema cache" (PGRST204). Sem este cuidado, a pessoa não conseguiria
 * registrar NADA no intervalo entre publicar o app e rodar a migração — uma
 * tela inteira quebrada por um campo a mais.
 *
 * O que se perde no modo antigo é fibra e procedência (o dado fica mais pobre);
 * o que NÃO se perde é a verdade: sem `source` gravado, a tela lê `null` e diz
 * "origem não registrada", que é exatamente o que aconteceu.
 */
const COLUNAS_DA_0047 = ['fiber_g', 'source', 'source_ref'] as const;

function faltaColunaNova(erro: unknown): boolean {
  const e = erro as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42703' || e.code === 'PGRST204') return true;
  const msg = (e.message ?? '').toLowerCase();
  return COLUNAS_DA_0047.some((c) => msg.includes(c)) && msg.includes('column');
}

function semColunasNovas<T extends Record<string, unknown>>(linha: T): Partial<T> {
  const copia: Record<string, unknown> = { ...linha };
  for (const c of COLUNAS_DA_0047) delete copia[c];
  return copia as Partial<T>;
}

/* ─────────────────────────────── Itens do diário ─────────────────────────────── */

function linhaDeEntrada(userId: string, input: FoodEntryInput) {
  return {
    user_id: userId,
    meal_type: input.meal_type,
    food_name: input.food_name,
    grams: input.grams,
    kcal: input.kcal,
    protein_g: input.protein_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    fiber_g: input.fiber_g ?? 0,
    source: input.source ?? null,
    source_ref: input.source_ref ?? null,
    ...(input.logged_at ? { logged_at: input.logged_at } : {}),
  };
}

export async function logFoodEntry(
  client: HubPatientsClient,
  userId: string,
  input: FoodEntryInput,
): Promise<void> {
  await logFoodEntries(client, userId, [input]);
}

/** Insere vários itens de uma vez — usado por "repetir ontem" e refeição salva. */
export async function logFoodEntries(
  client: HubPatientsClient,
  userId: string,
  inputs: readonly FoodEntryInput[],
): Promise<void> {
  if (inputs.length === 0) return;
  const linhas = inputs.map((i) => linhaDeEntrada(userId, i));

  const { error } = await table(client, 'food_entries').insert(linhas);
  if (!error) return;
  if (!faltaColunaNova(error)) throw error;

  const { error: erroAntigo } = await table(client, 'food_entries').insert(
    linhas.map(semColunasNovas),
  );
  if (erroAntigo) throw erroAntigo;
}

/** Itens de um dia local (`AAAA-MM-DD`), mais antigos primeiro. */
export async function listFoodEntriesForDay(
  client: HubPatientsClient,
  userId: string,
  dia: string,
): Promise<FoodEntry[]> {
  const { data, error } = await table(client, 'food_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', inicioDoDiaIso(dia))
    .lt('logged_at', inicioDoDiaSeguinteIso(dia))
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FoodEntry[];
}

/**
 * Só as DATAS que têm ao menos um item, num intervalo de dias locais.
 * Serve à visão da semana. Traz apenas `logged_at` — a tela não precisa dos
 * itens dos outros dias, e trafegar o prato inteiro de 7 dias para desenhar 7
 * bolinhas seria dado de saúde saindo do banco à toa (minimização, LGPD art. 6º).
 */
export async function listFoodLoggedDays(
  client: HubPatientsClient,
  userId: string,
  diaInicio: string,
  diaFim: string,
): Promise<string[]> {
  const { data, error } = await table(client, 'food_entries')
    .select('logged_at')
    .eq('user_id', userId)
    .gte('logged_at', inicioDoDiaIso(diaInicio))
    .lt('logged_at', inicioDoDiaSeguinteIso(diaFim));
  if (error) throw error;
  const dias = new Set<string>(
    ((data ?? []) as { logged_at: string }[]).map((r) => diaLocalDeIso(r.logged_at)),
  );
  return [...dias].sort();
}

export async function deleteFoodEntry(client: HubPatientsClient, id: string): Promise<void> {
  const { error } = await table(client, 'food_entries').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Alimentos usados recentemente, sem repetir, do mais recente para o mais antigo.
 *
 * Deriva de `food_entries` em vez de manter uma tabela de "recentes": a lista
 * mais honesta do que a pessoa come é o que ela já registrou. Uma tabela à parte
 * seria um segundo lugar para o mesmo fato ficar desatualizado.
 */
export async function listRecentFoods(
  client: HubPatientsClient,
  userId: string,
  limite = 12,
): Promise<FoodEntry[]> {
  const { data, error } = await table(client, 'food_entries')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(150);
  if (error) throw error;

  const vistos = new Set<string>();
  const saida: FoodEntry[] = [];
  for (const item of (data ?? []) as FoodEntry[]) {
    const chave = item.food_name.trim().toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(item);
    if (saida.length >= limite) break;
  }
  return saida;
}

/* ────────────────────────── Biblioteca pessoal (0047) ────────────────────────── */

export type FoodLibraryItem = {
  id: string;
  food_name: string;
  /** Composição SEMPRE por 100 g. */
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  default_grams: number | null;
  source: FoodSource;
  source_ref: string | null;
  is_favorite: boolean;
};

export type FoodLibraryInput = {
  food_name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  default_grams?: number | null;
  source: FoodSource;
  source_ref?: string | null;
  is_favorite?: boolean;
};

export async function listFoodLibrary(
  client: HubPatientsClient,
  userId: string,
): Promise<FoodLibraryItem[]> {
  const { data, error } = await table(client, 'food_library')
    .select('*')
    .eq('user_id', userId)
    .order('food_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FoodLibraryItem[];
}

/** Cria ou atualiza pelo nome (o índice único é por `user_id` + nome). */
export async function upsertFoodLibraryItem(
  client: HubPatientsClient,
  userId: string,
  input: FoodLibraryInput,
): Promise<void> {
  const { error } = await table(client, 'food_library').upsert(
    {
      user_id: userId,
      ...input,
      default_grams: input.default_grams ?? null,
      source_ref: input.source_ref ?? null,
      is_favorite: input.is_favorite ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,food_name' },
  );
  if (error) throw error;
}

export async function setFoodFavorite(
  client: HubPatientsClient,
  id: string,
  favorito: boolean,
): Promise<void> {
  const { error } = await table(client, 'food_library')
    .update({ is_favorite: favorito, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteFoodLibraryItem(
  client: HubPatientsClient,
  id: string,
): Promise<void> {
  const { error } = await table(client, 'food_library').delete().eq('id', id);
  if (error) throw error;
}

/* ─────────────────────────── Refeições salvas (0047) ─────────────────────────── */

export type SavedMealItem = {
  id: string;
  food_name: string;
  /** Aqui os valores já são DA PORÇÃO, não por 100 g. */
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  source: FoodSource | null;
  source_ref: string | null;
  position: number;
};

export type SavedMeal = {
  id: string;
  name: string;
  meal_type: MealType | null;
  saved_meal_items: SavedMealItem[];
};

export async function listSavedMeals(
  client: HubPatientsClient,
  userId: string,
): Promise<SavedMeal[]> {
  const { data, error } = await table(client, 'saved_meals')
    .select('id, name, meal_type, saved_meal_items(*)')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as SavedMeal[]).map((m) => ({
    ...m,
    saved_meal_items: [...(m.saved_meal_items ?? [])].sort((a, b) => a.position - b.position),
  }));
}

export type SavedMealInput = {
  name: string;
  meal_type: MealType | null;
  items: Omit<SavedMealItem, 'id' | 'position'>[];
};

export async function createSavedMeal(
  client: HubPatientsClient,
  userId: string,
  input: SavedMealInput,
): Promise<string> {
  const { data, error } = await table(client, 'saved_meals')
    .insert({ user_id: userId, name: input.name.trim(), meal_type: input.meal_type })
    .select('id')
    .single();
  if (error) throw error;

  const mealId = (data as { id: string }).id;
  if (input.items.length > 0) {
    const { error: erroItens } = await table(client, 'saved_meal_items').insert(
      input.items.map((item, i) => ({ ...item, meal_id: mealId, position: i })),
    );
    // Refeição salva sem itens é uma casca que confunde: desfaz e avisa.
    if (erroItens) {
      await table(client, 'saved_meals').delete().eq('id', mealId);
      throw erroItens;
    }
  }
  return mealId;
}

export async function deleteSavedMeal(client: HubPatientsClient, id: string): Promise<void> {
  const { error } = await table(client, 'saved_meals').delete().eq('id', id);
  if (error) throw error;
}
