'use client';

import type { ChangeEvent } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  conditionSchema,
  type ConditionInput,
  CID10_COMMON,
  CONDITION_STATUS_LABELS,
} from '@hubpatients/core';
import { useConditions, useConditionMutations } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';

export function ConditionsSection({ patientId }: { patientId: string }) {
  // Mesma regra das alergias: lista vazia só vira "nenhuma" com `isSuccess`.
  const { data: conditions, isSuccess, isError } = useConditions(patientId);
  const { create, remove } = useConditionMutations(patientId);

  const { register, handleSubmit, reset, setValue, getValues, formState: { errors } } = useForm<ConditionInput>({
    resolver: zodResolver(conditionSchema),
    defaultValues: { status: 'active' },
  });

  // Condição ↔ CID-10 andam juntos no catálogo do DATASUS: escolher um preenche o outro.
  function preencheCidPelaCondicao(e: ChangeEvent<HTMLInputElement>) {
    const match = CID10_COMMON.find((c) => c.label === e.target.value);
    if (match) setValue('cid10Code', match.code);
  }

  function preencheCondicaoPeloCid(e: ChangeEvent<HTMLInputElement>) {
    const code = e.target.value.trim().toUpperCase();
    const match = CID10_COMMON.find((c) => c.code === code);
    if (match && !getValues('name')) setValue('name', match.label);
  }

  /**
   * Rede de segurança: reprovar não pode virar silêncio. Cada campo já mostra
   * a própria mensagem, mas o aviso alcança quem não estava olhando para a
   * parte do formulário que reprovou.
   */
  function onInvalid(erros: FieldErrors<ConditionInput>) {
    const primeira = Object.values(erros).find(
      (e) => typeof e?.message === 'string' && e.message.length > 0,
    )?.message;
    toast.error(
      typeof primeira === 'string'
        ? `Não foi possível adicionar: ${primeira}`
        : 'Não foi possível adicionar. Confira os campos com aviso e tente de novo.',
    );
  }

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
              <button onClick={() => remove.mutate(c.id)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-status-alert-ink" aria-label="Remover">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : isSuccess ? (
        <p className="text-sm text-muted">Nenhuma condição registrada.</p>
      ) : (
        <p className="text-sm text-muted">
          {isError
            ? 'Não foi possível carregar esta seção. O prontuário pode ter registros que não aparecem aqui.'
            : 'Carregando suas condições…'}
        </p>
      )}

      <form onSubmit={handleSubmit(onAdd, onInvalid)} className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-2" noValidate>
        {/* autoComplete="off" + autoCorrect: sem isso o Safari sobrepõe contatos e cartões
            salvos do usuário ao datalist clínico (visto em produção nos campos Condição e CID). */}
        <Field label="Condição" htmlFor="cond-name" error={errors.name?.message}>
          <Input
            id="cond-name"
            list="cid10-list"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            {...register('name', { onChange: preencheCidPelaCondicao })}
            placeholder="Ex.: Hipertensão"
          />
          <datalist id="cid10-list">
            {CID10_COMMON.map((c) => (
              <option key={c.code} value={c.label}>{c.code}</option>
            ))}
          </datalist>
        </Field>
        <Field label="CID-10" htmlFor="cond-cid" error={errors.cid10Code?.message}>
          <Input
            id="cond-cid"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            {...register('cid10Code', { onChange: preencheCondicaoPeloCid })}
            placeholder="Ex.: I10"
          />
        </Field>
        <Field label="Status" htmlFor="cond-status" error={errors.status?.message}>
          <select id="cond-status" {...register('status')} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
            {Object.entries(CONDITION_STATUS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
        </Field>
        {/* A data é opcional, mas uma data que não existe ("31/02") reprova de
            propósito. Sem esta mensagem o clique em "Adicionar" volta a ser o
            silêncio que gerou a queixa do cliente. */}
        <Field label="Diagnóstico em" htmlFor="cond-date" error={errors.diagnosedAt?.message}>
          <Input id="cond-date" type="date" {...register('diagnosedAt')} />
        </Field>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adicionando…' : 'Adicionar condição'}</Button>
        </div>
      </form>
    </div>
  );
}
