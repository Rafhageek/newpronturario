-- ============================================================================
-- 0050 — Atividade física: o que a pessoa fez, e o que o corpo dela disse
-- enquanto fazia.
--
-- O QUE ESTA TABELA É (e o que ela não é)
-- É REGISTRO. Não é treino, não é plano, não é avaliação. Nada aqui classifica
-- desempenho, calcula "calorias queimadas", pontua constância ou compara a
-- pessoa com quem quer que seja. O app registra e organiza; quem interpreta é
-- a equipe de saúde. Mesma régua do diário alimentar (0031/0047) e da mesma
-- família de decisões que `packages/core/src/utils/diario-alimentar.ts`
-- documenta linha a linha.
--
-- A COLUNA QUE JUSTIFICA A TABELA: `symptoms`
-- O idealizador do produto tem revascularização do miocárdio e hipertensão
-- essencial. Em consulta, a pergunta do cardiologista é sempre a mesma —
-- "sentiu dor no peito? falta de ar? tontura quando se esforçou?" — e é
-- exatamente a resposta que se esquece na hora, porque o episódio foi três
-- semanas antes, na caminhada de terça. Guardar isso ATRELADO ao esforço em que
-- aconteceu (tipo, duração, intensidade) é o que transforma uma lembrança vaga
-- num dado que vale para quem prescreve.
-- O banco GUARDA o sintoma. O banco NÃO classifica gravidade, NÃO ordena por
-- risco e NÃO existe nenhuma coluna `severity`/`flag`/`alert` aqui — de
-- propósito. Um campo desses seria o app dando um parecer que ele não tem
-- autoridade para dar.
--
-- `symptoms = '{}'` NÃO É `symptoms = '{nenhum}'`
-- A mesma distinção da 0049 ("sem alergia conhecida"): array vazio é AUSÊNCIA
-- DE RESPOSTA (ninguém perguntou / a pessoa pulou o campo); `{nenhum}` é a
-- pessoa AFIRMANDO que não sentiu nada. Num prontuário isso não é a mesma
-- informação, e a tela precisa poder dizer qual das duas aconteceu
-- (regra de veracidade — `packages/core/src/utils/estado-secao.ts`).
-- O CHECK abaixo impede a contradição de marcar "nenhum" junto com um sintoma.
--
-- ESFORÇO PELO TESTE DA FALA
-- `effort` guarda leve/moderado/intenso segundo o teste da fala (conseguia
-- conversar e cantar / conversar mas não cantar / não conseguia manter
-- conversa). Escolhido porque não exige frequencímetro, relógio nem cinta —
-- o público desta tabela mede esforço com a própria voz. Os rótulos completos
-- moram em `packages/core/src/constants/activity.ts`.
--
-- `feeling_after` REUSA A ESCALA DE HUMOR DE 1 A 5 já gravada em
-- `diary_entries.mood` (0001) e desenhada em
-- `packages/core/src/data/mood-scale.ts`. Uma escala, um vocabulário — criar
-- uma segunda escala de 1 a 5 com outro significado seria armadilha para quem
-- lê o prontuário depois.
--
-- REFERÊNCIA DA OMS (150 min/semana de atividade moderada): ela NÃO está neste
-- banco, e não está de propósito. Não existe coluna de meta, nem default de
-- meta, nem trigger que compare total com referência. A referência é TEXTO
-- CITADO na interface, com fonte — do mesmo jeito que o app cita diretriz nas
-- faixas de leitura — e nunca um alvo que o app tenha definido para a pessoa.
--
-- TIPO texto + CHECK, e não ENUM: `create type` não é idempotente sem bloco
-- `do`, e o vocabulário de atividade tende a crescer com o uso real (o que num
-- enum custa `alter type` e trava rollback). Mesmo caminho da 0031.
--
-- RLS: padrão das demais tabelas clínicas (0001/0002) — dono faz CRUD,
-- cuidador aceito faz SELECT via `can_view_patient()`.
--
-- IDEMPOTENTE. NÃO aplicada ainda — quem aplica é o Rafael.
-- O código do app tolera a tabela ausente (ver
-- `packages/supabase/src/queries/activity.ts`, `isActivityModuleUnavailable`),
-- então a ordem deploy × migration não derruba tela nenhuma.
-- ============================================================================

create table if not exists public.activity_sessions (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.profiles (id) on delete cascade,

  -- Vocabulário de quem tem 50+, não de academia. Nada de "treino A", "HIIT".
  kind         text not null,

  -- Guarda de integridade contra erro de digitação (24 h), não faixa clínica.
  duration_min smallint not null,

  -- Teste da fala. Null = a pessoa não respondeu (não é "esforço zero").
  effort       text,

  -- '{}' = não respondeu · '{nenhum}' = afirmou que não sentiu nada.
  symptoms     text[] not null default '{}'::text[],

  -- Mesma escala 1–5 de `diary_entries.mood`. Null = não respondeu.
  feeling_after smallint,

  -- O DIA em que a atividade aconteceu. Null = não informado — e null é uma
  -- resposta honesta: melhor do que carimbar `now()` e inventar um horário que
  -- a pessoa nunca disse.
  --
  -- É `date`, e NÃO `timestamptz`, pelo mesmo motivo de `surgeries.performed_at`
  -- (0002) e `conditions.diagnosed_at` (0001): o formulário pergunta "quando
  -- foi?" com um `<input type="date">`, que devolve só o dia. Guardar isso num
  -- instante com fuso obriga alguém a escolher uma hora que ninguém digitou — e
  -- essa escolha vaza: `new Date('2026-08-17')` é meia-noite UTC, que no Brasil
  -- é 16/08 às 21h. O prontuário passaria a afirmar que a caminhada em que
  -- houve dor no peito foi na véspera, à noite. A armadilha está documentada em
  -- `packages/core/src/utils/datas-pt.ts` desde o diário alimentar.
  performed_at date,

  -- Chave única de ordenação para a lista e para o índice: usa a data informada
  -- quando ela existe e, quando não existe, a data do registro. É coluna
  -- GERADA (somente leitura) justamente para que ninguém possa gravar aqui um
  -- valor diferente do que as outras duas colunas dizem.
  --
  -- ELA SERVE SÓ PARA ORDENAR E INDEXAR — nenhuma tela escreve a data a partir
  -- daqui. Quem exibe usa `performed_at` (o dia que a pessoa informou) ou, na
  -- falta dele, `created_at` dizendo com todas as letras que aquela é a data em
  -- que o registro foi anotado. Misturar as duas numa coluna só é ótimo para
  -- `order by` e péssimo para contar um fato.
  --
  -- O `at time zone 'UTC'` existe porque coluna gerada exige expressão
  -- IMMUTABLE: o cast direto `date::timestamptz` depende do fuso da sessão e é
  -- apenas STABLE, o que o Postgres recusa aqui.
  occurred_at  timestamptz generated always as (
    coalesce(performed_at::timestamp at time zone 'UTC', created_at)
  ) stored,

  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.activity_sessions is
  'PHI: registro de atividade física do paciente. Só registra — não avalia desempenho, não prescreve exercício, não classifica sintoma.';
comment on column public.activity_sessions.kind is
  'PHI: modalidade da atividade, em vocabulário do público 50+ (ver constants/activity.ts).';
comment on column public.activity_sessions.effort is
  'Esforço percebido pelo TESTE DA FALA (leve/moderado/intenso). Null = não respondido.';
comment on column public.activity_sessions.symptoms is
  'PHI: sintomas sentidos DURANTE o esforço. ''{}'' = não respondeu; ''{nenhum}'' = afirmou não ter sentido nada. São fatos diferentes — o app não confunde os dois nem interpreta gravidade.';
comment on column public.activity_sessions.feeling_after is
  'Como se sentiu depois, na mesma escala 1–5 de diary_entries.mood. Null = não respondido.';
comment on column public.activity_sessions.performed_at is
  'DIA em que a atividade aconteceu (date, sem hora — igual a surgeries.performed_at). Null = não informado (o app não carimba now() no lugar).';
comment on column public.activity_sessions.occurred_at is
  'Gerada: coalesce(performed_at, created_at). Existe SÓ para ordenar e indexar — nenhuma tela escreve data a partir daqui.';

-- ----------------------------------------------------------------------------
-- Vocabulários fechados. `add constraint if not exists` não existe em Postgres,
-- então cada CHECK é removido e recriado — o que também deixa a migration
-- reaplicável depois de o vocabulário crescer.
-- ----------------------------------------------------------------------------
alter table public.activity_sessions drop constraint if exists activity_sessions_kind_check;
alter table public.activity_sessions add constraint activity_sessions_kind_check
  check (kind in (
    'caminhada',
    'hidroginastica',
    'bicicleta',
    'musculacao',
    'fisioterapia',
    'danca',
    'jardinagem',
    'tarefas_de_casa',
    'natacao',
    'alongamento',
    'outro'
  ));

alter table public.activity_sessions drop constraint if exists activity_sessions_duration_check;
alter table public.activity_sessions add constraint activity_sessions_duration_check
  check (duration_min > 0 and duration_min <= 1440);

alter table public.activity_sessions drop constraint if exists activity_sessions_effort_check;
alter table public.activity_sessions add constraint activity_sessions_effort_check
  check (effort is null or effort in ('leve', 'moderado', 'intenso'));

alter table public.activity_sessions drop constraint if exists activity_sessions_feeling_check;
alter table public.activity_sessions add constraint activity_sessions_feeling_check
  check (feeling_after is null or feeling_after between 1 and 5);

-- Três garantias, e nenhuma delas é clínica:
--   1. só sintomas do vocabulário entram;
--   2. nada de `null` dentro do array (um null ali passaria pelo `<@`, porque
--      comparação com null devolve null e CHECK só reprova o que é `false`);
--   3. "nenhum" não coexiste com sintoma — o prontuário não pode afirmar as
--      duas coisas ao mesmo tempo (mesma lógica de coerência da 0049).
alter table public.activity_sessions drop constraint if exists activity_sessions_symptoms_check;
alter table public.activity_sessions add constraint activity_sessions_symptoms_check
  check (
    symptoms <@ array[
      'dor_no_peito',
      'falta_de_ar',
      'tontura',
      'palpitacao',
      'dor_nas_pernas',
      'nenhum'
    ]::text[]
    and array_position(symptoms, null::text) is null
    and (not ('nenhum' = any (symptoms)) or cardinality(symptoms) = 1)
  );

-- ----------------------------------------------------------------------------
-- Índice: a tela lê "as atividades deste paciente, da mais recente para a mais
-- antiga". `occurred_at` é a coluna gerada, então registro sem data informada
-- entra na mesma ordenação em vez de cair para o fim da lista.
-- ----------------------------------------------------------------------------
create index if not exists activity_sessions_patient_date_idx
  on public.activity_sessions (patient_id, occurred_at desc);

drop trigger if exists activity_sessions_set_updated_at on public.activity_sessions;
create trigger activity_sessions_set_updated_at
  before update on public.activity_sessions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — dono CRUD; cuidador aceito SELECT. Cópia fiel do padrão de `surgeries`
-- e `vitals` (0001/0002). O cuidador PRECISA enxergar: é quem leva o paciente à
-- consulta e quem repete ao médico o que a pessoa sentiu na caminhada.
-- ----------------------------------------------------------------------------
alter table public.activity_sessions enable row level security;

drop policy if exists "activity_sessions_select" on public.activity_sessions;
create policy "activity_sessions_select" on public.activity_sessions
  for select to authenticated
  using (public.can_view_patient(patient_id));

drop policy if exists "activity_sessions_modify" on public.activity_sessions;
create policy "activity_sessions_modify" on public.activity_sessions
  for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

-- TRUNCATE ignora RLS (ver 0045). O `alter default privileges` de lá já cobre
-- tabelas novas criadas pelo mesmo dono, mas repetir aqui custa nada e fecha o
-- caso de a migration ser aplicada por outro papel.
revoke truncate on public.activity_sessions from anon, authenticated;
