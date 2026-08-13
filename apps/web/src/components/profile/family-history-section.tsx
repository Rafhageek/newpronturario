'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { familyHistorySchema, type FamilyHistoryInput, FAMILY_RELATIONSHIP_LABELS } from '@hubpatients/core';
import { useFamilyHistory, useFamilyHistoryMutations } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';

export function FamilyHistorySection({ patientId }: { patientId: string }) {
  // Mesma regra das cirurgias e das alergias: lista vazia só pode virar a
  // frase "nenhum" com `isSuccess`. Sem isso, o app AFIRMAVA que não há
  // antecedente familiar enquanto ainda estava carregando — e continuava
  // afirmando quando a consulta FALHAVA. Num prontuário, "não tem" dito por
  // engano é pior que "não sei": quem lê fecha a tela achando que perguntou.
  const { data: items, isSuccess, isError } = useFamilyHistory(patientId);
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
            <li key={f.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              {/*
               * LEGIBILIDADE 50+ — mesma varredura das cirurgias. A condição
               * estava em 14px e o parentesco (a metade que diz DE QUEM é o
               * antecedente) em 12px + `--muted`, dentro de um `truncate`.
               * Foram para o piso das telas já revisadas: 17px na condição e
               * 15px no parentesco.
               *
               * Tinta medida (WCAG 2.x) sobre o fundo real do item
               * (`--surface-2`) — o parentesco saiu de `muted` para `fg-soft`:
               *   claro  #f7f8fc: 5,56:1 → 9,80:1
               *   escuro #212121: 7,04:1 → 10,82:1
               *
               * Sem o `truncate`: "Diabetes · Mãe" cortado em "Diabetes · M…"
               * apaga justamente o parentesco, que é o dado clínico da linha.
               */}
              <p className="min-w-0 text-body leading-snug text-fg [overflow-wrap:anywhere]">
                {f.condition}{' '}
                <span className="text-body-sm text-fg-soft">
                  · {FAMILY_RELATIONSHIP_LABELS[f.relationship]}
                </span>
              </p>
              <button onClick={() => remove.mutate(f.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-status-alert-ink" aria-label={`Remover antecedente ${f.condition}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : isSuccess ? (
        <p className="text-body-sm text-fg-soft">Nenhum antecedente registrado.</p>
      ) : (
        <p className="text-body-sm text-fg-soft">
          {isError
            ? 'Não foi possível carregar esta seção. O prontuário pode ter registros que não aparecem aqui.'
            : 'Carregando os antecedentes familiares…'}
        </p>
      )}

      <form onSubmit={handleSubmit(onAdd)} className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-2" noValidate>
        <Field label="Condição" htmlFor="fh-cond" error={errors.condition?.message}>
          <Input id="fh-cond" {...register('condition')} placeholder="Ex.: Diabetes" />
        </Field>
        <Field label="Parentesco" htmlFor="fh-rel">
          {/* Alinhado ao <Input> de components/ui.tsx: mesmo degrau de texto
              (`text-body-sm`, 15px, contra os 14px de antes) e, sobretudo,
              `border-line-strong` no lugar de `border-line`. A `--line` é
              DECORATIVA (separador) e não cumpre os 3:1 que a SC 1.4.11 exige
              da borda de um controle — este era o único campo do Perfil em que
              a moldura não se via. `min-h-11` em vez de `h-11` para o campo
              acompanhar a letra do Modo Sênior em vez de cortá-la. */}
          <select id="fh-rel" {...register('relationship')} className="min-h-11 w-full rounded-chip border border-line-strong bg-surface px-3 text-body-sm text-fg shadow-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
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
