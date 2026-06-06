'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { insuranceSchema, type InsuranceInput, type InsurancePlan } from '@vidalog/core';
import { useUpsertInsurance } from '@vidalog/supabase';
import { Button, Field, Input } from '@/components/ui';

export function InsuranceForm({ patientId, insurance }: { patientId: string; insurance: InsurancePlan | null }) {
  const upsert = useUpsertInsurance(patientId);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<InsuranceInput>({
    resolver: zodResolver(insuranceSchema),
    defaultValues: {
      operator: insurance?.operator ?? '',
      cardNumber: insurance?.card_number ?? '',
      validUntil: insurance?.valid_until ? new Date(insurance.valid_until) : undefined,
      isPrimary: insurance?.is_primary ?? true,
    },
  });

  async function onSubmit(values: InsuranceInput) {
    try {
      await upsert.mutateAsync({
        operator: values.operator,
        card_number: values.cardNumber || null,
        valid_until: values.validUntil ? values.validUntil.toISOString().slice(0, 10) : null,
        is_primary: values.isPrimary,
      });
      toast.success('Convênio salvo.');
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Operadora" htmlFor="op" error={errors.operator?.message}>
          <Input id="op" {...register('operator')} placeholder="Ex.: Unimed" />
        </Field>
        <Field label="Nº da carteirinha" htmlFor="card" error={errors.cardNumber?.message}>
          <Input id="card" {...register('cardNumber')} />
        </Field>
        <Field label="Validade" htmlFor="valid" error={errors.validUntil?.message}>
          <Input id="valid" type="date" {...register('validUntil')} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={upsert.isPending || !isDirty}>
          {upsert.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
