'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InsertRow, UpdateRow, VitalType } from '@hubpatients/core';
import { moodEnergyAverage, activityNotification } from '@hubpatients/core';
import { enqueueNotification } from '../queries/notifications';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  getNextAppointment,
  listAppointments,
  createAppointment,
  updateAppointment,
  listConditions,
  createCondition,
  updateCondition,
  deleteCondition,
  listAllergies,
  createAllergy,
  deleteAllergy,
  declareNoKnownAllergy,
  undoNoKnownAllergy,
  listSurgeries,
  createSurgery,
  deleteSurgery,
  uploadSurgeryReportFile,
  setSurgeryReport,
  removeSurgeryReportFile,
  getSurgeryReportSignedUrl,
  type SurgeryReportSource,
  listFamilyHistory,
  createFamilyHistory,
  deleteFamilyHistory,
  getPrimaryInsurance,
  upsertPrimaryInsurance,
} from '../queries/clinical';
import { listVitalsSince } from '../queries/vitals';
import { listDiaryEntries } from '../queries/diary';
import { getProfile, updateProfile } from '../queries/profile';

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ── Vitais por período (gráfico) ────────────────────────────────────────────
export function useVitalsRange(patientId: string | undefined, type: VitalType, days = 30) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.vitalsRange(patientId ?? '', type, days),
    queryFn: () => listVitalsSince(client, patientId as string, type, daysAgoIso(days)),
    enabled: Boolean(patientId),
  });
}

// ── Resumo do diário (bem-estar 7 dias) ─────────────────────────────────────
export function useDiarySummary(patientId: string | undefined, days = 7) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.diarySummary(patientId ?? ''),
    queryFn: async () => {
      const entries = await listDiaryEntries(client, patientId as string, 60);
      return moodEnergyAverage(entries, days);
    },
    enabled: Boolean(patientId),
  });
}

// ── Próxima consulta ────────────────────────────────────────────────────────
export function useNextAppointment(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.nextAppointment(patientId ?? ''),
    queryFn: () => getNextAppointment(client, patientId as string, new Date().toISOString()),
    enabled: Boolean(patientId),
  });
}

// ── Consultas (lista + mutations) ───────────────────────────────────────────
export function useAppointments(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.appointments(patientId ?? ''),
    queryFn: () => listAppointments(client, patientId as string),
    enabled: Boolean(patientId),
  });
}

export function useAppointmentMutations(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.appointments(patientId) });
    qc.invalidateQueries({ queryKey: queryKeys.nextAppointment(patientId) });
  };
  return {
    create: useMutation({
      mutationFn: (row: InsertRow<'appointments'>) => createAppointment(client, row),
      onSuccess: () => {
        invalidate();
        void enqueueNotification(client, activityNotification.appointmentScheduled());
      },
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: UpdateRow<'appointments'> }) =>
        updateAppointment(client, id, patch),
      onSuccess: invalidate,
    }),
  };
}

// ── Diário no período (humor/energia para Análise) ──────────────────────────
export function useDiaryRange(patientId: string | undefined, days: number) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.diaryRange(patientId ?? '', days),
    queryFn: async () => {
      const entries = await listDiaryEntries(client, patientId as string, 400);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return entries.filter((e) => new Date(e.entry_date) >= cutoff);
    },
    enabled: Boolean(patientId),
  });
}

// ── Perfil (update otimista) ────────────────────────────────────────────────
export function useUpdateProfile(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateRow<'profiles'>) => updateProfile(client, userId, patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: queryKeys.profile(userId) });
      const previous = qc.getQueryData(queryKeys.profile(userId));
      qc.setQueryData(queryKeys.profile(userId), (old: unknown) =>
        old ? { ...old, ...patch } : old,
      );
      return { previous };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.profile(userId), ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.profile(userId) }),
  });
}

export function useProfileQuery(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.profile(userId ?? ''),
    queryFn: () => getProfile(client, userId as string),
    enabled: Boolean(userId),
  });
}

// ── Condições ───────────────────────────────────────────────────────────────
export function useConditions(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.conditions(patientId ?? ''),
    queryFn: () => listConditions(client, patientId as string),
    enabled: Boolean(patientId),
  });
}
export function useConditionMutations(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.conditions(patientId) });
  return {
    create: useMutation({ mutationFn: (row: InsertRow<'conditions'>) => createCondition(client, row), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: UpdateRow<'conditions'> }) => updateCondition(client, id, patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteCondition(client, id), onSuccess: invalidate }),
  };
}

// ── Alergias ────────────────────────────────────────────────────────────────
export function useAllergies(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.allergies(patientId ?? ''),
    queryFn: () => listAllergies(client, patientId as string),
    enabled: Boolean(patientId),
  });
}
export function useAllergyMutations(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.allergies(patientId) });
  /*
   * A declaração "sem alergia conhecida" mora em `profiles`, mas o trigger da
   * 0049 a derruba sozinho quando uma alergia é cadastrada — ou seja, o perfil
   * pode mudar sem que ninguém tenha pedido para mudá-lo. Por isso TODA
   * mutação de alergia invalida também o perfil: sem isto, a tela seguiria
   * mostrando "você declarou não ter alergia" com a alergia recém-cadastrada
   * logo acima, que é exatamente a contradição que a 0049 existe para impedir.
   *
   * `patientId` aqui é o id do perfil (allergies.patient_id → profiles.id),
   * então é a mesma chave de `queryKeys.profile`.
   */
  const invalidateComPerfil = () => {
    invalidate();
    qc.invalidateQueries({ queryKey: queryKeys.profile(patientId) });
  };
  return {
    create: useMutation({
      mutationFn: (row: InsertRow<'allergies'>) => createAllergy(client, row),
      onSuccess: invalidateComPerfil,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteAllergy(client, id), onSuccess: invalidate }),
    /** Declara que o paciente NÃO tem alergia conhecida (grava o instante). */
    declararSemAlergia: useMutation({
      mutationFn: () => declareNoKnownAllergy(client, patientId),
      onSuccess: invalidateComPerfil,
    }),
    /**
     * Desfaz a declaração. É a mais importante das duas: a pessoa pode
     * descobrir uma alergia depois, e o caminho de volta não pode ser mais
     * difícil que o de ida.
     */
    desfazerSemAlergia: useMutation({
      mutationFn: () => undoNoKnownAllergy(client, patientId),
      onSuccess: invalidateComPerfil,
    }),
  };
}

// ── Cirurgias ───────────────────────────────────────────────────────────────
export function useSurgeries(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.surgeries(patientId ?? ''),
    queryFn: () => listSurgeries(client, patientId as string),
    enabled: Boolean(patientId),
  });
}
export function useSurgeryMutations(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.surgeries(patientId) });
  return {
    create: useMutation({ mutationFn: (row: InsertRow<'surgeries'>) => createSurgery(client, row), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => deleteSurgery(client, id), onSuccess: invalidate }),
    attachReport: useMutation({
      mutationFn: async ({
        surgeryId,
        file,
        previousPath,
      }: {
        surgeryId: string;
        file: SurgeryReportSource;
        previousPath?: string | null;
      }) => {
        const path = await uploadSurgeryReportFile(client, patientId, file);
        try {
          const updated = await setSurgeryReport(client, surgeryId, path);
          // Troca de laudo: o arquivo antigo sai por último e best-effort — órfão
          // no storage é o mal menor frente a uma linha apontando pra arquivo morto.
          if (previousPath) await removeSurgeryReportFile(client, previousPath).catch(() => undefined);
          return updated;
        } catch (error) {
          await removeSurgeryReportFile(client, path).catch(() => undefined);
          throw error;
        }
      },
      onSuccess: invalidate,
    }),
    removeReport: useMutation({
      mutationFn: async ({ surgeryId, reportPath }: { surgeryId: string; reportPath: string }) => {
        const updated = await setSurgeryReport(client, surgeryId, null);
        await removeSurgeryReportFile(client, reportPath).catch(() => undefined);
        return updated;
      },
      onSuccess: invalidate,
    }),
    reportUrl: useMutation({
      mutationFn: (reportPath: string) => getSurgeryReportSignedUrl(client, reportPath),
    }),
  };
}

// ── Antecedentes familiares ─────────────────────────────────────────────────
export function useFamilyHistory(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.familyHistory(patientId ?? ''),
    queryFn: () => listFamilyHistory(client, patientId as string),
    enabled: Boolean(patientId),
  });
}
export function useFamilyHistoryMutations(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.familyHistory(patientId) });
  return {
    create: useMutation({ mutationFn: (row: InsertRow<'family_history'>) => createFamilyHistory(client, row), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => deleteFamilyHistory(client, id), onSuccess: invalidate }),
  };
}

// ── Convênio ────────────────────────────────────────────────────────────────
export function useInsurance(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.insurance(patientId ?? ''),
    queryFn: () => getPrimaryInsurance(client, patientId as string),
    enabled: Boolean(patientId),
  });
}
export function useUpsertInsurance(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Omit<InsertRow<'insurance_plans'>, 'patient_id'>) =>
      upsertPrimaryInsurance(client, patientId, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.insurance(patientId) }),
  });
}
