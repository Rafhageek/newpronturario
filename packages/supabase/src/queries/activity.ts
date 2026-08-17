import { diaDeFormulario } from '@hubpatients/core';
import type {
  ActivityEffort,
  ActivityKind,
  ActivitySessionInput,
  ActivitySessionUpdateInput,
  ActivitySymptom,
  Database,
} from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ATIVIDADE FÍSICA — leitura e escrita de `public.activity_sessions` (0050)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Duas coisas que este arquivo faz de propósito e que valem explicação:
 *
 * 1. ELE NÃO DEVOLVE LISTA VAZIA QUANDO NÃO CONSEGUE LER. Enquanto a 0050 não
 *    for aplicada, a tabela não existe e o PostgREST responde com erro. A
 *    tentação é engolir isso e devolver `[]` — "assim a tela não quebra". Só
 *    que aí a tela escreve "nenhuma atividade registrada" sobre um dado que
 *    ninguém leu, e passa a AFIRMAR uma ausência que não confirmou. É
 *    exatamente o defeito que `utils/estado-secao.ts` existe para impedir, e o
 *    mesmo que em 04/08 fez o QR imprimir "Alergias graves: nenhuma" quando a
 *    consulta falhava. Então o erro sobe, o React Query marca `isError`, e a
 *    tela diz que não conseguiu ler — que é a verdade.
 *
 * 2. ELE OFERECE `isActivityModuleUnavailable` para a tela distinguir "a
 *    internet caiu" de "este recurso ainda não está no ar". A segunda merece um
 *    texto próprio e calmo, e não um erro técnico em cima de quem só queria
 *    anotar a caminhada de hoje. Mesmo caminho de
 *    `isNoKnownAllergyUnavailable` em `queries/clinical.ts`.
 *
 * Nada aqui calcula nota, faixa, "calorias queimadas" ou classificação de
 * sintoma. As contas factuais (soma da semana, texto) moram em
 * `@hubpatients/core` → `constants/activity.ts`, testadas.
 */

type ActivitySessionRow = Database['public']['Tables']['activity_sessions']['Row'];

export interface ActivitySession {
  id: string;
  patient_id: string;
  kind: ActivityKind;
  duration_min: number;
  effort: ActivityEffort | null;
  /** `[]` = não respondeu · `['nenhum']` = afirmou não ter sentido nada. */
  symptoms: ActivitySymptom[];
  feeling_after: number | null;
  /** `AAAA-MM-DD` — o DIA que a pessoa informou. `null` = não informou. */
  performed_at: string | null;
  /**
   * `coalesce(performed_at, created_at)` — existe SÓ para ordenar a lista.
   * Não use para exibir data nem para agrupar por semana: ela mistura um dia
   * sem hora com um instante com fuso, e a leitura local de um dia gravado como
   * meia-noite UTC volta o dia anterior no Brasil. Quem exibe usa
   * `performed_at` ou, na falta dele, `created_at` — dizendo qual dos dois é.
   */
  occurred_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ─────────────────────── Janela entre deploy e migration ─────────────────── */

function erroDoBanco(error: unknown): { code: string; message: string } {
  const e = error as { code?: unknown; message?: unknown } | null;
  return {
    code: typeof e?.code === 'string' ? e.code : '',
    message: typeof e?.message === 'string' ? e.message : '',
  };
}

/**
 * O banco ainda não tem a tabela da 0050?
 *
 * Acontece de verdade na janela entre publicar o app e aplicar a migration.
 * Duas formas possíveis:
 *  · `42P01` — undefined_table, quando o Postgres responde direto;
 *  · `PGRST205` — o PostgREST não achou a tabela no cache de schema.
 * A checagem por mensagem é a rede de segurança para versões que não mandam
 * `code`; ela exige o nome da tabela para não capturar erro alheio.
 */
export function isActivityModuleUnavailable(error: unknown): boolean {
  const { code, message } = erroDoBanco(error);
  if (code === '42P01' || code === 'PGRST205') return true;
  return message.includes('activity_sessions') && /does not exist|schema cache/i.test(message);
}

/** Texto único para essa janela — a tela não precisa inventar o dela. */
export const ATIVIDADE_INDISPONIVEL_TEXTO =
  'O registro de atividade física ainda não está disponível nesta conta. Nada foi perdido: assim que o recurso for liberado, ele aparece aqui.';

/* ──────────────────────────────── Leitura ──────────────────────────────── */

const COLUNAS =
  'id, patient_id, kind, duration_min, effort, symptoms, feeling_after, performed_at, occurred_at, notes, created_at, updated_at';

/**
 * Sessões do paciente, da mais recente para a mais antiga.
 *
 * Ordena por `occurred_at` (coluna gerada no banco) para que um registro sem
 * data informada entre na ordem pela data em que foi anotado, em vez de cair
 * para o fim da lista como se fosse antigo.
 */
export async function listActivitySessions(
  client: HubPatientsClient,
  patientId: string,
  limit = 200,
): Promise<ActivitySession[]> {
  const { data, error } = await client
    .from('activity_sessions')
    .select(COLUNAS)
    .eq('patient_id', patientId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(normalizar);
}

/**
 * Sessões a partir de uma data (ISO). Serve ao total factual da semana, que é
 * calculado por `resumoSemanaAtividade` no core — aqui só se busca a janela.
 */
export async function listActivitySessionsSince(
  client: HubPatientsClient,
  patientId: string,
  sinceIso: string,
): Promise<ActivitySession[]> {
  const { data, error } = await client
    .from('activity_sessions')
    .select(COLUNAS)
    .eq('patient_id', patientId)
    .gte('occurred_at', sinceIso)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizar);
}

/**
 * `symptoms` chega como array do Postgres; linha antiga ou coluna nula viram
 * `[]`, que a tela lê como "não respondeu" — nunca como "não sentiu nada".
 */
function normalizar(row: ActivitySessionRow): ActivitySession {
  return {
    ...row,
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
  };
}

/* ──────────────────────────────── Escrita ──────────────────────────────── */

type ActivitySessionWrite = Partial<
  Pick<
    ActivitySessionRow,
    'kind' | 'duration_min' | 'effort' | 'symptoms' | 'feeling_after' | 'performed_at' | 'notes'
  >
>;

/**
 * Traduz o que o formulário validou (camelCase, `Date`, `undefined`) para o que
 * o banco espera (snake_case, dia em `AAAA-MM-DD`, `null`).
 *
 * `undefined` vira `null` de propósito na criação: no banco, `null` é "não
 * informado" — o registro guarda que a pergunta ficou sem resposta, em vez de
 * fingir que ela nem foi feita.
 */
function paraLinha(input: ActivitySessionUpdateInput): ActivitySessionWrite {
  const linha: ActivitySessionWrite = {};
  if (input.kind !== undefined) linha.kind = input.kind;
  if (input.durationMin !== undefined) linha.duration_min = input.durationMin;
  if ('effort' in input) linha.effort = input.effort ?? null;
  if (input.symptoms !== undefined) linha.symptoms = input.symptoms;
  if ('feelingAfter' in input) linha.feeling_after = input.feelingAfter ?? null;
  if ('performedAt' in input) {
    linha.performed_at = diaDeFormulario(input.performedAt);
  }
  if ('notes' in input) linha.notes = input.notes?.trim() ? input.notes.trim() : null;
  return linha;
}

export async function createActivitySession(
  client: HubPatientsClient,
  patientId: string,
  input: ActivitySessionInput,
): Promise<ActivitySession> {
  const { data, error } = await client
    .from('activity_sessions')
    .insert({
      patient_id: patientId,
      kind: input.kind,
      duration_min: input.durationMin,
      effort: input.effort ?? null,
      symptoms: input.symptoms ?? [],
      feeling_after: input.feelingAfter ?? null,
      performed_at: diaDeFormulario(input.performedAt),
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    .select(COLUNAS)
    .single();
  if (error) throw error;
  return normalizar(data);
}

export async function updateActivitySession(
  client: HubPatientsClient,
  id: string,
  input: ActivitySessionUpdateInput,
): Promise<ActivitySession> {
  const { data, error } = await client
    .from('activity_sessions')
    .update(paraLinha(input))
    .eq('id', id)
    .select(COLUNAS)
    .single();
  if (error) throw error;
  return normalizar(data);
}

/**
 * Apagar é do DONO, e é definitivo — a policy `activity_sessions_modify` (0050)
 * garante que cuidador só lê. Quem registrou pode desfazer o próprio registro;
 * ninguém mais pode.
 */
export async function deleteActivitySession(
  client: HubPatientsClient,
  id: string,
): Promise<void> {
  const { error } = await client.from('activity_sessions').delete().eq('id', id);
  if (error) throw error;
}
