'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { allergySchema, type AllergyInput, ALLERGY_SEVERITY } from '@hubpatients/core';
import { useAllergies, useAllergyMutations } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';

export function AllergiesSection({ patientId }: { patientId: string }) {
  const { data: allergies } = useAllergies(patientId);
  const { create, remove } = useAllergyMutations(patientId);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AllergyInput>({
    resolver: zodResolver(allergySchema),
    defaultValues: { severity: 'moderate' },
  });

  async function onAdd(values: AllergyInput) {
    try {
      await create.mutateAsync({
        patient_id: patientId,
        substance: values.substance,
        severity: values.severity,
        reaction: values.reaction || null,
        notes: values.notes || null,
      });
      reset({ substance: '', severity: 'moderate', reaction: '' });
      toast.success('Alergia adicionada.');
    } catch {
      toast.error('Não foi possível adicionar.');
    }
  }

  return (
    <div className="space-y-4">
      {allergies && allergies.length > 0 ? (
        <ul className="space-y-2">
          {allergies.map((a) => {
            const meta = ALLERGY_SEVERITY[a.severity];
            const alert = meta.tone === 'alert';
            return (
              <li
                key={a.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${alert ? 'border-rose-500/30 bg-rose-500/10' : 'border-amber-500/20 bg-amber-500/[0.06]'}`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {alert && <AlertTriangle className="h-4 w-4 shrink-0 text-status-alert-ink" />}
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-medium ${alert ? 'text-rose-700 dark:text-rose-200' : 'text-amber-100'}`}>
                      {a.substance} · {meta.label}
                    </p>
                    {a.reaction && <p className="truncate text-xs text-muted">{a.reaction}</p>}
                  </div>
                </div>
                <button onClick={() => { if (confirmAction(`Remover a alergia "${a.substance}"? Essa informação é importante para sua segurança em emergências.`)) remove.mutate(a.id); }} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-status-alert-ink" aria-label={`Remover alergia ${a.substance}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhuma alergia registrada.</p>
      )}

      <form onSubmit={handleSubmit(onAdd)} className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-2" noValidate>
        <Field label="Substância" htmlFor="al-sub" error={errors.substance?.message}>
          <Input id="al-sub" {...register('substance')} placeholder="Ex.: Penicilina" />
        </Field>
        <Field label="Gravidade" htmlFor="al-sev">
          <select id="al-sev" {...register('severity')} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
            {Object.entries(ALLERGY_SEVERITY).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
          </select>
        </Field>
        <Field label="Reação" htmlFor="al-react"><Input id="al-react" {...register('reaction')} placeholder="Ex.: urticária" /></Field>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adicionando…' : 'Adicionar alergia'}</Button>
        </div>
      </form>
    </div>
  );
}
