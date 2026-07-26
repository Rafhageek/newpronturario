-- ============================================================================
-- HubPatients — Migration 0035 — Personal Access Tokens P2
--
-- Expande o modelo de PAT sem invalidar tokens já emitidos pelo endpoint v1:
--   * emissão/revogação somente por RPC autenticada;
--   * segredo gerado no servidor e exibido uma única vez;
--   * hash armazenado nunca é aceito como bearer;
--   * escopos e expiração validados no banco;
--   * rate limit persistente e atômico por token;
--   * auditoria sem segredo, hash ou prefixo completo.
--
-- Forward-only. A função api_me_bundle(text) antiga permanece no catálogo para
-- evitar dependências quebradas, mas perde EXECUTE para papéis da API.
-- ============================================================================

-- PATs legados podiam ter duração indefinida. Para não quebrá-los no momento do
-- deploy nem manter acesso sem prazo, tokens ativos recebem uma janela única de
-- 14 dias para rotação. Revogados recebem o próprio instante de revogação.
with legacy_expiration as (
  update public.personal_access_tokens
     set expires_at = case
       when revoked_at is null then now() + interval '14 days'
       else coalesce(revoked_at, now())
     end
   where expires_at is null
  returning id, user_id, expires_at, revoked_at is null as rotation_required
)
insert into public.audit_log (
  actor_id, patient_id, action, resource_type, resource_id, metadata
)
select
  user_id,
  user_id,
  'update',
  'personal_access_token',
  id,
  jsonb_build_object(
    'operation', 'legacy_expiration_assigned',
    'expires_at', expires_at,
    'rotation_required', rotation_required
  )
from legacy_expiration;

alter table public.personal_access_tokens
  drop constraint if exists personal_access_tokens_expires_required;
alter table public.personal_access_tokens
  add constraint personal_access_tokens_expires_required
  check (expires_at is not null) not valid;

-- Somente os cinco escopos de leitura implementados pelo bundle v1 são válidos.
alter table public.personal_access_tokens
  drop constraint if exists personal_access_tokens_scopes_allowed;
alter table public.personal_access_tokens
  add constraint personal_access_tokens_scopes_allowed
  check (
    cardinality(scopes) between 1 and 5
    and scopes <@ array[
      'read:profile',
      'read:medications',
      'read:vitals',
      'read:allergies',
      'read:exams'
    ]::text[]
  ) not valid;

-- Bloqueia emissão, alteração e exclusão direta. A leitura dos metadados do
-- próprio titular continua disponível para compatibilidade com a exportação
-- LGPD, que seleciona explicitamente campos e nunca inclui token_hash.
drop policy if exists "pat_insert_own" on public.personal_access_tokens;
drop policy if exists "pat_update_own" on public.personal_access_tokens;
drop policy if exists "pat_delete_own" on public.personal_access_tokens;
revoke insert, update, delete on table public.personal_access_tokens from anon, authenticated;

-- Uma única linha por token é suficiente: ao virar a janela, o contador é
-- reiniciado atomicamente. Não há rate limit em memória de instância serverless.
create table if not exists public.personal_access_token_rate_limits (
  token_id          uuid primary key
                    references public.personal_access_tokens (id) on delete cascade,
  window_started_at timestamptz not null,
  request_count     integer not null check (request_count >= 1),
  updated_at        timestamptz not null default now()
);

alter table public.personal_access_token_rate_limits enable row level security;
revoke all on table public.personal_access_token_rate_limits from public, anon, authenticated;

-- Remove o vetor de reutilização do hash: a função legada comparava diretamente
-- o argumento recebido com token_hash. O endpoint v1 passa a usar a função v2.
revoke execute on function public.api_me_bundle(text) from public, anon, authenticated;

create or replace function public.issue_personal_access_token(
  p_name text,
  p_scopes text[],
  p_expires_at timestamptz default (now() + interval '90 days')
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_scopes text[];
  v_expires_at timestamptz := coalesce(p_expires_at, now() + interval '90 days');
  v_token text;
  v_token_hash text;
  v_token_id uuid;
  v_created_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Operação não permitida.' using errcode = '42501';
  end if;

  -- PAT amplia a duração e a superfície de acesso da sessão. A confirmação no
  -- cliente não é uma fronteira de segurança; a garantia AAL2 é conferida pelo
  -- JWT dentro do banco e falha fechada quando ausente ou inválida.
  if coalesce((select auth.jwt() ->> 'aal'), '') <> 'aal2' then
    raise exception 'Autenticação reforçada necessária.' using errcode = '42501';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Dados do token inválidos.' using errcode = '22023';
  end if;

  select coalesce(array_agg(scope order by scope), '{}'::text[])
    into v_scopes
    from (
      select distinct btrim(scope) as scope
      from unnest(coalesce(p_scopes, '{}'::text[])) as requested(scope)
      where btrim(scope) <> ''
    ) normalized;

  if cardinality(v_scopes) < 1
     or not (v_scopes <@ array[
       'read:profile',
       'read:medications',
       'read:vitals',
       'read:allergies',
       'read:exams'
     ]::text[]) then
    raise exception 'Dados do token inválidos.' using errcode = '22023';
  end if;

  if v_expires_at <= now() + interval '5 minutes'
     or v_expires_at > now() + interval '90 days 5 minutes' then
    raise exception 'Expiração do token inválida.' using errcode = '22023';
  end if;

  -- Serializa emissões concorrentes do mesmo titular para respeitar o limite.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  if (
    select count(*)
    from public.personal_access_tokens
    where user_id = v_user_id
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) >= 10 then
    raise exception 'Limite de tokens ativos atingido.' using errcode = 'check_violation';
  end if;

  -- 256 bits aleatórios. O valor em claro existe apenas nesta transação e na
  -- resposta da emissão; somente SHA-256 é persistido.
  v_token := 'vlk_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.personal_access_tokens (
    user_id, name, token_hash, token_prefix, scopes, expires_at
  )
  values (
    v_user_id,
    v_name,
    v_token_hash,
    substr(v_token, 1, 12) || '…',
    v_scopes,
    v_expires_at
  )
  returning id, created_at into v_token_id, v_created_at;

  insert into public.audit_log (
    actor_id, patient_id, action, resource_type, resource_id, metadata
  ) values (
    v_user_id,
    v_user_id,
    'create',
    'personal_access_token',
    v_token_id,
    jsonb_build_object(
      'scopes', to_jsonb(v_scopes),
      'expires_at', v_expires_at,
      'issuance', 'server_side'
    )
  );

  return jsonb_build_object(
    'token', v_token,
    'id', v_token_id,
    'name', v_name,
    'token_prefix', substr(v_token, 1, 12) || '…',
    'scopes', to_jsonb(v_scopes),
    'expires_at', v_expires_at,
    'created_at', v_created_at
  );
end;
$$;

create or replace function public.revoke_personal_access_token(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_scopes text[];
begin
  if v_user_id is null then
    raise exception 'Operação não permitida.' using errcode = '42501';
  end if;

  update public.personal_access_tokens
     set revoked_at = now()
   where id = p_token_id
     and user_id = v_user_id
     and revoked_at is null
  returning scopes into v_scopes;

  if not found then
    -- Mensagem deliberadamente genérica: não revela existência/propriedade.
    raise exception 'Operação não permitida.' using errcode = '42501';
  end if;

  insert into public.audit_log (
    actor_id, patient_id, action, resource_type, resource_id, metadata
  ) values (
    v_user_id,
    v_user_id,
    'update',
    'personal_access_token',
    p_token_id,
    jsonb_build_object('operation', 'revoke', 'scopes', to_jsonb(v_scopes))
  );
end;
$$;

-- O argumento é sempre o bearer em claro. A função calcula o digest internamente,
-- portanto copiar token_hash do banco e enviá-lo como bearer produz outro hash e
-- falha. Tokens antigos continuam válidos porque usavam o mesmo SHA-256.
create or replace function public.api_me_bundle_v2(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_token_hash text;
  v_token record;
  v_window timestamptz := date_trunc('minute', clock_timestamp());
  v_request_count integer;
  v_result jsonb;
begin
  -- Aceita os dois formatos já emitidos: base64url (web antiga) e hex (mobile e
  -- emissão nova). Limite rígido impede payloads anormalmente grandes.
  if p_token is null
     or char_length(p_token) < 47
     or char_length(p_token) > 132
     or p_token !~ '^vlk_[A-Za-z0-9_-]+$' then
    raise exception 'Credencial inválida.' using errcode = '28000';
  end if;

  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select id, user_id, scopes
    into v_token
    from public.personal_access_tokens
   where token_hash = v_token_hash
     and revoked_at is null
     and expires_at is not null
     and expires_at > now();

  if not found then
    raise exception 'Credencial inválida.' using errcode = '28000';
  end if;

  insert into public.personal_access_token_rate_limits (
    token_id, window_started_at, request_count, updated_at
  ) values (
    v_token.id, v_window, 1, clock_timestamp()
  )
  on conflict (token_id) do update
    set window_started_at = case
          when public.personal_access_token_rate_limits.window_started_at < excluded.window_started_at
            then excluded.window_started_at
          else public.personal_access_token_rate_limits.window_started_at
        end,
        request_count = case
          when public.personal_access_token_rate_limits.window_started_at < excluded.window_started_at
            then 1
          else public.personal_access_token_rate_limits.request_count + 1
        end,
        updated_at = excluded.updated_at
  returning request_count into v_request_count;

  if v_request_count > 60 then
    -- A transação do erro faria rollback do contador; retorna uma resposta interna
    -- marcada para que o endpoint produza 429 sem desfazer o estado persistente.
    return jsonb_build_object('_error', 'rate_limit_exceeded', '_retry_after', 60);
  end if;

  update public.personal_access_tokens
     set last_used_at = now()
   where id = v_token.id;

  insert into public.audit_log (
    actor_id, patient_id, action, resource_type, resource_id, metadata
  ) values (
    v_token.user_id,
    v_token.user_id,
    'read',
    'api_token_access',
    v_token.id,
    jsonb_build_object(
      'scopes', to_jsonb(v_token.scopes),
      'api_version', 'v1',
      'auth_method', 'personal_access_token'
    )
  );

  v_result := jsonb_build_object('resourceType', 'Bundle', 'generatedAt', now());

  if 'read:profile' = any (v_token.scopes) then
    v_result := v_result || jsonb_build_object('patient', (
      select jsonb_build_object(
        'resourceType', 'Patient', 'name', p.full_name, 'birthDate', p.date_of_birth,
        'gender', p.biological_sex, 'bloodType', p.blood_type)
      from public.profiles p where p.id = v_token.user_id));
  end if;

  if 'read:medications' = any (v_token.scopes) then
    v_result := v_result || jsonb_build_object('medications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'resourceType', 'MedicationStatement', 'name', m.name, 'dosage', m.dosage,
        'form', m.form, 'frequency', m.frequency,
        'status', case when m.active then 'active' else 'inactive' end))
      from public.medications m
      where m.patient_id = v_token.user_id and m.active), '[]'::jsonb));
  end if;

  if 'read:vitals' = any (v_token.scopes) then
    v_result := v_result || jsonb_build_object('vitals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'resourceType', 'Observation', 'type', v.type, 'value', v.value_primary,
        'valueSecondary', v.value_secondary, 'unit', v.unit,
        'effectiveDateTime', v.measured_at))
      from (
        select * from public.vitals
        where patient_id = v_token.user_id
        order by measured_at desc limit 100
      ) v), '[]'::jsonb));
  end if;

  if 'read:allergies' = any (v_token.scopes) then
    v_result := v_result || jsonb_build_object('allergies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'resourceType', 'AllergyIntolerance', 'substance', a.substance,
        'criticality', a.severity, 'reaction', a.reaction))
      from public.allergies a where a.patient_id = v_token.user_id), '[]'::jsonb));
  end if;

  if 'read:exams' = any (v_token.scopes) then
    v_result := v_result || jsonb_build_object('exams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'resourceType', 'DiagnosticReport', 'title', e.title, 'category', e.category,
        'effectiveDateTime', e.exam_date, 'status', e.status))
      from public.exams e where e.patient_id = v_token.user_id), '[]'::jsonb));
  end if;

  return v_result;
end;
$$;

revoke execute on function public.issue_personal_access_token(text, text[], timestamptz)
  from public, anon;
grant execute on function public.issue_personal_access_token(text, text[], timestamptz)
  to authenticated;

revoke execute on function public.revoke_personal_access_token(uuid)
  from public, anon;
grant execute on function public.revoke_personal_access_token(uuid)
  to authenticated;

revoke execute on function public.api_me_bundle_v2(text)
  from public, authenticated;
grant execute on function public.api_me_bundle_v2(text)
  to anon;

comment on function public.issue_personal_access_token(text, text[], timestamptz) is
  'Emite PAT server-side e retorna o segredo uma única vez; nunca registrar a resposta.';
comment on function public.api_me_bundle_v2(text) is
  'Valida bearer em claro, aplica rate limit persistente e retorna bundle v1 auditado.';
