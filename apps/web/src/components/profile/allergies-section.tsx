'use client';

import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { AlertTriangle, ShieldCheck, Trash2 } from 'lucide-react';
import {
  allergySchema,
  type AllergyInput,
  ALLERGY_SEVERITY,
  dataPorExtenso,
  diaLocal,
} from '@hubpatients/core';
import {
  useAllergies,
  useAllergyMutations,
  useProfile,
  isNoKnownAllergyUnavailable,
  isNoKnownAllergyConflict,
} from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';

/**
 * "12 de agosto de 2026" a partir do instante gravado no banco. Devolve string
 * vazia se a data não for legível — a tela então fala da declaração SEM data,
 * porque data inventada num prontuário é pior que data ausente.
 */
function dataDaDeclaracao(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return dataPorExtenso(diaLocal(d));
}

export function AllergiesSection({ patientId }: { patientId: string }) {
  // `isSuccess`, e não "não está carregando": consulta que falhou também
  // devolve lista vazia, e alergia é o dado em que essa confusão custa caro.
  const { data: allergies, isSuccess, isError } = useAllergies(patientId);
  /*
   * A declaração "não tenho alergia conhecida" vive no PERFIL (coluna
   * `sem_alergia_conhecida_em`, migration 0049), não na lista de alergias.
   * Ela é lida com o mesmo rigor: enquanto o perfil não responde, a tela não
   * afirma nem que a pessoa declarou nem que não declarou.
   */
  const { data: profile, isSuccess: perfilCarregado } = useProfile(patientId);
  const { create, remove, declararSemAlergia, desfazerSemAlergia } = useAllergyMutations(patientId);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AllergyInput>({
    resolver: zodResolver(allergySchema),
    defaultValues: { severity: 'moderate' },
  });

  /*
   * O código pode estar em produção ANTES da migration 0049 ser aplicada (ou
   * depois — as duas ordens acontecem). Nesse intervalo a coluna não existe, e
   * a leitura chega `undefined`, que é indistinguível de "não declarou": por
   * isso o botão continua aparecendo, e é a ESCRITA que descobre a verdade. Se
   * o banco responder "coluna inexistente", a tela troca o botão por um aviso
   * honesto em vez de despejar erro técnico em cima de quem só queria dizer que
   * não tem alergia. Nada quebra, nada some, nada mente.
   */
  const [recursoIndisponivel, setRecursoIndisponivel] = useState(false);

  const lista = allergies ?? [];
  const temAlergia = lista.length > 0;
  // `?? null` porque, sem a 0049 aplicada, a chave nem vem no JSON do perfil.
  const declaradoEm = perfilCarregado ? (profile?.sem_alergia_conhecida_em ?? null) : null;
  const dataDeclarada = declaradoEm ? dataDaDeclaracao(declaradoEm) : '';
  /*
   * COERÊNCIA: a declaração de ausência só é exibida como válida quando a
   * consulta de alergias RESPONDEU e a lista veio vazia. Duas razões:
   *  · se a consulta falhou, pode haver alergia que não carregou — e aí a
   *    declaração exibida sozinha viraria a afirmação mais perigosa da tela;
   *  · se há alergia registrada, a declaração não vale mais (o banco a derruba
   *    sozinho na 0049) e a tela avisa em vez de mostrar as duas coisas juntas.
   */
  const declaracaoValida = isSuccess && !temAlergia && declaradoEm != null;
  const declaracaoConflitante = isSuccess && temAlergia && declaradoEm != null;
  /*
   * "Não declarou" também é uma afirmação, e só o PERFIL respondido autoriza
   * fazê-la: enquanto ele carrega, `declaradoEm` é null por ignorância, não por
   * fato. Sem esta trava, a tela ofereceria "declare que não tem" a quem já
   * declarou, e a frase "ninguém declarou nada ainda" apareceria sem base.
   */
  const semDeclaracaoConfirmada = perfilCarregado && declaradoEm == null;
  const podeDeclarar = isSuccess && !temAlergia && semDeclaracaoConfirmada && !recursoIndisponivel;
  const ocupado = declararSemAlergia.isPending || desfazerSemAlergia.isPending;

  /** Traduz o erro do banco para o que a pessoa precisa saber. */
  function avisarFalha(error: unknown, padrao: string) {
    if (isNoKnownAllergyUnavailable(error)) {
      setRecursoIndisponivel(true);
      toast.error('Este registro ainda não está disponível no seu prontuário. Tente mais tarde.');
      return;
    }
    if (isNoKnownAllergyConflict(error)) {
      toast.error('Há alergia registrada aqui. Remova a alergia antes de declarar que não tem nenhuma.');
      return;
    }
    toast.error(padrao);
  }

  /**
   * Rede de segurança: reprovar não pode virar silêncio. Cada campo já mostra
   * a própria mensagem, mas o aviso alcança quem não estava olhando para a
   * parte do formulário que reprovou.
   *
   * Aqui isso pesa mais do que nas outras seções: alergia é o registro que
   * alguém vai ler numa emergência. "Cliquei em Adicionar e não aconteceu
   * nada" — a queixa que originou esta rede — não pode terminar com a pessoa
   * achando que a alergia dela ficou salva.
   */
  function onInvalid(erros: FieldErrors<AllergyInput>) {
    const primeira = Object.values(erros).find(
      (e) => typeof e?.message === 'string' && e.message.length > 0,
    )?.message;
    toast.error(
      typeof primeira === 'string'
        ? `Não foi possível adicionar: ${primeira}`
        : 'Não foi possível adicionar. Confira os campos com aviso e tente de novo.',
    );
  }

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
      /*
       * A alergia SEMPRE vence a declaração de ausência. O banco já desfaz a
       * declaração sozinho (trigger da 0049), mas o app diz em voz alta o que
       * aconteceu com o registro anterior: um prontuário não deve mudar de
       * afirmação sem que o dono fique sabendo.
       */
      if (declaradoEm != null) {
        toast.success('Alergia adicionada. A declaração "sem alergia conhecida" deixou de valer.');
      } else {
        toast.success('Alergia adicionada.');
      }
    } catch {
      toast.error('Não foi possível adicionar.');
    }
  }

  async function onDeclarar() {
    if (
      !confirmAction(
        'Você está declarando que NÃO tem nenhuma alergia conhecida. ' +
          'Isso é diferente de deixar a lista em branco: quem te socorrer vai ler essa declaração. ' +
          'Você pode desfazer a qualquer momento. Confirmar?',
      )
    ) {
      return;
    }
    try {
      await declararSemAlergia.mutateAsync();
      toast.success('Registrado: você não tem alergia conhecida.');
    } catch (error) {
      avisarFalha(error, 'Não foi possível registrar agora.');
    }
  }

  async function onDesfazer() {
    try {
      await desfazerSemAlergia.mutateAsync();
      toast.success('Declaração desfeita.');
    } catch (error) {
      avisarFalha(error, 'Não foi possível desfazer agora.');
    }
  }

  return (
    <div className="space-y-4">
      {temAlergia ? (
        <ul className="space-y-2">
          {lista.map((a) => {
            const meta = ALLERGY_SEVERITY[a.severity];
            const alert = meta.tone === 'alert';
            return (
              <li
                key={a.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${alert ? 'border-rose-500/30 bg-rose-500/10' : 'border-amber-500/20 bg-amber-500/[0.06]'}`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {alert && <AlertTriangle className="h-4 w-4 shrink-0 text-status-alert-ink" aria-hidden="true" />}
                  <div className="min-w-0">
                    {/*
                      LEGIBILIDADE (queixa do cliente, 2026-08). Duas coisas
                      erradas nesta linha, e a segunda é grave:
                       · substância e gravidade saíam em 14px (`text-sm`);
                       · o caso NÃO grave saía em `text-amber-100` (#fef3c7)
                         sobre fundo âmbar a 6% — 1,06:1 no tema claro. O nome da
                         substância a que a pessoa é alérgica era, na prática,
                         invisível: a AA pede 4,5:1.

                      Agora: 17px (`text-body`) e tinta MEDIDA pela fórmula da
                      WCAG 2.x contra o fundo REAL do item (amber-500 a 6% sobre
                      --surface, dentro de `.hp-clinical-shell`):
                        claro   fg #151b2b sobre #fef9f0 = 16,4:1
                        escuro  fg #e8eaf0 sobre #241f16 = 13,6:1
                      O caso GRAVE mantém a tinta de alerta (rose-700/rose-200),
                      que é do SISTEMA — aviso de segurança, não julgamento do
                      corpo: 6,0:1 (claro) e 11,6:1 (escuro) sobre o mesmo fundo.
                    */}
                    <p className={`truncate text-body font-semibold ${alert ? 'text-rose-700 dark:text-rose-200' : 'text-fg'}`}>
                      {a.substance} · {meta.label}
                    </p>
                    {a.reaction && <p className="truncate text-body-sm text-fg-soft">{a.reaction}</p>}
                  </div>
                </div>
                <button onClick={() => { if (confirmAction(`Remover a alergia "${a.substance}"? Essa informação é importante para sua segurança em emergências.`)) remove.mutate(a.id); }} className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-soft hover:bg-rose-500/10 hover:text-status-alert-ink" aria-label={`Remover alergia ${a.substance}`}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : declaracaoValida ? (
        <div className="rounded-xl border border-line bg-surface-2 px-3 py-3">
          <p className="flex items-start gap-2.5 text-body font-semibold text-fg">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            Você declarou não ter alergia conhecida.
          </p>
          {/*
            A DATA é o que separa esta declaração de um simples "true": quem lê o
            prontuário decide, pela data, se vale perguntar de novo. Sem data
            legível a frase sai sem ela — nunca com uma data inventada.
          */}
          <p className="mt-1.5 pl-[30px] text-body-sm text-fg-soft">
            {dataDeclarada ? `Declarado em ${dataDeclarada}.` : 'Declarado por você.'}{' '}
            Descobriu uma alergia depois? Desfaça e cadastre — leva menos de um minuto.
          </p>
          <button
            onClick={onDesfazer}
            disabled={ocupado}
            className="mt-2 -ml-2 inline-flex min-h-11 items-center rounded-lg px-2 text-body-sm font-semibold text-primary hover:underline disabled:opacity-60"
          >
            {desfazerSemAlergia.isPending ? 'Desfazendo…' : 'Desfazer esta declaração'}
          </button>
        </div>
      ) : isSuccess ? (
        <p className="text-body-sm text-fg-soft">
          Nenhuma alergia registrada.{' '}
          {semDeclaracaoConfirmada
            ? 'Isso não quer dizer que você não tenha: ninguém declarou nada ainda.'
            : null}
        </p>
      ) : (
        <p className="text-body-sm text-fg-soft">
          {isError
            ? 'Não foi possível carregar esta seção. O prontuário pode ter registros que não aparecem aqui.'
            : 'Carregando suas alergias…'}
        </p>
      )}

      {/*
        CONFLITO. Não deveria acontecer com a 0049 aplicada (o trigger derruba a
        declaração no INSERT da alergia), mas dado velho e cache existem — e o
        que a tela NUNCA pode fazer é exibir a declaração ao lado da alergia,
        que é o pior dos dois mundos. Aqui ela diz, em letra visível, que a
        declaração deixou de valer, e oferece a correção em um toque.
      */}
      {declaracaoConflitante && (
        <div className="rounded-xl border border-line bg-surface-2 px-3 py-3">
          <p className="text-body-sm text-fg">
            Existe uma declaração de &ldquo;sem alergia conhecida&rdquo; neste prontuário
            {dataDeclarada ? `, de ${dataDeclarada}` : ''}. Ela não vale mais: há alergia registrada
            acima.
          </p>
          <button
            onClick={onDesfazer}
            disabled={ocupado}
            className="mt-2 -ml-2 inline-flex min-h-11 items-center rounded-lg px-2 text-body-sm font-semibold text-primary hover:underline disabled:opacity-60"
          >
            {desfazerSemAlergia.isPending ? 'Removendo…' : 'Remover a declaração'}
          </button>
        </div>
      )}

      {/*
        Pedido do cliente: "ter opção do paciente/usuário colocar SEM ALERGIA".
        O botão só aparece quando a consulta RESPONDEU e a lista veio vazia —
        declarar ausência sobre dado que não carregou seria a mesma mentira que
        a seção inteira existe para evitar.
      */}
      {podeDeclarar && (
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-body-sm text-fg-soft">
            Não tem nenhuma alergia? Registre isso. Deixar em branco só diz que ninguém preencheu;
            declarar diz que você não tem.
          </p>
          <button
            onClick={onDeclarar}
            disabled={ocupado}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-body-sm font-semibold text-fg hover:bg-surface disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {declararSemAlergia.isPending ? 'Registrando…' : 'Não tenho alergia conhecida'}
          </button>
        </div>
      )}

      {/* Por que a opção sumiu — some sem explicação é o que faz a pessoa achar
          que o app não aceita o que ela quer registrar. */}
      {isSuccess && temAlergia && !declaracaoConflitante && (
        <p className="text-body-sm text-fg-soft">
          Como há alergia registrada, a opção &ldquo;Não tenho alergia conhecida&rdquo; não aparece.
          Remova as alergias da lista para poder declarar isso.
        </p>
      )}

      {recursoIndisponivel && (
        <p className="text-body-sm text-fg-soft">
          O registro de &ldquo;sem alergia conhecida&rdquo; ainda não está disponível neste
          prontuário. Suas alergias continuam sendo salvas normalmente.
        </p>
      )}

      {/*
        `handleSubmit(onAdd, onInvalid)`: sem o segundo argumento, reprovar na
        validação não produzia NADA — nem toast, nem foco visível para quem
        tinha rolado a página. Era o último formulário do Perfil que ainda
        falhava em silêncio, e logo na seção de maior peso clínico.

        Todo campo leva `error` junto: sem essa prop a mensagem do campo não
        aparece E o <Field> não põe `aria-invalid`/`aria-describedby` no
        controle — quem usa leitor de tela não ficava sabendo nem que reprovou
        nem por quê. "Gravidade" e "Reação" também reprovam (enum fora da lista,
        reação acima de 200 caracteres), então os três entram.
      */}
      <form onSubmit={handleSubmit(onAdd, onInvalid)} className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-2" noValidate>
        <Field label="Substância" htmlFor="al-sub" error={errors.substance?.message}>
          <Input id="al-sub" {...register('substance')} placeholder="Ex.: Penicilina" />
        </Field>
        <Field label="Gravidade" htmlFor="al-sev" error={errors.severity?.message}>
          <select id="al-sev" {...register('severity')} className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-body-sm text-fg">
            {Object.entries(ALLERGY_SEVERITY).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
          </select>
        </Field>
        <Field label="Reação" htmlFor="al-react" error={errors.reaction?.message}>
          <Input id="al-react" {...register('reaction')} placeholder="Ex.: urticária" />
        </Field>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adicionando…' : 'Adicionar alergia'}</Button>
        </div>
      </form>
    </div>
  );
}
