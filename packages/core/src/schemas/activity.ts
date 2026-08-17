import { z } from 'zod';

import {
  ACTIVITY_EFFORTS,
  ACTIVITY_KINDS,
  ACTIVITY_SYMPTOMS,
  type ActivitySymptom,
} from '../constants/activity';
import { dataOpcional } from './data-opcional';
import { criaNumeroOpcional } from './numero-opcional';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * REGISTRO DE ATIVIDADE FÍSICA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O que este schema aceita é o que o módulo inteiro é: um REGISTRO. Não há
 * campo de meta, de plano, de série, de carga, de "objetivo" — nada que só
 * faria sentido se o app estivesse montando treino para alguém. Ele não está,
 * e não pode estar.
 *
 * DUAS OBRIGATORIEDADES, E SÓ DUAS: o que a pessoa fez (`kind`) e por quanto
 * tempo (`durationMin`). Todo o resto é opcional de propósito.
 *
 * Isso não é preguiça de validação — é a regra de veracidade aplicada ao
 * formulário. Quem tem 70 anos e caminhou ontem talvez não lembre se sentiu
 * tontura, e talvez não saiba dizer a hora exata. Exigir a resposta faria uma
 * de duas coisas, ambas piores que o campo vazio: a pessoa chuta (e o
 * prontuário passa a guardar um dado inventado), ou a pessoa desiste do
 * registro inteiro (e o prontuário não guarda nada). Campo vazio é ausência de
 * resposta, e ausência de resposta é uma informação honesta — é a mesma leitura
 * de `utils/estado-secao.ts`, agora do lado de quem escreve.
 *
 * O CASO `symptoms` MERECE PARÁGRAFO PRÓPRIO. Lista vazia significa "não
 * respondeu"; `['nenhum']` significa "respondeu que não sentiu nada". São
 * fatos diferentes e o schema preserva os dois — pela mesma razão que a 0049
 * criou "sem alergia conhecida" em vez de deixar o campo em branco falar por
 * ela. Marcar "nenhum" junto com um sintoma REPROVA: um registro não pode
 * afirmar que houve e que não houve sintoma ao mesmo tempo (o banco também
 * recusa, no CHECK `activity_sessions_symptoms_check` da 0050 — a regra mora
 * nos dois lugares porque o app não é a única porta do prontuário).
 *
 * O que este schema NÃO faz, em nenhuma hipótese: classificar sintoma por
 * gravidade, ordenar sintoma por risco, reprovar duração "curta demais",
 * exigir esforço mínimo, ou emitir qualquer juízo sobre o que foi registrado.
 */

/* ─────────────────────────────── Campos ─────────────────────────────── */

/** O que foi feito. Vocabulário fechado, igual ao CHECK da 0050. */
const kind = z.enum(ACTIVITY_KINDS, {
  errorMap: () => ({ message: 'Escolha uma atividade da lista.' }),
});

/**
 * Duração em minutos.
 *
 * Os limites são guarda de INTEGRIDADE (erro de digitação), não julgamento
 * clínico: 0 minuto não é uma atividade e 25 horas não cabem num dia. Entre um
 * e outro o app não tem opinião — 5 minutos de alongamento é um registro tão
 * válido quanto 90 minutos de natação, e nada aqui sugere o contrário.
 *
 * `<input type="number">` vazio manda `''`, que vira 0 na coerção e cai na
 * mensagem do `min` — escrita para ser lida por quem esqueceu de preencher, e
 * não pelo log.
 */
const durationMin = z.coerce
  .number({ invalid_type_error: 'Informe a duração em minutos, apenas números.' })
  .int('Informe a duração em minutos inteiros.')
  .min(1, 'Informe quantos minutos durou a atividade.')
  .max(1440, 'A duração não pode passar de 24 horas (1.440 minutos).');

/** Esforço pelo teste da fala. Opcional: nem todo mundo consegue recordar. */
const effort = z
  .enum(ACTIVITY_EFFORTS, {
    errorMap: () => ({ message: 'Escolha uma das três opções de esforço.' }),
  })
  .optional();

/**
 * Sintomas sentidos DURANTE o esforço.
 *
 * A ordem de saída é sempre a de `ACTIVITY_SYMPTOMS`, e as repetições somem:
 * assim o mesmo conjunto de sintomas gera sempre a mesma linha no banco, venha
 * de onde vier (web, mobile, importação). Nada é descartado em silêncio — a
 * contradição "nenhum + sintoma" REPROVA com mensagem, em vez de o app escolher
 * sozinho qual das duas respostas da pessoa vale.
 */
const symptoms = z
  .array(
    z.enum(ACTIVITY_SYMPTOMS, {
      errorMap: () => ({ message: 'Sintoma fora da lista.' }),
    }),
  )
  .max(ACTIVITY_SYMPTOMS.length, 'Sintomas repetidos.')
  .default([])
  .transform((lista): ActivitySymptom[] =>
    ACTIVITY_SYMPTOMS.filter((s) => lista.includes(s)),
  )
  .superRefine((lista, ctx) => {
    if (lista.includes('nenhum') && lista.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Você marcou "Nenhum" junto com um sintoma. Deixe "Nenhum" sozinho, ou desmarque para escolher o que sentiu.',
      });
    }
  });

/**
 * Como se sentiu depois — a MESMA escala 1–5 do diário (`diaryEntrySchema.mood`,
 * desenhada em `data/mood-scale.ts`). Não se cria escala nova: duas escalas de
 * 1 a 5 com significados diferentes no mesmo prontuário confundem inclusive
 * quem vai ler o registro na consulta.
 *
 * Passa pelo `criaNumeroOpcional` porque campo em branco tem que sair como
 * "não respondeu", e não como 0 — que aqui nem existe na escala.
 */
const feelingAfter = criaNumeroOpcional('Escolha uma das cinco opções.').pipe(
  z
    .number()
    .int('Escolha uma das cinco opções.')
    .min(1, 'Escolha uma das cinco opções.')
    .max(5, 'Escolha uma das cinco opções.')
    .optional(),
);

/**
 * Quando aconteceu.
 *
 * Opcional via `dataOpcional`, que existe justamente porque campo de data vazio
 * travava formulário em silêncio. Data que não existe no calendário continua
 * reprovando: num prontuário, data errada é pior que data ausente.
 *
 * O `.refine` fecha o caso do FUTURO, que o `dataOpcional` sozinho aceita: "2062"
 * é um calendário perfeitamente válido e uma digitação plausível de "2026" em
 * teclado numérico. Um registro no futuro fica cravado no topo da lista para
 * sempre e não entra na conta de nenhuma semana — a pessoa vê a atividade e não
 * vê o total mudar, sem explicação. A comparação usa o dia em UTC dos dois
 * lados: `new Date('2026-08-17')` é meia-noite UTC, então comparar com um "hoje"
 * lido em horário local rejeitaria o registro de hoje mesmo no Brasil.
 */
const performedAt = dataOpcional.refine(
  (d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return true;
    const hoje = new Date();
    const fimDeHoje = Date.UTC(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
      23,
      59,
      59,
      999,
    );
    return d.getTime() <= fimDeHoje;
  },
  { message: 'Essa data ainda não chegou. Confira o dia em que a atividade aconteceu.' },
);

/* ────────────────────────────── O schema ────────────────────────────── */

export const activitySessionSchema = z.object({
  kind,
  durationMin,
  effort,
  symptoms,
  feelingAfter,
  performedAt,
  notes: z.string().trim().max(2000, 'Observação muito longa (máximo 2.000 caracteres).').optional(),
});

export type ActivitySessionInput = z.infer<typeof activitySessionSchema>;

/**
 * Edição: todos os campos viram opcionais para o PATCH mandar só o que mudou.
 * `kind` e `durationMin` continuam obrigatórios QUANDO enviados — o `.partial()`
 * afrouxa a presença, nunca a validação do valor.
 */
export const activitySessionUpdateSchema = activitySessionSchema.partial();

export type ActivitySessionUpdateInput = z.infer<typeof activitySessionUpdateSchema>;
