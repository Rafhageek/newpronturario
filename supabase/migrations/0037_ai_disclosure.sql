-- ============================================================================
-- HubPatients — Migration 0037 — Disclosure de IA + registro imutável
--
-- Adequação à Resolução CFM nº 2.454/2026 (publicada em 27/02/2026, vigência a
-- partir de ~26/08/2026), que exige:
--   1. informar o paciente, de forma clara, sempre que a IA for usada como
--      apoio relevante — com direito de recusa;
--   2. supervisão humana sobre toda saída de IA;
--   3. rastreabilidade do uso (qual modelo, qual versão de prompt, quais
--      fontes, quando).
-- A resolução VEDA delegar à IA a comunicação de diagnóstico, prognóstico ou
-- decisão terapêutica — por isso o registro abaixo é de APOIO, nunca de
-- conduta, e a trilha é append-only para não poder ser reescrita depois.
--
-- Migração ADITIVA e IDEMPOTENTE: não remove nem altera dados existentes.
-- Reaproveita os padrões já estabelecidos em 0032 (imutabilidade append-only,
-- escrita apenas por RPC SECURITY DEFINER, espelho em public.audit_log).
-- ============================================================================

-- ── 1) Tabela de rastreabilidade (append-only) ──────────────────────────────
-- Guarda METADADOS do uso de IA, nunca o conteúdo clínico: `sources` referencia
-- o que alimentou o modelo (ex.: [{"type":"exam","id":"…"}]) e `output_hash`
-- permite provar depois que a saída exibida é a mesma que foi registrada, sem
-- armazenar PHI adicional.
create table if not exists public.ai_invocations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  task_type      text not null,
  model_id       text not null,
  prompt_version text not null,
  sources        jsonb not null default '[]'::jsonb,
  output_hash    text,
  created_at     timestamptz not null default now(),
  constraint ai_invocations_task_type_check
    check (char_length(btrim(task_type)) between 1 and 60),
  constraint ai_invocations_model_id_check
    check (char_length(btrim(model_id)) between 1 and 120),
  constraint ai_invocations_prompt_version_check
    check (char_length(btrim(prompt_version)) between 1 and 60),
  -- Dois checks separados: `jsonb_array_length` erraria em valor não-array, e
  -- CHECK não garante curto-circuito. O teto de elementos fica no RPC.
  constraint ai_invocations_sources_is_array_check
    check (jsonb_typeof(sources) = 'array'),
  constraint ai_invocations_sources_size_check
    check (char_length(sources::text) <= 4000),
  constraint ai_invocations_output_hash_check
    check (output_hash is null or char_length(output_hash) between 8 and 128)
);

create index if not exists ai_invocations_user_created_idx
  on public.ai_invocations (user_id, created_at desc);

create index if not exists ai_invocations_task_idx
  on public.ai_invocations (task_type, created_at desc);

comment on table public.ai_invocations is
  'Trilha append-only de cada uso de IA como apoio ao paciente (CFM 2.454/2026: '
  'informação clara ao paciente, supervisão humana e rastreabilidade). Escrita '
  'somente via public.log_ai_invocation(); leitura restrita ao próprio usuário.';
comment on column public.ai_invocations.task_type is
  'Tarefa de apoio (ex.: exam_reading, term_translation). Rótulos amigáveis em '
  'packages/core/src/constants/ai-disclosure.ts (AI_TASK_LABELS).';
comment on column public.ai_invocations.model_id is
  'Identificador do modelo usado, exatamente como enviado ao fornecedor.';
comment on column public.ai_invocations.prompt_version is
  'Versão do prompt/pipeline, para reproduzir a saída em auditoria.';
comment on column public.ai_invocations.sources is
  'Lista JSON das fontes que alimentaram a IA. NÃO deve conter PHI — apenas '
  'referências (tipo + id) e nomes de dicionários/base de conhecimento.';
comment on column public.ai_invocations.output_hash is
  'Hash da saída exibida ao paciente (integridade). Nunca a saída em si.';

-- ── 2) RLS: leitura só do próprio dado; escrita só por RPC ──────────────────
alter table public.ai_invocations enable row level security;

drop policy if exists "ai_invocations_select_own" on public.ai_invocations;
create policy "ai_invocations_select_own" on public.ai_invocations
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Sem policy de INSERT/UPDATE/DELETE: a escrita passa obrigatoriamente pelo RPC
-- SECURITY DEFINER, para que registro e auditoria confirmem ou revertam juntos.
revoke all on table public.ai_invocations from anon, authenticated;
revoke insert, update, delete, truncate on table public.ai_invocations from anon, authenticated;
grant select on table public.ai_invocations to authenticated;

-- ── 3) Imutabilidade (mesmo padrão de public.prevent_mutation, 0032) ────────
-- Função dedicada porque prevent_mutation() referencia actor_id/patient_id,
-- colunas que não existem aqui. A semântica e a mensagem são idênticas: nada
-- de UPDATE, nada de DELETE — exceto a cascata da exclusão da própria conta
-- (direito de eliminação, LGPD art. 18), quando o perfil já deixou de existir.
create or replace function public.prevent_ai_invocation_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.profiles p where p.id = old.user_id) then
      return old;
    end if;
    raise exception 'Registro imutável (append-only).';
  end if;

  raise exception 'Registro imutável (append-only).';
end;
$$;

revoke all on function public.prevent_ai_invocation_mutation() from public, anon, authenticated;

drop trigger if exists ai_invocations_immutable on public.ai_invocations;
create trigger ai_invocations_immutable
  before update or delete on public.ai_invocations
  for each row execute function public.prevent_ai_invocation_mutation();

-- ── 4) RPC de registro (única porta de escrita) ─────────────────────────────
-- Fixa user_id = auth.uid(): o cliente não escolhe de quem é o registro.
create or replace function public.log_ai_invocation(
  p_task_type      text,
  p_model_id       text,
  p_prompt_version text,
  p_sources        jsonb default '[]'::jsonb,
  p_output_hash    text default null
)
returns public.ai_invocations
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  clean_sources jsonb := coalesce(p_sources, '[]'::jsonb);
  clean_hash text := nullif(btrim(coalesce(p_output_hash, '')), '');
  saved public.ai_invocations;
begin
  if uid is null then
    raise exception 'Não autenticado.' using errcode = 'insufficient_privilege';
  end if;

  if p_task_type is null
     or char_length(btrim(p_task_type)) < 1
     or char_length(btrim(p_task_type)) > 60 then
    raise exception 'Tipo de tarefa de IA inválido.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_model_id is null
     or char_length(btrim(p_model_id)) < 1
     or char_length(btrim(p_model_id)) > 120 then
    raise exception 'Identificador do modelo de IA inválido.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_prompt_version is null
     or char_length(btrim(p_prompt_version)) < 1
     or char_length(btrim(p_prompt_version)) > 60 then
    raise exception 'Versão de prompt inválida.'
      using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_typeof(clean_sources) <> 'array' then
    raise exception 'As fontes da IA devem ser uma lista JSON.'
      using errcode = 'invalid_parameter_value';
  end if;

  if jsonb_array_length(clean_sources) > 40 then
    raise exception 'Número de fontes acima do limite permitido.'
      using errcode = 'invalid_parameter_value';
  end if;

  if clean_hash is not null
     and (char_length(clean_hash) < 8 or char_length(clean_hash) > 128) then
    raise exception 'Hash da saída de IA inválido.'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.ai_invocations
    (user_id, task_type, model_id, prompt_version, sources, output_hash)
  values
    (
      uid,
      btrim(p_task_type),
      btrim(p_model_id),
      btrim(p_prompt_version),
      clean_sources,
      clean_hash
    )
  returning * into saved;

  -- Espelho na trilha geral: a auditoria e o registro de IA vivem na mesma
  -- transação, então ou os dois existem, ou nenhum existe.
  insert into public.audit_log
    (actor_id, patient_id, action, resource_type, resource_id, metadata)
  values
    (
      uid,
      uid,
      'create',
      'ai_invocation',
      saved.id,
      jsonb_build_object(
        'task_type', saved.task_type,
        'model_id', saved.model_id,
        'prompt_version', saved.prompt_version,
        'sources', saved.sources,
        'output_hash', saved.output_hash,
        'regulation', 'CFM 2.454/2026'
      )
    );

  return saved;
end;
$$;

comment on function public.log_ai_invocation(text, text, text, jsonb, text) is
  'Registra um uso de IA como apoio (CFM 2.454/2026). Fixa user_id = auth.uid(), '
  'grava em public.ai_invocations (append-only) e espelha em public.audit_log.';

revoke all on function public.log_ai_invocation(text, text, text, jsonb, text)
  from public, anon;
grant execute on function public.log_ai_invocation(text, text, text, jsonb, text)
  to authenticated;
