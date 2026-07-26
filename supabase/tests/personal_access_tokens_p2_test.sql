-- ============================================================================
-- pgTAP — Personal Access Tokens P2 (migration 0035)
-- Executar após `supabase db reset`: `supabase test db`.
-- ============================================================================

begin;
select plan(18);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e3500000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pat-ficticio@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Titular PAT Fictício"}'::jsonb, now(), now());

-- Simula o estado legado pré-0035 para provar a janela de rotação. Como o teste
-- roda após as migrations, a linha é inserida como postgres e a mesma regra de
-- backfill é reproduzida de forma explícita.
insert into public.personal_access_tokens
  (user_id, name, token_hash, token_prefix, scopes, expires_at)
values
  ('e3500000-0000-0000-0000-000000000001', 'Legado fictício', repeat('b', 64),
   'vlk_legado…', array['read:profile'], now() + interval '14 days');

select ok(
  exists (
    select 1 from public.personal_access_tokens
    where name = 'Legado fictício'
      and expires_at > now()
      and expires_at <= now() + interval '14 days 1 minute'
  ),
  'PAT legado recebe janela curta e explícita de rotação'
);

select throws_ok(
  $$ insert into public.personal_access_tokens
       (user_id, name, token_hash, token_prefix, scopes, expires_at)
     values
       ('e3500000-0000-0000-0000-000000000001', 'Sem prazo', repeat('c', 64),
        'vlk_semprazo…', array['read:profile'], null) $$,
  null, null,
  'constraint impede qualquer novo PAT sem expiração'
);

create temporary table pat_test_state (
  token text not null,
  token_id uuid not null,
  token_hash text not null
);
grant select, insert on pat_test_state to authenticated, anon;

select ok(
  not has_function_privilege('anon', 'public.api_me_bundle(text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.api_me_bundle(text)', 'EXECUTE'),
  'RPC legada que aceitava hash não é executável pela API'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"e3500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select throws_ok(
  $$ select public.issue_personal_access_token(
       'Tentativa AAL1', array['read:profile'], now() + interval '1 day') $$,
  '42501', 'Autenticação reforçada necessária.',
  'AAL1 não pode emitir PAT mesmo com sessão autenticada'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e3500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select throws_ok(
  $$ insert into public.personal_access_tokens
       (user_id, name, token_hash, token_prefix, scopes, expires_at)
     values
       ('e3500000-0000-0000-0000-000000000001', 'direto', repeat('a', 64),
        'vlk_inseguro…', array['read:profile'], now() + interval '1 day') $$,
  null, null,
  'titular não emite token por INSERT direto'
);

select throws_ok(
  $$ update public.personal_access_tokens set revoked_at = now() where false $$,
  null, null,
  'titular não altera token diretamente'
);

select throws_ok(
  $$ select public.issue_personal_access_token(
       'escopo inválido', array['write:profile'], now() + interval '1 day') $$,
  '22023', 'Dados do token inválidos.',
  'emissão rejeita escopo fora da allowlist'
);

with issued as (
  select public.issue_personal_access_token(
    'Integração fictícia',
    array['read:profile', 'read:medications', 'read:profile'],
    now() + interval '30 days'
  ) as payload
)
insert into pat_test_state (token, token_id, token_hash)
select
  payload->>'token',
  (payload->>'id')::uuid,
  encode(extensions.digest(payload->>'token', 'sha256'), 'hex')
from issued;

reset role;

select ok(
  (select token ~ '^vlk_[0-9a-f]{64}$' from pat_test_state),
  'segredo é gerado no servidor com 256 bits'
);

select is(
  (select p.token_hash
     from public.personal_access_tokens p
     join pat_test_state s on s.token_id = p.id),
  (select token_hash from pat_test_state),
  'banco persiste somente o SHA-256 do bearer'
);

select is(
  (select scopes from public.personal_access_tokens p
    join pat_test_state s on s.token_id = p.id),
  array['read:medications', 'read:profile']::text[],
  'RPC normaliza e remove escopos duplicados'
);

set local role anon;

select throws_ok(
  format(
    'select public.api_me_bundle_v2(%L)',
    (select token_hash from pat_test_state)
  ),
  '28000', 'Credencial inválida.',
  'hash armazenado não pode ser reutilizado como bearer'
);

select is(
  public.api_me_bundle_v2((select token from pat_test_state))->>'resourceType',
  'Bundle',
  'bearer original continua compatível com GET /api/v1/me'
);

reset role;

select is(
  (select count(*)::integer
   from public.audit_log a
   join pat_test_state s on s.token_id = a.resource_id
   where a.resource_type = 'api_token_access'),
  1,
  'uso do PAT gera auditoria'
);

select ok(
  not exists (
    select 1
    from public.audit_log a
    cross join pat_test_state s
    where a.resource_id = s.token_id
      and (
        a.metadata::text like '%' || s.token || '%'
        or a.metadata::text like '%' || s.token_hash || '%'
      )
  ),
  'auditoria não contém bearer nem hash'
);

update public.personal_access_token_rate_limits r
   set request_count = 60,
       window_started_at = date_trunc('minute', clock_timestamp())
  from pat_test_state s
 where r.token_id = s.token_id;

set local role anon;
select is(
  public.api_me_bundle_v2((select token from pat_test_state))->>'_error',
  'rate_limit_exceeded',
  'rate limit persiste no banco e bloqueia acima de 60/min'
);
reset role;

select is(
  (select request_count from public.personal_access_token_rate_limits r
   join pat_test_state s on s.token_id = r.token_id),
  61,
  'contador bloqueado permanece persistido entre instâncias'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"e3500000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
select public.revoke_personal_access_token((select token_id from pat_test_state));
reset role;

select ok(
  exists (
    select 1 from public.personal_access_tokens p
    join pat_test_state s on s.token_id = p.id
    where p.revoked_at is not null
  )
  and exists (
    select 1 from public.audit_log a
    join pat_test_state s on s.token_id = a.resource_id
    where a.resource_type = 'personal_access_token'
      and a.action = 'update'
      and a.metadata->>'operation' = 'revoke'
  ),
  'revogação é server-side e auditada'
);

set local role anon;
select throws_ok(
  format(
    'select public.api_me_bundle_v2(%L)',
    (select token from pat_test_state)
  ),
  '28000', 'Credencial inválida.',
  'PAT revogado deixa de autorizar imediatamente'
);
reset role;

select * from finish();
rollback;
