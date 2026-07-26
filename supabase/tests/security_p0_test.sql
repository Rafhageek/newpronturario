-- ============================================================================
-- pgTAP — Provas das correções de segurança P0 (BLOCO 1 / migration 0025).
-- Roda em Supabase local:  supabase db reset  &&  supabase test db
--
-- Cada teste tenta uma ESCALADA como usuário comum e exige que FALHE.
-- (O 5º vetor — open redirect no login — é provado no vitest:
--  packages/core/src/utils/safe-redirect.test.ts)
-- ============================================================================

begin;
select plan(5);

-- ── Fixtures (como postgres/superuser: bypassa RLS) ─────────────────────────
-- Usuário comum A. A trigger handle_new_user cria o profile; provision_community
-- _member cria a linha em community_members (papel = membro, sem staff).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'a@test.local', '',
        now(), '{}'::jsonb, jsonb_build_object('full_name', 'Usuário A'),
        now(), now());

insert into public.social_profiles (user_id, display_name)
values ('11111111-1111-1111-1111-111111111111', 'Usuário A');

insert into public.posts (id, author_id, content)
values ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111', 'post de teste');

-- ── Passa a agir como o usuário comum A (RLS + grants valem) ────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

-- 1) Auto-virar médico (verified_crm) → deve FALHAR
select throws_ok(
  $$ update public.social_profiles set verified_crm = true
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  null, null,
  'usuário comum NÃO pode setar verified_crm = true'
);

-- 2) Fixar o próprio post (is_pinned) → deve FALHAR
select throws_ok(
  $$ update public.posts set is_pinned = true
     where id = '22222222-2222-2222-2222-222222222222' $$,
  null, null,
  'autor NÃO pode fixar (is_pinned) o próprio post'
);

-- 3) Trancar o próprio post (is_locked) → deve FALHAR
select throws_ok(
  $$ update public.posts set is_locked = true
     where id = '22222222-2222-2222-2222-222222222222' $$,
  null, null,
  'autor NÃO pode trancar (is_locked) o próprio post'
);

-- 4) Executar função de sistema → deve FALHAR (EXECUTE revogado)
select throws_ok(
  $$ select public.enqueue_low_stock_alerts() $$,
  null, null,
  'usuário comum NÃO pode executar enqueue_low_stock_alerts()'
);

-- 5) calendar-feed com token inválido NÃO vaza dados
select is(
  (select count(*)::int from public.calendar_feed('00000000-0000-0000-0000-000000000000')),
  0,
  'calendar_feed com token inválido devolve 0 linhas (não vaza)'
);

reset role;
select * from finish();
rollback;
