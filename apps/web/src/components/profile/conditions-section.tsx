'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  conditionSchema,
  type ConditionInput,
  CID10_COMMON,
  CONDITION_STATUS_LABELS,
} from '@vidalog/core';
import { useConditions, useConditionMutations } from '@vidalog/supabase';
import { Button, Field, Input } from '@/components/ui';

export function ConditionsSection({ patientId }: { patientId: string }) {
  const { data: conditions } = useConditions(patientId);
  const { create, remove } = useConditionMutations(patientId);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ConditionInput>({
    resolver: zodResolver(conditionSchema),
    defaultValues: { status: 'active' },
  });

  async function onAdd(values: ConditionInput) {
    try {
      await create.mutateAsync({
        patient_id: patientId,
        name: values.name,
        cid10_code: values.cid10Code || null,
        status: values.status,
        diagnosed_at: values.diagnosedAt ? values.diagnosedAt.toISOString().slice(0, 10) : null,
        notes: values.notes || null,
      });
      reset({ name: '', cid10Code: '', status: 'active', notes: '' });
      toast.success('Condição adicionada.');
    } catch {
      toast.error('Não foi possível adicionar.');
    }
  }

  return (
    <div className="space-y-4">
      {conditions && conditions.length > 0 ? (
        <ul className="space-y-2">
          {conditions.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">
                  {c.name} {c.cid10_code && <span className="text-xs text-muted">({c.cid10_code})</span>}
                </p>
                <p className="text-xs text-muted">{CONDITION_STATUS_LABELS[c.status]}</p>
              </div>
              <button onClick={() => remove.mutate(c.id)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-400" aria-label="Remover">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhuma condição registrada.</p>
      )}

      <form onSubmit={handleSubmit(onAdd)} className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-2" noValidate>
        <Field label="Condição" htmlFor="cond-name" error={errors.name?.message}>
          <Input id="cond-name" list="cid10-list" {...register('name')} placeholder="Ex.: Hipertensão" />
          <datalist id="cid10-list">
            {CID10_COMMON.map((c) => (
              <option key={c.code} value={c.label}>{c.code}</option>
            ))}
          </datalist>
        </Field>
        <Field label="CID-10" htmlFor="cond-cid"><Input id="cond-cid" {...register('cid10Code')} placeholder="Ex.: I10" /></Field>
        <Field label="Status" htmlFor="cond-status">
          <select id="cond-status" {...register('status')} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
            {Object.entries(CONDITION_STATUS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
        </Field>
        <Field label="Diagnóstico em" htmlFor="cond-date"><Input id="cond-date" type="date" {...register('diagnosedAt')} /></Field>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adicionando…' : 'Adicionar condição'}</Button>
        </div>
      </form>
    </div>
  );
}
