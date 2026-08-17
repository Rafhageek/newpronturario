'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REGISTRAR UMA ATIVIDADE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Cinco campos, DOIS obrigatórios (o que foi feito e por quanto tempo). Todo o
 * resto é opcional de verdade, e a tela DIZ isso em cada campo — a regra está
 * escrita no schema (`packages/core/src/schemas/activity.ts`) e o motivo é o
 * mesmo de lá: quem tem 70 anos e caminhou ontem talvez não lembre se sentiu
 * tontura. Exigir a resposta faz a pessoa chutar (e o prontuário guarda dado
 * inventado) ou desistir do registro inteiro (e o prontuário não guarda nada).
 *
 * O QUE ESTE FORMULÁRIO NÃO FAZ, em nenhuma hipótese: sugerir atividade, propor
 * duração, dizer que faltou ou sobrou esforço, classificar sintoma por
 * gravidade ou comentar o que foi registrado. O app REGISTRA e ORGANIZA.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O CAMPO DE SINTOMAS — a redação é a parte técnica
 *
 * É a coluna que justifica a tabela inteira (ver o cabeçalho da migração 0050):
 * em consulta o cardiologista pergunta sempre a mesma coisa — "sentiu dor no
 * peito? falta de ar? tontura quando se esforçou?" — e é sempre o que se
 * esquece, porque o episódio foi três semanas antes, na caminhada de terça.
 *
 * Ele registra. Não alarma e não tranquiliza:
 *  · nada de vermelho, nada de ícone de perigo, nada piscando;
 *  · nada de "procure ajuda imediatamente" — o app não examinou ninguém, e um
 *    alerta automático seria diagnóstico (proibido pela regra 1 do projeto);
 *  · e também nada que minimize ("provavelmente não é nada"), que seria o mesmo
 *    erro na direção oposta.
 * A única frase que o app diz sobre sintoma é `ACTIVITY_SYMPTOMS_NOTA`, e ela
 * devolve o registro para a conversa com quem sabe interpretá-lo.
 *
 * "Nenhum" é uma AFIRMAÇÃO marcável, e não o estado do campo em branco: campo
 * vazio é "não respondeu", `['nenhum']` é "respondeu que não sentiu nada". São
 * duas frases diferentes no prontuário (`descreverSintomas`), e o banco recusa
 * a contradição das duas juntas no CHECK da 0050.
 */

import { useForm, useController, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  activitySessionSchema,
  ACTIVITY_EFFORT_NOTA,
  ACTIVITY_EFFORT_OPTIONS,
  ACTIVITY_EFFORT_PERGUNTA,
  ACTIVITY_FEELING_PERGUNTA,
  ACTIVITY_KIND_NOTA,
  ACTIVITY_KIND_OPTIONS,
  ACTIVITY_SYMPTOM_OPTIONS,
  ACTIVITY_SYMPTOMS_NOTA,
  ACTIVITY_SYMPTOMS_PERGUNTA,
  diaLocal,
  type ActivitySessionInput,
  type ActivitySymptom,
} from '@hubpatients/core';
import { Button, Field, Input } from '@/components/ui';
import { MoodScale } from '@/components/ui/painel';

/**
 * Mesma aparência do `<Input>` do sistema (15px, borda forte, fundo do cartão).
 * Um `select` em 14px ao lado de um campo de texto em 15px é exatamente o tipo
 * de degrau que produziu a queixa do cliente sobre "caracteres claros".
 */
const CAMPO_BASE =
  'min-h-11 w-full rounded-chip border border-line-strong bg-surface px-3 text-body-sm text-fg shadow-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20';

/** Alvo de toque de 44px em rem — o Modo Sênior o leva a ~57px sozinho. */
const OPCAO_BASE =
  'flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-chip border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-strong focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary';

const OPCAO_ESCOLHIDA = 'border-primary bg-nav-active-tint';

const CONTROLE = 'mt-0.5 h-5 w-5 shrink-0 accent-primary';

const ehExclusivo = (valor: ActivitySymptom): boolean =>
  ACTIVITY_SYMPTOM_OPTIONS.find((o) => o.valor === valor)?.exclusivo ?? false;

/**
 * Marcar/desmarcar um sintoma respeitando a exclusividade do "Nenhum".
 *
 * Não é enfeite de interface: sem isto o registro poderia afirmar, ao mesmo
 * tempo, que houve e que não houve sintoma. O schema reprova e o banco também
 * (CHECK `activity_sessions_symptoms_check`) — a tela apenas evita que a pessoa
 * chegue até lá para levar um "não" na cara depois de preencher tudo.
 */
export function alternarSintoma(
  atuais: readonly ActivitySymptom[],
  valor: ActivitySymptom,
  marcado: boolean,
): ActivitySymptom[] {
  if (!marcado) return atuais.filter((s) => s !== valor);
  if (ehExclusivo(valor)) return [valor];
  return [...atuais.filter((s) => !ehExclusivo(s)), valor];
}

/**
 * Um grupo de opções (rádio ou caixas) com pergunta, ajuda e erro.
 *
 * Por que não é o `<Field>` de `components/ui.tsx`: aquele liga o texto ao
 * controle por `<label htmlFor>`, e um `<label for>` apontando para um
 * `<fieldset>` é HTML inválido — leitor de tela nenhum lê o rótulo. Grupo de
 * opções se nomeia por `<legend>`. O que o `<Field>` garante continua garantido
 * aqui: a mensagem tem `id`, o `<fieldset>` a referencia em `aria-describedby`,
 * e o erro sai com `role="alert"`.
 *
 * A tinta do erro é NEUTRA de propósito. O vermelho de validação é do SISTEMA e
 * seria legítimo — mas esta é a tela do esforço e dos sintomas da pessoa, e uma
 * borda vermelha ao lado de "Dor ou aperto no peito" é lida como gravidade
 * clínica, não como "faltou preencher". A distinção fica no PESO, na BORDA e na
 * POSIÇÃO (SC 1.4.1: nunca só na cor).
 */
function GrupoDeOpcoes({
  legenda,
  id,
  ajuda,
  erro,
  children,
}: {
  legenda: string;
  id: string;
  ajuda?: ReactNode;
  erro?: string;
  children: ReactNode;
}) {
  const ajudaId = ajuda ? `${id}-ajuda` : undefined;
  const erroId = erro ? `${id}-erro` : undefined;
  const descrito = [ajudaId, erroId].filter(Boolean).join(' ');

  return (
    <fieldset
      id={id}
      aria-describedby={descrito !== '' ? descrito : undefined}
      className="min-w-0"
    >
      <legend className="text-label font-medium text-fg-soft">{legenda}</legend>
      {ajuda ? (
        <p id={ajudaId} className="mt-1 text-body-sm leading-snug text-fg-soft">
          {ajuda}
        </p>
      ) : null}
      <div className="mt-2 space-y-2">{children}</div>
      {erro ? (
        <p
          id={erroId}
          role="alert"
          className="mt-2 rounded-chip border border-line-strong bg-surface-2 px-3 py-2 text-label font-semibold text-fg"
        >
          {erro}
        </p>
      ) : null}
    </fieldset>
  );
}

export interface FormularioAtividadeProps {
  /** Grava o registro. Devolve `true` quando salvou (aí o formulário se limpa). */
  onSalvar: (valores: ActivitySessionInput) => Promise<boolean>;
  salvando: boolean;
}

export function FormularioAtividade({ onSalvar, salvando }: FormularioAtividadeProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ActivitySessionInput>({
    resolver: zodResolver(activitySessionSchema),
    /*
     * `kind` NÃO entra aqui, e isso é decisão de produto: um tipo pré-escolhido
     * ("Caminhada") faz quem fez hidroginástica salvar caminhada sem perceber.
     * O `<select>` abre em "Escolha…" e o schema cobra a escolha.
     *
     * Nenhuma data entra também — data pré-preenchida num prontuário é data
     * inventada. `symptoms: []` é o estado "ainda não respondeu", que é
     * diferente de `['nenhum']` ("não senti nada").
     */
    defaultValues: { durationMin: undefined, symptoms: [], notes: '' },
  });

  /*
   * Esforço, sintomas e "como se sentiu" entram por `useController` — não por
   * `register` — porque os três precisam ficar em `undefined`/`[]` enquanto a
   * pessoa não responde. Um `<input type="radio">` registrado devolve a string
   * vazia quando nada foi marcado, e `''` não é `undefined`: o campo opcional
   * passaria a REPROVAR justamente quem preferiu não responder.
   */
  const campoEsforco = useController({ control, name: 'effort' });
  const campoSintomas = useController({ control, name: 'symptoms', defaultValue: [] });
  const campoSentiu = useController({ control, name: 'feelingAfter' });

  const sintomas: ActivitySymptom[] = campoSintomas.field.value ?? [];

  /**
   * Rede de segurança OBRIGATÓRIA: reprovar não pode virar silêncio.
   *
   * Formulário que reprova sem dizer nada foi a origem da pior queixa do
   * cliente — o clique em "Salvar" simplesmente não fazia nada. Cada campo já
   * mostra a própria mensagem e o React Hook Form leva o foco para o primeiro
   * inválido; o aviso alcança quem não estava olhando para aquela parte da tela.
   */
  function onInvalid(erros: FieldErrors<ActivitySessionInput>) {
    const primeira = Object.values(erros).find(
      (e) => typeof e?.message === 'string' && e.message.length > 0,
    )?.message;
    toast.error(
      typeof primeira === 'string'
        ? `Não foi possível salvar: ${primeira}`
        : 'Não foi possível salvar. Confira os campos com aviso e tente de novo.',
    );
  }

  async function onSubmit(valores: ActivitySessionInput) {
    const salvou = await onSalvar(valores);
    if (salvou) reset({ durationMin: undefined, symptoms: [], notes: '' });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      className="space-y-5"
      noValidate
    >
      {/* ─────────────────── O que você fez ─────────────────── */}
      <Field label="O que você fez?" htmlFor="atv-kind" error={errors.kind?.message}>
        <select
          id="atv-kind"
          defaultValue=""
          aria-describedby="atv-kind-nota"
          className={CAMPO_BASE}
          {...register('kind')}
        >
          <option value="">Escolha…</option>
          {ACTIVITY_KIND_OPTIONS.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        {/* Jardinagem e tarefas de casa estão na lista de propósito: para muita
            gente com 60+ são o movimento real do dia, e um registro que as
            ignora conta uma semana mais parada do que a que aconteceu. */}
        <p id="atv-kind-nota" className="text-body-sm leading-snug text-fg-soft">
          {ACTIVITY_KIND_NOTA}
        </p>
      </Field>

      {/* ─────────────────── Duração ─────────────────── */}
      <Field
        label="Quanto tempo durou? (em minutos)"
        htmlFor="atv-duracao"
        error={errors.durationMin?.message}
      >
        <Input
          id="atv-duracao"
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          step={1}
          placeholder="ex.: 30"
          aria-describedby="atv-duracao-nota"
          {...register('durationMin')}
        />
        {/* Nenhum piso de duração: 5 minutos de alongamento é um registro tão
            válido quanto 90 de natação, e a tela não sugere o contrário. */}
        <p id="atv-duracao-nota" className="text-body-sm leading-snug text-fg-soft">
          Qualquer duração vale — o registro é seu.
        </p>
      </Field>

      {/* ─────────────────── Esforço (teste da fala) ─────────────────── */}
      <GrupoDeOpcoes
        id="atv-esforco"
        legenda={ACTIVITY_EFFORT_PERGUNTA}
        ajuda={
          <>
            {ACTIVITY_EFFORT_NOTA} Se não lembrar, pode deixar sem responder.
          </>
        }
        erro={errors.effort?.message}
      >
        {ACTIVITY_EFFORT_OPTIONS.map((o) => {
          const escolhida = campoEsforco.field.value === o.valor;
          return (
            <label
              key={o.valor}
              className={`${OPCAO_BASE} ${escolhida ? OPCAO_ESCOLHIDA : ''}`}
            >
              <input
                type="radio"
                name={campoEsforco.field.name}
                value={o.valor}
                checked={escolhida}
                onChange={() => campoEsforco.field.onChange(o.valor)}
                onBlur={campoEsforco.field.onBlur}
                className={CONTROLE}
              />
              <span className="min-w-0">
                <span className="block text-body font-semibold text-fg">{o.rotulo}</span>
                {/* A descrição É o critério, não texto de apoio: quem lê
                    "moderado" não sabe o que responder; quem lê "conseguia
                    conversar, mas não cantar" sabe na hora. */}
                <span className="block text-body-sm leading-snug text-fg-soft">
                  {o.descricao}
                </span>
              </span>
            </label>
          );
        })}
        {campoEsforco.field.value ? (
          <button
            type="button"
            onClick={() => campoEsforco.field.onChange(undefined)}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-body-sm font-semibold text-primary hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Limpar esta resposta
          </button>
        ) : null}
      </GrupoDeOpcoes>

      {/* ─────────────────── Sintomas ─────────────────── */}
      <GrupoDeOpcoes
        id="atv-sintomas"
        legenda={ACTIVITY_SYMPTOMS_PERGUNTA}
        ajuda={ACTIVITY_SYMPTOMS_NOTA}
        erro={errors.symptoms?.message}
      >
        {ACTIVITY_SYMPTOM_OPTIONS.map((o) => {
          const marcado = sintomas.includes(o.valor);
          return (
            <label
              key={o.valor}
              className={`${OPCAO_BASE} items-center ${marcado ? OPCAO_ESCOLHIDA : ''}`}
            >
              <input
                type="checkbox"
                name={`${campoSintomas.field.name}-${o.valor}`}
                checked={marcado}
                onChange={(e) =>
                  campoSintomas.field.onChange(
                    alternarSintoma(sintomas, o.valor, e.target.checked),
                  )
                }
                onBlur={campoSintomas.field.onBlur}
                className={`${CONTROLE} mt-0`}
              />
              <span className="min-w-0 text-body text-fg">{o.rotulo}</span>
            </label>
          );
        })}
      </GrupoDeOpcoes>

      {/* ─────────────────── Como se sentiu depois ───────────────────
          Reusa a escala 1–5 do diário (`MoodScale`). Não se cria escala nova:
          duas escalas de 1 a 5 com significados diferentes no mesmo prontuário
          são armadilha para quem for ler depois — inclusive para o médico. */}
      <div>
        <MoodScale
          name="atv-sentiu"
          question={ACTIVITY_FEELING_PERGUNTA}
          value={campoSentiu.field.value ?? null}
          onChange={(v) => campoSentiu.field.onChange(v)}
        />
        <p className="mt-2 text-body-sm leading-snug text-fg-soft">
          Também é opcional. Se quiser trocar, é só tocar em outra carinha.
        </p>
        {errors.feelingAfter?.message ? (
          <p
            role="alert"
            className="mt-2 rounded-chip border border-line-strong bg-surface-2 px-3 py-2 text-label font-semibold text-fg"
          >
            {errors.feelingAfter.message}
          </p>
        ) : null}
      </div>

      {/* ─────────────────── Quando foi ─────────────────── */}
      <Field
        label="Quando foi? (opcional)"
        htmlFor="atv-data"
        error={errors.performedAt?.message}
      >
        {/*
          `max` no dia de hoje, como no seletor do diário alimentar. Um ano
          digitado errado (2062 em vez de 2026 é fácil com teclado numérico)
          criava um registro que ficava cravado no topo da lista para sempre e
          ao mesmo tempo não entrava na conta da semana — a pessoa via a
          atividade e não via o total mudar, sem nenhuma explicação. O schema
          recusa o mesmo caso, porque o app não é a única porta do prontuário.
        */}
        <Input
          id="atv-data"
          type="date"
          max={diaLocal()}
          aria-describedby="atv-data-nota"
          {...register('performedAt')}
        />
        <p id="atv-data-nota" className="text-body-sm leading-snug text-fg-soft">
          Não lembra o dia? Pode deixar em branco — a atividade entra pela data em que você
          anotou.
        </p>
      </Field>

      {/* ─────────────────── Observações ─────────────────── */}
      <Field label="Observações (opcional)" htmlFor="atv-notas" error={errors.notes?.message}>
        <textarea
          id="atv-notas"
          rows={3}
          maxLength={2000}
          placeholder="ex.: caminhei na praça, parei duas vezes para descansar"
          className={`${CAMPO_BASE} py-2 leading-relaxed`}
          {...register('notes')}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={salvando}>
          <Plus className="h-5 w-5" aria-hidden="true" /> Salvar atividade
        </Button>
        <p className="text-body-sm text-fg-soft">Só o tipo e a duração são obrigatórios.</p>
      </div>
    </form>
  );
}
