'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHubPatientsClient } from './context';
import { logWater, getTodayWaterMl } from '../queries/water';

// Data local (YYYY-MM-DD) para re-keyar a query na virada do dia: se o app fica
// aberto cruzando a meia-noite, um novo render recomputa a chave e o total de
// "hoje" é refeito (evita exibir o total de ontem como se fosse hoje).
function localDayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Total de água (ml) de hoje. Expõe isLoading/isError para o card não mostrar 0 falso. */
export function useTodayWater(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: ['water-today', userId ?? '', localDayKey()],
    queryFn: () => getTodayWaterMl(client, userId as string),
    enabled: Boolean(userId),
  });
}

/** Registra um copo/quantidade e atualiza o total do dia (invalida por prefixo). */
export function useLogWater(userId: string | undefined) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ml: number) => logWater(client, userId as string, ml),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['water-today', userId ?? ''] }),
  });
}
