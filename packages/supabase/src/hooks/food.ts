'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import {
  logFoodEntry,
  logFoodEntries,
  listFoodEntriesForDay,
  listFoodLoggedDays,
  listRecentFoods,
  deleteFoodEntry,
  listFoodLibrary,
  upsertFoodLibraryItem,
  setFoodFavorite,
  deleteFoodLibraryItem,
  listSavedMeals,
  createSavedMeal,
  deleteSavedMeal,
  type FoodEntryInput,
  type FoodLibraryInput,
  type SavedMealInput,
} from '../queries/food';

/**
 * Hooks do diário alimentar.
 *
 * A chave da consulta carrega o DIA (`AAAA-MM-DD` local), não "hoje": a tela
 * navega entre datas, e uma chave fixa em "hoje" faria a segunda-feira mostrar
 * o prato do domingo até alguém recarregar a página.
 */

const RAIZ = 'food-entries';

const chaveDia = (userId: string | undefined, dia: string) => [RAIZ, userId ?? '', 'dia', dia];
const chaveSemana = (userId: string | undefined, de: string, ate: string) => [
  RAIZ,
  userId ?? '',
  'dias-registrados',
  de,
  ate,
];
const chaveRecentes = (userId: string | undefined) => [RAIZ, userId ?? '', 'recentes'];
const chaveBiblioteca = (userId: string | undefined) => ['food-library', userId ?? ''];
const chaveRefeicoesSalvas = (userId: string | undefined) => ['saved-meals', userId ?? ''];

/** Invalida tudo que muda quando um item entra ou sai do diário. */
function useInvalidarDiario(userId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [RAIZ, userId ?? ''] });
  };
}

/* ─────────────────────────────── Itens do dia ─────────────────────────────── */

/** Itens de um dia local. `dia` no formato `AAAA-MM-DD`. */
export function useFoodEntriesForDay(userId: string | undefined, dia: string) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: chaveDia(userId, dia),
    queryFn: () => listFoodEntriesForDay(client, userId as string, dia),
    enabled: Boolean(userId) && Boolean(dia),
  });
}

/** Só as datas com registro, para a visão da semana. */
export function useFoodLoggedDays(
  userId: string | undefined,
  diaInicio: string,
  diaFim: string,
) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: chaveSemana(userId, diaInicio, diaFim),
    queryFn: () => listFoodLoggedDays(client, userId as string, diaInicio, diaFim),
    enabled: Boolean(userId) && Boolean(diaInicio) && Boolean(diaFim),
  });
}

/** Alimentos usados recentemente, sem repetição. */
export function useRecentFoods(userId: string | undefined, limite = 12) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: chaveRecentes(userId),
    queryFn: () => listRecentFoods(client, userId as string, limite),
    enabled: Boolean(userId),
  });
}

export function useLogFoodEntry(userId: string | undefined) {
  const client = useHubPatientsClient();
  const invalidar = useInvalidarDiario(userId);
  return useMutation({
    mutationFn: (input: FoodEntryInput) => logFoodEntry(client, userId as string, input),
    onSuccess: invalidar,
  });
}

/** Vários itens de uma vez (repetir o dia anterior, aplicar refeição salva). */
export function useLogFoodEntries(userId: string | undefined) {
  const client = useHubPatientsClient();
  const invalidar = useInvalidarDiario(userId);
  return useMutation({
    mutationFn: (inputs: FoodEntryInput[]) => logFoodEntries(client, userId as string, inputs),
    onSuccess: invalidar,
  });
}

export function useDeleteFoodEntry(userId: string | undefined) {
  const client = useHubPatientsClient();
  const invalidar = useInvalidarDiario(userId);
  return useMutation({
    mutationFn: (id: string) => deleteFoodEntry(client, id),
    onSuccess: invalidar,
  });
}

/* ────────────────────────────── Biblioteca pessoal ────────────────────────────── */

export function useFoodLibrary(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: chaveBiblioteca(userId),
    queryFn: () => listFoodLibrary(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useUpsertFoodLibraryItem(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodLibraryInput) => upsertFoodLibraryItem(client, userId as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveBiblioteca(userId) }),
  });
}

export function useSetFoodFavorite(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorito }: { id: string; favorito: boolean }) =>
      setFoodFavorite(client, id, favorito),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveBiblioteca(userId) }),
  });
}

export function useDeleteFoodLibraryItem(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFoodLibraryItem(client, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveBiblioteca(userId) }),
  });
}

/* ────────────────────────────── Refeições salvas ────────────────────────────── */

export function useSavedMeals(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: chaveRefeicoesSalvas(userId),
    queryFn: () => listSavedMeals(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useCreateSavedMeal(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SavedMealInput) => createSavedMeal(client, userId as string, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveRefeicoesSalvas(userId) }),
  });
}

export function useDeleteSavedMeal(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSavedMeal(client, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveRefeicoesSalvas(userId) }),
  });
}
