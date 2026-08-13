'use client';

import { useForm, useController, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  conditionSchema,
  type ConditionInput,
  CONDITION_STATUS_LABELS,
  findCid10ByCode,
  normalizeClinicalText,
  searchCid10,
  type Cid10Category,
} from '@hubpatients/core';
import { useConditions, useConditionMutations } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';
import { ConditionAutocomplete } from '@/components/profile/condition-autocomplete';

/**
 * Categoria cuja descrição oficial é EXATAMENTE o que está escrito no campo.
 *
 * Serve para quem digita ou cola a descrição inteira sem passar pela lista —
 * era o que o `<datalist>` antigo cobria. Comparação sem acento e sem caixa
 * (`normalizeClinicalText`), como o resto da busca clínica.
 */
function achaCategoriaPelaDescricao(texto: string): Cid10Category | null {
  const alvo = normalizeClinicalText(texto);
  if (!alvo) return null;
  return searchCid10(texto, 5).find((c) => normalizeClinicalText(c.description_pt) === alvo) ?? null;
}

export function ConditionsSection({ patientId }: { patientId: string }) {
  // Mesma regra das alergias: lista vazia só vira "nenhuma" com `isSuccess`.
  const { data: conditions, isSuccess, isError } = useConditions(patientId);
  const { create, remove } = useConditionMutations(patientId);

  const { control, register, handleSubmit, reset, setValue, getValues, formState: { errors } } =
    useForm<ConditionInput>({
      resolver: zodResolver(conditionSchema),
      defaultValues: { name: '', cid10Code: '', status: 'active', notes: '' },
    });

  /*
   * Os dois campos de busca são controlados (o autocomplete precisa saber o
   * texto para consultar a base), então entram no formulário por
   * `useController` em vez de `register`. O controle continua registrado: erro,
   * foco no campo inválido e `reset()` seguem funcionando igual.
   *
   * `useController` (e não `<Controller>`) porque o filho DIRETO de <Field> tem
   * que ser o campo: é nele que o <Field> injeta `aria-invalid` e
   * `aria-describedby` (ver o comentário em components/ui.tsx). Um <Controller>
   * no meio receberia essas props e as engoliria.
   */
  const campoNome = useController({ control, name: 'name', defaultValue: '' });
  const campoCid = useController({ control, name: 'cid10Code', defaultValue: '' });

  /*
   * Condição ↔ CID-10 andam juntos no catálogo do DATASUS, e agora sobre a base
   * COMPLETA do projeto (310 categorias oficiais), não sobre as 15 de
   * `CID10_COMMON`. Quem digitou "ateros" e não achou nada foi justamente o
   * cliente — `I70 Aterosclerose` sempre esteve na base, só não estava ligada.
   *
   * Regra de sobrescrita, para o atalho nunca apagar o que a pessoa escreveu:
   *  · escolher na lista da Condição TROCA o código (a escolha é explícita e é
   *    dela que o código sai);
   *  · escolher na lista do CID-10 só preenche a condição se ela estiver VAZIA
   *    — "Aterosclerose de carótida" digitado à mão vale mais que a descrição
   *    genérica do catálogo.
   */
  function escolheuPelaCondicao(categoria: Cid10Category) {
    campoNome.field.onChange(categoria.description_pt);
    setValue('cid10Code', categoria.code, { shouldDirty: true });
  }

  function escolheuPeloCid(categoria: Cid10Category) {
    campoCid.field.onChange(categoria.code);
    if (!getValues('name')?.trim()) setValue('name', categoria.description_pt, { shouldDirty: true });
  }

  function digitouCondicao(texto: string) {
    campoNome.field.onChange(texto);
    if (getValues('cid10Code')?.trim()) return;
    const categoria = achaCategoriaPelaDescricao(texto);
    if (categoria) setValue('cid10Code', categoria.code, { shouldDirty: true });
  }

  function digitouCid(texto: string) {
    campoCid.field.onChange(texto);
    if (getValues('name')?.trim()) return;
    // Aceita "I10" e também o 4º dígito que o médico escreve ("I10.0").
    const categoria = findCid10ByCode(texto);
    if (categoria) setValue('name', categoria.description_pt, { shouldDirty: true });
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
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-chip border border-line bg-surface-2 px-3 py-2.5">
              <div className="min-w-0">
                {/*
                 * LEGIBILIDADE — queixa (c) do cliente: "os caracteres CID10 e
                 * ativa estão clarinhos demais". Os dois estavam em `text-xs`
                 * (12px) + `--muted`, abaixo do piso de 13px do sistema e três
                 * degraus abaixo do corpo do app (17px). Mesmos degraus que o
                 * cabeçalho das seções já adotou (profile/section-card.tsx):
                 * linha principal `text-body`, metadado `text-body-sm`, os dois
                 * em `rem` puro — é o que faz o Modo Sênior levá-los a ~22px e
                 * ~19,5px. Um `text-[Npx]` aqui desligaria o Modo Sênior.
                 *
                 * Tinta, medida com a fórmula da WCAG 2.x contra o fundo REAL
                 * deste item (`--surface-2`), nos quatro temas da casca do app
                 * (`.hp-clinical-shell`):
                 *
                 *                        claro    escuro   AC claro  AC escuro
                 *   muted   (ANTES)      5,56:1   7,04:1    9,52:1   10,34:1
                 *   fg-soft (DEPOIS)     9,80:1  10,82:1   14,13:1   13,75:1
                 *   fg      (o nome)    16,17:1  13,39:1   19,79:1   16,10:1
                 *
                 * O `truncate` do nome SAIU junto com o aumento, e isso não é
                 * opcional: subir a letra na mesma largura só troca "pequeno
                 * demais para ler" por "cortado antes de terminar".
                 */}
                <p className="text-body font-semibold leading-snug text-fg [overflow-wrap:anywhere]">
                  {c.name}
                </p>
                <p className="mt-0.5 text-body-sm leading-snug text-fg-soft">
                  {CONDITION_STATUS_LABELS[c.status]}
                  {c.cid10_code && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>CID-10 {c.cid10_code}</span>
                    </>
                  )}
                </p>
              </div>
              {/* Alvo de toque: era p-1.5 num ícone de 16px (~28px), abaixo dos
                  44px do projeto. Agora 44px, e o Modo Sênior leva a ~57px. */}
              <button
                onClick={() => remove.mutate(c.id)}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-chip text-fg-soft transition hover:bg-rose-500/10 hover:text-status-alert-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={`Remover ${c.name}`}
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : isSuccess ? (
        <p className="text-body-sm text-fg-soft">Nenhuma condição registrada.</p>
      ) : (
        <p className="text-body-sm text-fg-soft">
          {isError
            ? 'Não foi possível carregar esta seção. O prontuário pode ter registros que não aparecem aqui.'
            : 'Carregando suas condições…'}
        </p>
      )}

      <form onSubmit={handleSubmit(onAdd, onInvalid)} className="grid gap-3 rounded-chip border border-line bg-surface-2 p-3 sm:grid-cols-2" noValidate>
        {/*
         * PEDIDO (a) do cliente: "o usuário precisa inserir as doenças
         * manualmente, e ter ao lado, se for o caso, busca de CIDs eficiente".
         * É exatamente esta dupla — o campo aceita qualquer texto, e a busca
         * (agora sobre as 310 categorias do DATASUS, e não sobre 15 itens de
         * `<datalist>`) fica ao lado como atalho, nunca como obrigação.
         */}
        <Field label="Condição" htmlFor="cond-name" error={errors.name?.message}>
          <ConditionAutocomplete
            campo="condicao"
            id="cond-name"
            name={campoNome.field.name}
            value={campoNome.field.value ?? ''}
            onChange={digitouCondicao}
            onSelect={escolheuPelaCondicao}
            onBlur={campoNome.field.onBlur}
            inputRef={campoNome.field.ref}
          />
        </Field>
        <Field label="CID-10" htmlFor="cond-cid" error={errors.cid10Code?.message}>
          <ConditionAutocomplete
            campo="codigo"
            id="cond-cid"
            name={campoCid.field.name}
            value={campoCid.field.value ?? ''}
            onChange={digitouCid}
            onSelect={escolheuPeloCid}
            onBlur={campoCid.field.onBlur}
            inputRef={campoCid.field.ref}
            showDisclaimer
          />
        </Field>
        <Field label="Status" htmlFor="cond-status" error={errors.status?.message}>
          <select id="cond-status" {...register('status')} className="min-h-11 w-full rounded-chip border border-line-strong bg-surface px-3 text-body-sm text-fg shadow-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
            {Object.entries(CONDITION_STATUS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
        </Field>
        {/*
         * PEDIDO (b): "nem sempre o paciente sabe a data exata que começou a
         * diagnosticar tal situação". A data já era opcional de verdade no
         * schema (`dataOpcional`), mas a tela não dizia isso em lugar nenhum —
         * e campo de data em branco é o tipo de coisa que a pessoa acha que vai
         * reprovar. Agora está escrito no rótulo E embaixo do campo.
         *
         * Uma data que não existe ("31/02") continua reprovando de propósito:
         * sem a mensagem, o clique em "Adicionar" volta a ser o silêncio que
         * gerou a queixa.
         *
         * O QUE AINDA NÃO FOI FEITO: guardar uma data APROXIMADA ("2019", "há
         * uns cinco anos"), que é a metade do pedido (b) que "deixe em branco"
         * não cobre — quem lembra o ano mas não o dia hoje só tem a opção de não
         * registrar nada. Ficou para depois por custo, e a premissa registrada
         * aqui precisa ser a CERTA, porque é dela que sai a decisão:
         *
         *   `diagnosed_at` É EXIBIDO — não é uma coluna morta. A RPC da linha do
         *   tempo (`supabase/migrations/0034_clinical_timeline_p2.sql`) datou o
         *   evento da condição com `coalesce(diagnosed_at ao meio-dia,
         *   created_at)` e devolve `date_only = diagnosed_at is not null` justo
         *   para separar data real de data de fallback. A mesma RPC alimenta
         *   quatro superfícies: `/linha-do-tempo` e o resumo do dashboard na
         *   web, a linha do tempo do app e o relatório clínico em PDF
         *   (`supabase/functions/clinical-report`).
         *
         * Ou seja: aceitar data aproximada não é somar um campo neste
         * formulário. É decidir o que essas quatro superfícies mostram quando a
         * pessoa disse "mais ou menos 2019" — e escrever 01/01/2019 como se
         * fosse o dia do diagnóstico seria afirmar o que ninguém confirmou.
         */}
        <Field label="Diagnóstico em (opcional)" htmlFor="cond-date" error={errors.diagnosedAt?.message}>
          <Input id="cond-date" type="date" aria-describedby="cond-date-hint" {...register('diagnosedAt')} />
          <p id="cond-date-hint" className="text-body-sm leading-snug text-fg-soft">
            Não lembra a data? Pode deixar em branco — a condição é registrada do mesmo jeito.
          </p>
        </Field>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adicionando…' : 'Adicionar condição'}</Button>
        </div>
      </form>
    </div>
  );
}
