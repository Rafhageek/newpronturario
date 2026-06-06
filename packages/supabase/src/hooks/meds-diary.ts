'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiaryEntryInput, InsertRow } from '@vidalog/core';
import { findInteractions, VITAL_TYPES } from '@vidalog/core';
import { useVidaLogClient } from './context';
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
  const client = useVidaLogClient();
  return useQuery({
    queryKey: queryKeys.vitalsAll(patientId ?? '', days),
    queryFn: () => listVitalsSinceAll(client, patientId as string, daysAgoIso(days)),
    enabled: Boolean(patientId),
  });
}

// ── Cria a entrada do diário + vitais opcionais juntos ──────────────────────
export function useCreateDiaryEntryFull(patientId: string) {
  const client = useVidaLogClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DiaryEntryInput) => {
      const entry = await createDiaryEntry(client, {
        patient_id: patientId,
        entry_date: input.entryDate.toISOString().slice(0, 10),
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
    },
  });
}

// ── Tomadas recentes (para a barra de adesão) ───────────────────────────────
export function useRecentIntakes(patientId: string | undefined) {
  const client = useVidaLogClient();
  return useQuery({
    queryKey: queryKeys.recentIntakes(patientId ?? ''),
    queryFn: () => listRecentIntakes(client, patientId as string, 200),
    enabled: Boolean(patientId),
  });
}

// ── Checador de interações (Plus) ───────────────────────────────────────────
export function useDrugInteractions(medicationNames: string[], enabled: boolean) {
  const client = useVidaLogClient();
  return useQuery({
    queryKey: [...queryKeys.interactions(), medicationNames.slice().sort()],
    queryFn: async () => {
      const base = await getAllInteractions(client);
      return findInteractions(medicationNames, base);
    },
    enabled: enabled && medicationNames.length > 1,
  });
}
