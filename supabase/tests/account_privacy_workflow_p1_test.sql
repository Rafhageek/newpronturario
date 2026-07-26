-- ============================================================================
-- pgTAP — workflow server-side de solicitação de exclusão (migration 0033).
-- Executar após `supabase db reset`: `supabase test db`.
-- ============================================================================

begin;
select plan(5);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('d1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'privacidade@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Titular Fictício"}'::jsonb, now(), now());

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","email":"privacidade@test.local","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select public.request_account_deletion() $$,
  'titular autenticado registra a solicitação pelo RPC'
);

select is(
  (select count(*)::int from public.account_deletion_requests),
  1,
  'RLS permite ao titular ler o próprio protocolo'
);

select throws_ok(
  $$ update public.account_deletion_requests set status = 'completed' $$,
  null, null,
  'titular não altera diretamente o estado administrativo'
);

reset role;

select is(
  (select count(*)::int from public.audit_log
    where resource_type = 'account_deletion_request'
      and action = 'delete'),
  1,
  'RPC registra a trilha de auditoria'
);

delete from auth.users where id = 'd1000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.account_deletion_requests where user_id is null),
  1,
  'purga do Auth anonimiza o titular e preserva o protocolo mínimo'
);

select * from finish();
rollback;
