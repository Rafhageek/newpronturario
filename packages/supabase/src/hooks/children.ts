'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChildSex } from '@hubpatients/core';
import { useHubPatientsClient } from './context';
import { queryKeys } from './keys';
import {
  listChildren,
  getChild,
  addChild,
  listGrowth,
  addMeasurement,
  listChildMilestones,
  markMilestone,
  listChildVaccinations,
  recordVaccine,
  getMilestoneCatalog,
  getVaccineSchedule,
  getWhoStandard,
} from '../queries/children';

export function useChildren(enabled = true) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.children(),
    queryFn: () => listChildren(client),
    enabled,
  });
}

export function useChild(childId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.child(childId ?? ''),
    queryFn: () => getChild(client, childId as string),
    enabled: Boolean(childId),
  });
}

export function useAddChild(parentId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof addChild>[2]) => addChild(client, parentId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.children() }),
  });
}

export function useChildGrowth(childId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.childGrowth(childId ?? ''),
    queryFn: () => listGrowth(client, childId as string),
    enabled: Boolean(childId),
  });
}

export function useAddMeasurement(childId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ageMonths, input }: { ageMonths: number; input: Parameters<typeof addMeasurement>[3] }) =>
      addMeasurement(client, childId, ageMonths, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.childGrowth(childId) }),
  });
}

export function useChildMilestones(childId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.childMilestones(childId ?? ''),
    queryFn: () => listChildMilestones(client, childId as string),
    enabled: Boolean(childId),
  });
}

export function useMarkMilestone(childId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, achievedAt }: { code: string; achievedAt: string | null }) =>
      markMilestone(client, childId, code, achievedAt),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.childMilestones(childId) }),
  });
}

export function useChildVaccinations(childId: string | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.childVaccinations(childId ?? ''),
    queryFn: () => listChildVaccinations(client, childId as string),
    enabled: Boolean(childId),
  });
}

export function useRecordVaccine(childId: string, parentId: string) {
  const client = useHubPatientsClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof recordVaccine>[3]) =>
      recordVaccine(client, childId, parentId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.childVaccinations(childId) }),
  });
}

export function useMilestoneCatalog() {
  const client = useHubPatientsClient();
  return useQuery({ queryKey: queryKeys.milestoneCatalog(), queryFn: () => getMilestoneCatalog(client), staleTime: 60 * 60 * 1000 });
}

export function useVaccineSchedule() {
  const client = useHubPatientsClient();
  return useQuery({ queryKey: queryKeys.vaccineSchedule(), queryFn: () => getVaccineSchedule(client), staleTime: 60 * 60 * 1000 });
}

export function useWhoStandard(indicator: string | undefined, sex: ChildSex | undefined) {
  const client = useHubPatientsClient();
  return useQuery({
    queryKey: queryKeys.whoStandard(indicator ?? '', sex ?? ''),
    queryFn: () => getWhoStandard(client, indicator as string, sex as ChildSex),
    enabled: Boolean(indicator && sex),
    staleTime: 60 * 60 * 1000,
  });
}
