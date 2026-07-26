'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { familyHistorySchema, type FamilyHistoryInput, FAMILY_RELATIONSHIP_LABELS } from '@hubpatients/core';
import { useFamilyHistory, useFamilyHistoryMutations } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';

export function FamilyHistorySection({ patientId }: { patientId: string }) {
  const { data: items } = useFamilyHistory(patientId);
  const { create, remove } = useFamilyHistoryMutations(patientId);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FamilyHistoryInput>({
    resolver: zodResolver(familyHistorySchema),
    defaultValues: { relationship: 'other' },
  });

  async function onAdd(values: FamilyHistoryInput) {
    try {
      await create.mutateAsync({
        patient_id: patientId,
        condition: values.condition,
        relationship: values.relationship,
        notes: values.notes || null,
      });
      reset({ condition: '', relationship: 'other' });
      toast.success('Antecedente adicionado.');
    } catch {
      toast.error('Não foi possível adicionar.');
    }
  }

  return (
    <div className="space-y-4">
      {items && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((f) => (
            <li key={f.id} className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <p className="truncate text-sm text-fg">
                {f.condition} <span className="text-xs text-muted">· {FAMILY_RELATIONSHIP_LABELS[f.relationship]}</span>
              </p>
              <button onClick={() => remove.mutate(f.id)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-status-alert-ink" aria-label="Remover">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhum antecedente registrado.</p>
      )}

      <form onSubmit={handleSubmit(onAdd)} className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-2" noValidate>
        <Field label="Condição" htmlFor="fh-cond" error={errors.condition?.message}>
          <Input id="fh-cond" {...register('condition')} placeholder="Ex.: Diabetes" />
        </Field>
        <Field label="Parentesco" htmlFor="fh-rel">
          <select id="fh-rel" {...register('relationship')} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
            {Object.entries(FAMILY_RELATIONSHIP_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
        </Field>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adicionando…' : 'Adicionar antecedente'}</Button>
        </div>
      </form>
    </div>
  );
}
