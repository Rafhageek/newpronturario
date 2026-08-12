'use client';

import { useState } from 'react';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  profileSchema,
  type ProfileInput,
  formatCPF,
  BLOOD_TYPES,
  BIOLOGICAL_SEX_LABELS,
  BIOLOGICAL_SEX_OPTIONS,
  maskCEP,
  isValidCEP,
  lookupCep,
  type Profile,
} from '@hubpatients/core';
import { useUpdateProfile } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';

type Address = {
  zip?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

/**
 * O que vive DENTRO do formulário não é o que sai dele.
 *
 * Um `<input type="date">` só aceita a string `AAAA-MM-DD`: se o valor inicial
 * for um objeto `Date`, o navegador descarta o que não reconhece e o campo abre
 * VAZIO para quem JÁ tinha data de nascimento gravada — o dado continua no
 * banco, mas a tela diz "o app perdeu meu cadastro" e a pessoa redigita.
 * O mesmo vale para `type="number"`, que guarda texto enquanto se digita.
 *
 * Por isso a ENTRADA é string. A SAÍDA continua sendo `ProfileInput`
 * (`dateOfBirth: Date | undefined`, `heightCm: number | undefined`): o
 * `profileSchema` converte no `zodResolver`, e é ele que o `onSubmit` recebe.
 */
type ProfileFormValues = Omit<ProfileInput, 'dateOfBirth' | 'heightCm'> & {
  dateOfBirth?: string;
  heightCm?: string | number;
};

export function PersonalDataForm({ userId, profile }: { userId: string; profile: Profile | null }) {
  const update = useUpdateProfile(userId);
  const addr = (profile?.address ?? {}) as Address;
  const [buscandoCep, setBuscandoCep] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues, unknown, ProfileInput>({
    /**
     * O `zodResolver` entrega o valor JÁ convertido pelo schema (`Date`,
     * `number`), mas a tipagem do `@hookform/resolvers` v3 ainda supõe que a
     * saída é igual à entrada. A conversão declara o que ele realmente
     * devolve — é o que mantém o `onSubmit` recebendo `ProfileInput`.
     */
    resolver: zodResolver(profileSchema) as Resolver<ProfileFormValues, unknown, ProfileInput>,
    defaultValues: {
      fullName: profile?.full_name ?? '',
      // `AAAA-MM-DD` é o único formato que o campo de data aceita de volta.
      dateOfBirth: profile?.date_of_birth ? profile.date_of_birth.slice(0, 10) : '',
      biologicalSex: profile?.biological_sex ?? 'unspecified',
      bloodType: profile?.blood_type ?? 'unknown',
      phone: profile?.phone ?? '',
      cpf: profile?.cpf ?? '',
      address: {
        zip: addr.zip ?? '',
        street: addr.street ?? '',
        number: addr.number ?? '',
        neighborhood: addr.neighborhood ?? '',
        city: addr.city ?? '',
        state: addr.state ?? '',
      },
      heightCm: profile?.height_cm != null ? String(profile.height_cm) : '',
      emergencyNote: profile?.emergency_note ?? '',
    },
  });

  /**
   * Preenche o endereço a partir do CEP. Só escreve em campo VAZIO: se a
   * pessoa já digitou a rua, o serviço não sobrescreve. Falha é silenciosa —
   * ela digita à mão, e o cadastro não trava por um serviço externo fora do ar.
   */
  async function buscarCep(valor: string) {
    if (!isValidCEP(valor)) return;
    setBuscandoCep(true);
    try {
      const found = await lookupCep(valor);
      if (!found) return;
      const preencher = (campo: 'street' | 'neighborhood' | 'city' | 'state', novo: string) => {
        if (!novo) return;
        const atual = (watch(`address.${campo}`) ?? '').trim();
        if (!atual) setValue(`address.${campo}`, novo, { shouldDirty: true });
      };
      preencher('street', found.street);
      preencher('neighborhood', found.neighborhood);
      preencher('city', found.city);
      preencher('state', found.state);
    } finally {
      setBuscandoCep(false);
    }
  }

  /**
   * Rede de segurança: reprovar não pode virar silêncio. Cada campo já mostra
   * a própria mensagem abaixo dele, mas o aviso alcança quem clicou em
   * "Salvar" com o campo inválido fora da tela — foi o "cliquei e não
   * aconteceu nada" que gerou a queixa do cliente.
   */
  function onInvalid(erros: FieldErrors<ProfileFormValues>) {
    const primeira = Object.values(erros).find(
      (e) => typeof e?.message === 'string' && e.message.length > 0,
    )?.message;
    toast.error(
      typeof primeira === 'string'
        ? `Não foi possível salvar: ${primeira}`
        : 'Não foi possível salvar. Confira os campos com aviso e tente de novo.',
    );
  }

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
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>
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
        <Field label="Sexo biológico" htmlFor="sex" error={errors.biologicalSex?.message}>
          <select id="sex" {...register('biologicalSex')} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
            {BIOLOGICAL_SEX_OPTIONS.map((k) => (
              <option key={k} value={k}>{BIOLOGICAL_SEX_LABELS[k]}</option>
            ))}
          </select>
        </Field>
        <Field label="Tipo sanguíneo" htmlFor="blood" error={errors.bloodType?.message}>
          <select id="blood" {...register('bloodType')} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
            {BLOOD_TYPES.map((b) => (
              <option key={b} value={b}>{b === 'unknown' ? 'Não sei' : b}</option>
            ))}
          </select>
        </Field>
      </div>

      <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted">Endereço</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={buscandoCep ? 'CEP (buscando…)' : 'CEP'}
          htmlFor="zip"
          error={errors.address?.zip?.message}
        >
          <Input
            id="zip"
            inputMode="numeric"
            maxLength={9}
            {...register('address.zip')}
            onChange={(e) => {
              const masked = maskCEP(e.target.value);
              setValue('address.zip', masked, { shouldDirty: true });
              if (isValidCEP(masked)) void buscarCep(masked);
            }}
            onBlur={(e) => void buscarCep(e.target.value)}
          />
        </Field>
        <Field label="Rua" htmlFor="street" error={errors.address?.street?.message}>
          <Input id="street" {...register('address.street')} />
        </Field>
        <Field label="Número" htmlFor="num" error={errors.address?.number?.message}>
          <Input id="num" {...register('address.number')} />
        </Field>
        <Field label="Bairro" htmlFor="neighborhood" error={errors.address?.neighborhood?.message}>
          <Input id="neighborhood" {...register('address.neighborhood')} />
        </Field>
        <Field label="Cidade" htmlFor="city" error={errors.address?.city?.message}>
          <Input id="city" {...register('address.city')} />
        </Field>
        <Field label="Estado (UF)" htmlFor="state" error={errors.address?.state?.message}>
          <Input id="state" maxLength={2} {...register('address.state')} />
        </Field>
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
