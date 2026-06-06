'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { surgerySchema, type SurgeryInput } from '@vidalog/core';
import { useSurgeries, useSurgeryMutations } from '@vidalog/supabase';
import { Button, Field, Input } from '@/components/ui';

export function SurgeriesSection({ patientId }: { patientId: string }) {
  const { data: surgeries } = useSurgeries(patientId);
  const { create, remove } = useSurgeryMutations(patientId);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SurgeryInput>({
    resolver: zodResolver(surgerySchema),
  });

  async function onAdd(values: SurgeryInput) {
    try {
      await create.mutateAsync({
        patient_id: patientId,
        procedure: values.procedure,
        performed_at: values.performedAt ? values.performedAt.toISOString().slice(0, 10) : null,
        hospital: values.hospital || null,
        notes: values.notes || null,
      });
      reset({ procedure: '', hospital: '' });
      toast.success('Cirurgia adicionada.');
    } catch {
      toast.error('Não foi possível adicionar.');
    }
  }

  return (
    <div className="space-y-4">
      {surgeries && surgeries.length > 0 ? (
        <ul className="space-y-2">
          {surgeries.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{s.procedure}</p>
                <p className="text-xs text-muted">
                  {s.performed_at ? new Date(s.performed_at).toLocaleDateString('pt-BR') : 'Data não informada'}
                  {s.hospital ? ` · ${s.hospital}` : ''}
                </p>
              </div>
              <button onClick={() => remove.mutate(s.id)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-400" aria-label="Remover">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhuma cirurgia registrada.</p>
      )}

      <form onSubmit={handleSubmit(onAdd)} className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-2" noValidate>
        <Field label="Procedimento" htmlFor="su-proc" error={errors.procedure?.message}>
          <Input id="su-proc" {...register('procedure')} placeholder="Ex.: Apendicectomia" />
        </Field>
        <Field label="Data" htmlFor="su-date"><Input id="su-date" type="date" {...register('performedAt')} /></Field>
        <Field label="Hospital" htmlFor="su-hosp"><Input id="su-hosp" {...register('hospital')} /></Field>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adicionando…' : 'Adicionar cirurgia'}</Button>
        </div>
      </form>
    </div>
  );
}
