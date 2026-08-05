-- ============================================================================
-- pgTAP — isolamento de RLS entre titulares (rede de segurança).
-- Executar após `supabase db reset`: `supabase test db`.
-- Fixtures exclusivamente fictícias; toda a suíte é revertida ao final.
--
-- Por que este arquivo existe: um furo de RLS neste app é vazamento de
-- prontuário de terceiro (dado sensível — LGPD art. 11). O teste prova, tabela
-- a tabela, que o titular A enxerga APENAS a própria linha, que um terceiro
-- sem vínculo (C) não enxerga nada, que A não escreve na linha de B e que o
-- papel `anon` não lê dado clínico.
--
-- Convenção dos UUIDs de fixture:
--   '0000000a-…-0000000000NN' → linha do titular A na tabela NN
--   '0000000b-…-0000000000NN' → linha do titular B na tabela NN
--   NN: 01 water_logs · 02 body_composition · 03 body_measurements
--       04 meal_logs · 05 food_entries · 06 user_goals · 07 vitals
--       08 diary_entries · 09 medications · 10 exams · 11 consents
--       12 ai_invocations · 13 personal_access_tokens
--       14 account_deletion_requests · 15 audit_log
-- ============================================================================

begin;
select plan(43);

-- ── Fixtures (papel postgres: bypassa RLS) ──────────────────────────────────
-- A trigger handle_new_user cria o profile de cada usuário do Auth.
insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-a@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Titular A Fictício"}'::jsonb, now(), now()),
  ('b2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-b@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Titular B Fictício"}'::jsonb, now(), now()),
  ('b3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-c@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Terceiro C Fictício"}'::jsonb, now(), now());

-- 01 · Hidratação
insert into public.water_logs (id, user_id, ml) values
  ('0000000a-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 500),
  ('0000000b-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 500);

-- 02 · Composição corporal
insert into public.body_composition (id, user_id, weight_kg) values
  ('0000000a-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 70),
  ('0000000b-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 70);

-- 03 · Circunferências
insert into public.body_measurements (id, user_id, waist_cm) values
  ('0000000a-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 80),
  ('0000000b-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000002', 80);

-- 04 · Diário alimentar (refeição livre)
insert into public.meal_logs (id, user_id, meal_type, description) values
  ('0000000a-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001',
   'lunch', 'Refeição fictícia A'),
  ('0000000b-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000002',
   'lunch', 'Refeição fictícia B');

-- 05 · Itens do diário alimentar (TACO)
insert into public.food_entries (id, user_id, meal_type, food_name, grams) values
  ('0000000a-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001',
   'lunch', 'Alimento fictício A', 100),
  ('0000000b-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000002',
   'lunch', 'Alimento fictício B', 100);

-- 06 · Metas
insert into public.user_goals (id, user_id, goal_type, target_value) values
  ('0000000a-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000001', 'weight', 70),
  ('0000000b-0000-0000-0000-000000000006', 'b2000000-0000-0000-0000-000000000002', 'weight', 70);

-- 07 · Sinais vitais
insert into public.vitals (id, patient_id, type, value_primary, unit) values
  ('0000000a-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000001',
   'weight', 70, 'kg'),
  ('0000000b-0000-0000-0000-000000000007', 'b2000000-0000-0000-0000-000000000002',
   'weight', 70, 'kg');

-- 08 · Diário clínico
insert into public.diary_entries (id, patient_id, entry_date, mood, note) values
  ('0000000a-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000001',
   current_date, 3, 'Nota fictícia A'),
  ('0000000b-0000-0000-0000-000000000008', 'b2000000-0000-0000-0000-000000000002',
   current_date, 3, 'Nota fictícia B');

-- 09 · Medicamentos
insert into public.medications (id, patient_id, name) values
  ('0000000a-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000001',
   'Medicamento fictício A'),
  ('0000000b-0000-0000-0000-000000000009', 'b2000000-0000-0000-0000-000000000002',
   'Medicamento fictício B');

-- 10 · Exames
insert into public.exams (id, patient_id, title) values
  ('0000000a-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000001',
   'Exame fictício A'),
  ('0000000b-0000-0000-0000-000000000010', 'b2000000-0000-0000-0000-000000000002',
   'Exame fictício B');

-- 11 · Consentimentos
insert into public.consents (id, patient_id, purpose, granted) values
  ('0000000a-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000001',
   'research', true),
  ('0000000b-0000-0000-0000-000000000011', 'b2000000-0000-0000-0000-000000000002',
   'research', true);

-- 12 · Rastreabilidade de IA (CFM 2.454/2026)
insert into public.ai_invocations
  (id, user_id, task_type, model_id, prompt_version) values
  ('0000000a-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000001',
   'exam_reading', 'modelo-ficticio', 'v1'),
  ('0000000b-0000-0000-0000-000000000012', 'b2000000-0000-0000-0000-000000000002',
   'exam_reading', 'modelo-ficticio', 'v1');

-- 13 · Tokens de acesso pessoal (só metadados; o hash nunca é o token)
insert into public.personal_access_tokens
  (id, user_id, name, token_hash, token_prefix, scopes, expires_at) values
  ('0000000a-0000-0000-0000-000000000013', 'b1000000-0000-0000-0000-000000000001',
   'Token fictício A', 'hash-ficticio-a', 'hpk_a', array['read:profile'],
   now() + interval '30 days'),
  ('0000000b-0000-0000-0000-000000000013', 'b2000000-0000-0000-0000-000000000002',
   'Token fictício B', 'hash-ficticio-b', 'hpk_b', array['read:profile'],
   now() + interval '30 days');

-- 14 · Solicitações de exclusão de conta
insert into public.account_deletion_requests (id, user_id) values
  ('0000000a-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000001'),
  ('0000000b-0000-0000-0000-000000000014', 'b2000000-0000-0000-0000-000000000002');

-- 15 · Trilha de auditoria
insert into public.audit_log
  (id, actor_id, patient_id, action, resource_type) values
  ('0000000a-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000001', 'read', 'rls_isolation_fixture'),
  ('0000000b-0000-0000-0000-000000000015', 'b2000000-0000-0000-0000-000000000002',
   'b2000000-0000-0000-0000-000000000002', 'read', 'rls_isolation_fixture');

-- ── 0) Pré-condições estruturais ────────────────────────────────────────────
-- Sem RLS habilitado, todos os testes abaixo passariam por acidente de grants.
select ok(
  not exists (
    select 1
      from unnest(array[
        'water_logs', 'body_composition', 'body_measurements', 'meal_logs',
        'food_entries', 'user_goals', 'vitals', 'diary_entries', 'medications',
        'exams', 'consents', 'ai_invocations', 'personal_access_tokens',
        'account_deletion_requests', 'audit_log'
      ]) as t(nome)
      left join pg_class c on c.oid = to_regclass('public.' || t.nome)::oid
     where c.oid is null or not c.relrowsecurity
  ),
  'as 15 tabelas cobertas existem e têm RLS habilitado'
);

-- Definer sem search_path fixo = escalada por schema malicioso no path.
-- Objetos de extensão (deptype 'e', ex.: pgtap) ficam de fora: não são nossos.
select ok(
  not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and not exists (
         select 1
           from unnest(coalesce(p.proconfig, array[]::text[])) as cfg
          where cfg like 'search_path=%'
       )
       and not exists (
         select 1
           from pg_depend d
          where d.classid = 'pg_proc'::regclass
            and d.objid = p.oid
            and d.deptype = 'e'
       )
  ),
  'nenhuma função SECURITY DEFINER de public está sem search_path fixo'
);

-- View sem security_invoker roda com os privilégios do dono e fura a RLS.
select ok(
  not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'v'
       and coalesce(
             (select o.option_value
                from pg_options_to_table(c.reloptions) o
               where o.option_name = 'security_invoker'),
             'off'
           ) not in ('on', 'true')
       and not exists (
         select 1
           from pg_depend d
          where d.classid = 'pg_class'::regclass
            and d.objid = c.oid
            and d.deptype = 'e'
       )
  ),
  'toda view de public roda com security_invoker'
);

-- ── 1) Como o titular A: enxerga exatamente a própria linha ─────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","email":"rls-a@test.local","role":"authenticated"}',
  true
);

select results_eq(
  $$ select id from public.water_logs order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000001'::uuid) $$,
  'water_logs — A vê só a própria hidratação'
);
select results_eq(
  $$ select id from public.body_composition order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000002'::uuid) $$,
  'body_composition — A vê só a própria composição corporal'
);
select results_eq(
  $$ select id from public.body_measurements order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000003'::uuid) $$,
  'body_measurements — A vê só as próprias circunferências'
);
select results_eq(
  $$ select id from public.meal_logs order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000004'::uuid) $$,
  'meal_logs — A vê só as próprias refeições'
);
select results_eq(
  $$ select id from public.food_entries order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000005'::uuid) $$,
  'food_entries — A vê só os próprios itens alimentares'
);
select results_eq(
  $$ select id from public.user_goals order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000006'::uuid) $$,
  'user_goals — A vê só as próprias metas'
);
select results_eq(
  $$ select id from public.vitals order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000007'::uuid) $$,
  'vitals — A vê só os próprios sinais vitais'
);
select results_eq(
  $$ select id from public.diary_entries order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000008'::uuid) $$,
  'diary_entries — A vê só o próprio diário'
);
select results_eq(
  $$ select id from public.medications order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000009'::uuid) $$,
  'medications — A vê só os próprios medicamentos'
);
select results_eq(
  $$ select id from public.exams order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000010'::uuid) $$,
  'exams — A vê só os próprios exames'
);
select results_eq(
  $$ select id from public.consents order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000011'::uuid) $$,
  'consents — A vê só os próprios consentimentos'
);
select results_eq(
  $$ select id from public.ai_invocations order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000012'::uuid) $$,
  'ai_invocations — A vê só a própria trilha de uso de IA'
);
select results_eq(
  $$ select id from public.personal_access_tokens order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000013'::uuid) $$,
  'personal_access_tokens — A vê só os próprios tokens'
);
select results_eq(
  $$ select id from public.account_deletion_requests order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000014'::uuid) $$,
  'account_deletion_requests — A vê só o próprio protocolo'
);
select results_eq(
  $$ select id from public.audit_log order by id $$,
  $$ values ('0000000a-0000-0000-0000-000000000015'::uuid) $$,
  'audit_log — A vê só a própria trilha'
);

-- ── 2) Como o terceiro C (sem vínculo e sem dados): não vê absolutamente nada
select set_config(
  'request.jwt.claims',
  '{"sub":"b3000000-0000-0000-0000-000000000003","email":"rls-c@test.local","role":"authenticated"}',
  true
);

select is_empty(
  $$ select id from public.water_logs $$,
  'water_logs — terceiro sem vínculo não vê hidratação alheia'
);
select is_empty(
  $$ select id from public.body_composition $$,
  'body_composition — terceiro sem vínculo não vê composição alheia'
);
select is_empty(
  $$ select id from public.body_measurements $$,
  'body_measurements — terceiro sem vínculo não vê circunferências alheias'
);
select is_empty(
  $$ select id from public.meal_logs $$,
  'meal_logs — terceiro sem vínculo não vê refeições alheias'
);
select is_empty(
  $$ select id from public.food_entries $$,
  'food_entries — terceiro sem vínculo não vê itens alimentares alheios'
);
select is_empty(
  $$ select id from public.user_goals $$,
  'user_goals — terceiro sem vínculo não vê metas alheias'
);
select is_empty(
  $$ select id from public.vitals $$,
  'vitals — terceiro sem vínculo não vê sinais vitais alheios'
);
select is_empty(
  $$ select id from public.diary_entries $$,
  'diary_entries — terceiro sem vínculo não vê diário alheio'
);
select is_empty(
  $$ select id from public.medications $$,
  'medications — terceiro sem vínculo não vê medicamentos alheios'
);
select is_empty(
  $$ select id from public.exams $$,
  'exams — terceiro sem vínculo não vê exames alheios'
);
select is_empty(
  $$ select id from public.consents $$,
  'consents — terceiro sem vínculo não vê consentimentos alheios'
);
select is_empty(
  $$ select id from public.ai_invocations $$,
  'ai_invocations — terceiro sem vínculo não vê uso de IA alheio'
);
select is_empty(
  $$ select id from public.personal_access_tokens $$,
  'personal_access_tokens — terceiro sem vínculo não vê tokens alheios'
);
select is_empty(
  $$ select id from public.account_deletion_requests $$,
  'account_deletion_requests — terceiro sem vínculo não vê protocolo alheio'
);
select is_empty(
  $$ select id from public.audit_log $$,
  'audit_log — terceiro sem vínculo não vê trilha alheia'
);

-- ── 3) Escrita cruzada: A não altera nem apaga a linha de B ─────────────────
-- RLS filtra o UPDATE/DELETE: a operação "passa" mas não atinge nenhuma linha.
--
-- NOTA (teste corrigido, não o código): os cinco blocos abaixo escreviam a CTE
-- de escrita DENTRO de uma subconsulta escalar — `select is((with x as (update
-- …) select count(*) from x), 0, …)`. O Postgres recusa isso ("WITH clause
-- containing a data-modifying statement must be at the top level"), o psql
-- abortava o arquivo na primeira ocorrência e os 10 subtestes seguintes nunca
-- rodavam. A CTE subiu para o topo do comando; a afirmação é a mesma: o
-- UPDATE/DELETE é executado de fato como o titular A e precisa atingir 0 linhas.
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000001","email":"rls-a@test.local","role":"authenticated"}',
  true
);

with alterado as (
  update public.water_logs set ml = 1
   where id = '0000000b-0000-0000-0000-000000000001'
   returning id
)
select is(
  count(*)::int, 0,
  'water_logs — A não altera a hidratação de B'
) from alterado;

with removido as (
  delete from public.water_logs
   where id = '0000000b-0000-0000-0000-000000000001'
   returning id
)
select is(
  count(*)::int, 0,
  'water_logs — A não apaga a hidratação de B'
) from removido;

with alterado as (
  update public.vitals set value_primary = 1
   where id = '0000000b-0000-0000-0000-000000000007'
   returning id
)
select is(
  count(*)::int, 0,
  'vitals — A não altera o sinal vital de B'
) from alterado;

with removido as (
  delete from public.medications
   where id = '0000000b-0000-0000-0000-000000000009'
   returning id
)
select is(
  count(*)::int, 0,
  'medications — A não apaga o medicamento de B'
) from removido;

with alterado as (
  update public.food_entries set grams = 1
   where id = '0000000b-0000-0000-0000-000000000005'
   returning id
)
select is(
  count(*)::int, 0,
  'food_entries — A não altera o item alimentar de B'
) from alterado;

-- ── 4) Papel anônimo: nenhuma leitura de dado clínico ───────────────────────
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is_empty(
  $$ select id from public.water_logs $$,
  'anon não lê hidratação'
);
select is_empty(
  $$ select id from public.vitals $$,
  'anon não lê sinais vitais'
);
select is_empty(
  $$ select id from public.diary_entries $$,
  'anon não lê diário'
);
select is_empty(
  $$ select id from public.medications $$,
  'anon não lê medicamentos'
);
select is_empty(
  $$ select id from public.exams $$,
  'anon não lê exames'
);

reset role;
select * from finish();
rollback;
