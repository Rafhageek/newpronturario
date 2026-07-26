'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConsentPurpose, Json, UpdateRow } from '@hubpatients/core';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import { listConsents, setConsent, listAuditLog } from '../queries/consent';
import { getSettings, upsertSettings } from '../queries/settings';
import { exportUserData, requestAccountDeletion } from '../queries/account';
import {
  listHealthContent,
  listReadingList,
  addToReadingList,
  removeFromReadingList,
} from '../queries/education';

// ── Consentimento ───────────────────────────────────────────────────────────
export function useConsents(patientId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.consents(patientId ?? ''),
    queryFn: () => listConsents(client, patientId as string),
    enabled: Boolean(patientId),
  });
}

export function useSetConsent(patientId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      purpose,
      granted,
      scope,
      version,
    }: {
      purpose: ConsentPurpose;
      granted: boolean;
      scope: Json;
      /** Versão do texto lido pelo titular (use `CONSENT_TEXT_VERSION`). */
      version?: string;
    }) => setConsent(client, patientId, purpose, granted, scope, version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.consents(patientId) });
      qc.invalidateQueries({ queryKey: ['audit-log', patientId] });
    },
  });
}

// ── Log de acessos (auditoria) ──────────────────────────────────────────────
export function useAuditLog(patientId: string | undefined, page: number, pageSize = 20) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.auditLog(patientId ?? '', page),
    queryFn: () => listAuditLog(client, patientId as string, page, pageSize),
    enabled: Boolean(patientId),
  });
}

// ── Exportar / excluir conta ────────────────────────────────────────────────
export function useExportData(patientId: string) {
  const client = useHubPatientsClient();
  return useMutation({ mutationFn: () => exportUserData(client, patientId) });
}

export function useDeleteAccount() {
  const client = useHubPatientsClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      requestAccountDeletion(client, email, password),
  });
}

// ── Configurações ───────────────────────────────────────────────────────────
export function useUserSettings(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.settings(userId ?? ''),
    queryFn: () => getSettings(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useUpdateSettings(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateRow<'user_settings'>) => upsertSettings(client, userId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings(userId) }),
  });
}

// ── Educação ────────────────────────────────────────────────────────────────
export function useHealthContent() {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.healthContent(),
    queryFn: () => listHealthContent(client),
    staleTime: 30 * 60 * 1000,
  });
}

export function useReadingList(userId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.readingList(userId ?? ''),
    queryFn: () => listReadingList(client, userId as string),
    enabled: Boolean(userId),
  });
}

export function useToggleReadingList(userId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contentId, saved }: { contentId: string; saved: boolean }) =>
      saved ? removeFromReadingList(client, userId, contentId) : addToReadingList(client, userId, contentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.readingList(userId) }),
  });
}
