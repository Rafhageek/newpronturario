'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiaryEntryInput, InsertRow } from '@hubpatients/core';
import { findInteractions, VITAL_TYPES, activityNotification, diaLocal } from '@hubpatients/core';
import { enqueueNotification } from '../queries/notifications';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import { listVitalsSinceAll, createVital } from '../queries/vitals';
import { createDiaryEntry } from '../queries/diary';
import { listRecentIntakes } from '../queries/medications';
import { getAllInteractions } from '../queries/interactions';

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ── Vitais (todos os tipos) para a timeline do diário ───────────────────────
export function useVitalsAllRange(patientId: string | undefined, days = 30) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.vitalsAll(patientId ?? '', days),
    queryFn: () => listVitalsSinceAll(client, patientId as string, daysAgoIso(days)),
    enabled: Boolean(patientId),
  });
}

// ── Cria a entrada do diário + vitais opcionais juntos ──────────────────────
export function useCreateDiaryEntryFull(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DiaryEntryInput) => {
      const entry = await createDiaryEntry(client, {
        patient_id: patientId,
        /**
         * ⚠️ ERA `input.entryDate.toISOString().slice(0, 10)` — e isso é UTC.
         *
         * No Brasil (UTC−3) qualquer registro feito depois das 21h ia para o
         * banco com a data de AMANHÃ. Não é detalhe de formatação: é o
         * prontuário guardando um fato com a data errada, e o Diário é
         * justamente o que a pessoa leva ao médico. Um registro de dor da
         * segunda à noite aparecia como terça, e a leitura da semana saía
         * deslocada.
         *
         * `diaLocal()` monta `AAAA-MM-DD` a partir de `getFullYear/Month/Date`,
         * que já são do fuso de quem viveu o dia — que é a definição de "dia"
         * que a coluna `entry_date` guarda.
         */
        entry_date: diaLocal(input.entryDate),
        mood: input.mood ?? null,
        energy: input.energy ?? null,
        pain: input.pain ?? null,
        symptoms: input.symptoms,
        note: input.note ?? null,
      });

      const v = input.vitals;
      if (v) {
        const measuredAt = new Date().toISOString();
        const rows: InsertRow<'vitals'>[] = [];
        const push = (type: keyof typeof VITAL_TYPES, primary?: number, secondary?: number) => {
          if (primary == null) return;
          rows.push({
            patient_id: patientId,
            type,
            measured_at: measuredAt,
            value_primary: primary,
            value_secondary: secondary ?? null,
            unit: VITAL_TYPES[type].unit,
          });
        };
        push('blood_pressure', v.systolic, v.diastolic);
        push('heart_rate', v.heartRate);
        push('temperature', v.temperature);
        push('weight', v.weight);
        push('glucose', v.glucose);
        push('oxygen_saturation', v.oxygen);
        await Promise.all(rows.map((r) => createVital(client, r)));
      }
      return entry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.diary(patientId) });
      qc.invalidateQueries({ queryKey: queryKeys.diarySummary(patientId) });
      qc.invalidateQueries({ queryKey: queryKeys.vitalsAll(patientId, 30) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard(patientId) });
      void enqueueNotification(client, activityNotification.diarySaved());
    },
  });
}

// ── Tomadas recentes (para a barra de adesão) ───────────────────────────────
export function useRecentIntakes(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.recentIntakes(patientId ?? ''),
    queryFn: () => listRecentIntakes(client, patientId as string, 200),
    enabled: Boolean(patientId),
  });
}

// ── Checador de interações (Plus) ───────────────────────────────────────────
export function useDrugInteractions(medicationNames: string[], enabled: boolean) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: [...queryKeys.interactions(), medicationNames.slice().sort()],
    queryFn: async () => {
      const base = await getAllInteractions(client);
      return findInteractions(medicationNames, base);
    },
    enabled: enabled && medicationNames.length > 1,
  });
}
