'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { profileSchema, type ProfileInput, formatCPF, BLOOD_TYPES, BIOLOGICAL_SEX_LABELS, type Profile } from '@hubpatients/core';
import { useUpdateProfile } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';

type Address = { zip?: string; street?: string; number?: string; city?: string; state?: string };

export function PersonalDataForm({ userId, profile }: { userId: string; profile: Profile | null }) {
  const update = useUpdateProfile(userId);
  const addr = (profile?.address ?? {}) as Address;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name ?? '',
      dateOfBirth: profile?.date_of_birth ? new Date(profile.date_of_birth) : undefined,
      biologicalSex: profile?.biological_sex ?? 'unspecified',
      bloodType: profile?.blood_type ?? 'unknown',
      phone: profile?.phone ?? '',
      cpf: profile?.cpf ?? '',
      address: { zip: addr.zip ?? '', street: addr.street ?? '', number: addr.number ?? '', city: addr.city ?? '', state: addr.state ?? '' },
      heightCm: profile?.height_cm ?? undefined,
      emergencyNote: profile?.emergency_note ?? '',
    },
  });

  async function onSubmit(values: ProfileInput) {
    try {
      await update.mutateAsync({
        full_name: values.fullName,
        date_of_birth: values.dateOfBirth ? values.dateOfBirth.toISOString().slice(0, 10) : null,
        biological_sex: values.biologicalSex,
        blood_type: values.bloodType,
        phone: values.phone || null,
        cpf: values.cpf || null,
        address: values.address ?? {},
        height_cm: values.heightCm ?? null,
        emergency_note: values.emergencyNote || null,
      });
      toast.success('Dados pessoais salvos.');
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  const cpfValue = watch('cpf');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" htmlFor="fullName" error={errors.fullName?.message}>
          <Input id="fullName" {...register('fullName')} />
        </Field>
        <Field label="Data de nascimento" htmlFor="dob" error={errors.dateOfBirth?.message}>
          <Input id="dob" type="date" {...register('dateOfBirth')} />
        </Field>
        <Field label="CPF" htmlFor="cpf" error={errors.cpf?.message}>
          <Input
            id="cpf"
            inputMode="numeric"
            value={cpfValue ?? ''}
            onChange={(e) => setValue('cpf', formatCPF(e.target.value), { shouldDirty: true })}
            placeholder="000.000.000-00"
          />
        </Field>
        <Field label="Telefone" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" {...register('phone')} placeholder="(11) 90000-0000" />
        </Field>
        <Field label="Altura (cm)" htmlFor="height" error={errors.heightCm?.message}>
          <Input id="height" type="number" inputMode="decimal" {...register('heightCm')} placeholder="170" />
        </Field>
        <Field label="Sexo biológico" htmlFor="sex">
          <select id="sex" {...register('biologicalSex')} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
            {Object.entries(BIOLOGICAL_SEX_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Tipo sanguíneo" htmlFor="blood">
          <select id="blood" {...register('bloodType')} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
            {BLOOD_TYPES.map((b) => (
              <option key={b} value={b}>{b === 'unknown' ? 'Não sei' : b}</option>
            ))}
          </select>
        </Field>
      </div>

      <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted">Endereço</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CEP" htmlFor="zip"><Input id="zip" {...register('address.zip')} /></Field>
        <Field label="Rua" htmlFor="street"><Input id="street" {...register('address.street')} /></Field>
        <Field label="Número" htmlFor="num"><Input id="num" {...register('address.number')} /></Field>
        <Field label="Cidade" htmlFor="city"><Input id="city" {...register('address.city')} /></Field>
        <Field label="Estado (UF)" htmlFor="state"><Input id="state" maxLength={2} {...register('address.state')} /></Field>
      </div>

      <Field label="Observação de emergência" htmlFor="emerg" error={errors.emergencyNote?.message}>
        <Input id="emerg" {...register('emergencyNote')} placeholder="Ex.: marca-passo, anticoagulante…" />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending || !isDirty}>
          {update.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
