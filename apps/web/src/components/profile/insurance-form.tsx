'use client';

import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { insuranceSchema, type InsuranceInput, type InsurancePlan } from '@hubpatients/core';
import { useUpsertInsurance } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';

/**
 * O que vive DENTRO do formulário não é o que sai dele — o mesmo desenho já
 * aplicado em `personal-data-form.tsx`, e pelo mesmo motivo.
 *
 * Um `<input type="date">` só aceita a string `AAAA-MM-DD`. O valor inicial
 * daqui era um objeto `Date`: o navegador não reconhece, DESCARTA em silêncio
 * e o campo Validade abre VAZIO para quem já tinha validade gravada. É
 * exatamente a queixa que o cliente fez sobre a data de nascimento — a pessoa
 * lê "o app perdeu meu convênio" e redigita. Não havia perda de dado (o valor
 * seguia no banco e no React Hook Form), mas a tela mentia sobre o cadastro.
 *
 * A ENTRADA passa a ser string; a SAÍDA continua sendo `InsuranceInput`
 * (`validUntil: Date | undefined`), porque é o `insuranceSchema` que converte
 * dentro do `zodResolver` — e string vazia continua significando "não
 * informado" pelo helper `dataOpcional`, sem reprovar o formulário.
 */
type InsuranceFormValues = Omit<InsuranceInput, 'validUntil'> & { validUntil?: string };

export function InsuranceForm({ patientId, insurance }: { patientId: string; insurance: InsurancePlan | null }) {
  const upsert = useUpsertInsurance(patientId);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<InsuranceFormValues, unknown, InsuranceInput>({
    /**
     * O `zodResolver` entrega o valor JÁ convertido pelo schema (`Date`), mas a
     * tipagem do `@hookform/resolvers` v3 ainda supõe que a saída é igual à
     * entrada. A conversão declara o que ele realmente devolve — é o que mantém
     * o `onSubmit` recebendo `InsuranceInput`.
     */
    resolver: zodResolver(insuranceSchema) as Resolver<InsuranceFormValues, unknown, InsuranceInput>,
    defaultValues: {
      operator: insurance?.operator ?? '',
      cardNumber: insurance?.card_number ?? '',
      // `AAAA-MM-DD` é o único formato que o campo de data aceita de volta.
      validUntil: insurance?.valid_until ? insurance.valid_until.slice(0, 10) : '',
      isPrimary: insurance?.is_primary ?? true,
    },
  });

  /**
   * Rede de segurança igual à das cirurgias: reprovar não pode virar silêncio.
   * O `handleSubmit` só chama o `onSubmit` quando a validação passa — sem este
   * aviso, uma validade impossível ("31/02") fazia o clique em "Salvar" não
   * fazer absolutamente nada visível.
   */
  function onInvalid(erros: FieldErrors<InsuranceFormValues>) {
    const primeira = Object.values(erros).find(
      (e) => typeof e?.message === 'string' && e.message.length > 0,
    )?.message;
    toast.error(
      typeof primeira === 'string'
        ? `Não foi possível salvar: ${primeira}`
        : 'Não foi possível salvar. Confira os campos com aviso e tente de novo.',
    );
  }

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
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Operadora" htmlFor="op" error={errors.operator?.message}>
          <Input id="op" autoComplete="off" {...register('operator')} placeholder="Ex.: Unimed" />
        </Field>
        {/* O número da carteirinha é código, não palavra: correção automática e
            verificação ortográfica só atrapalham quem digita 16 dígitos. A
            fonte Atkinson já distingue 0/O e 1/I/l. */}
        <Field label="Nº da carteirinha" htmlFor="card" error={errors.cardNumber?.message}>
          <Input id="card" autoComplete="off" autoCorrect="off" spellCheck={false} {...register('cardNumber')} />
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
