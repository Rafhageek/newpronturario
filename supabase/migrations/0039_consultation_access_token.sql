-- ============================================================================
-- HubPatients — Migration 0039 — Token de consulta (Modo Consulta)
--
-- Problema: `issue_personal_access_token` exige AAL2 (2FA). Isso é correto para
-- um PAT de API com até 90 dias de validade, mas inviabiliza o Modo Consulta —
-- o público-alvo (idoso, no consultório, com o médico esperando) não tem 2FA.
--
-- Solução: uma RPC SEPARADA, com superfície muito menor, que dispensa AAL2 em
-- troca de limites rígidos aplicados NO BANCO (não no cliente):
--   * validade máxima de 24 horas (contra 90 dias do PAT de API);
--   * apenas escopos de LEITURA clínica; nunca `read:profile` (CPF/endereço);
--   * no máximo 3 tokens de consulta ativos por titular;
--   * nome fixo, para distinguir de PAT de API na tela e na auditoria.
-- O PAT de API continua exigindo AAL2 — nada é relaxado lá.
--
-- Forward-only, aditiva e idempotente.
-- ============================================================================

create or replace function public.issue_consultation_access_token(
  p_scopes text[],
  p_hours integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_scopes text[];
  v_hours integer := coalesce(p_hours, 1);
  v_expires_at timestamptz;
  v_token text;
  v_token_hash text;
  v_token_id uuid;
  v_created_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Operação não permitida.' using errcode = '42501';
  end if;

  -- Teto de 24 h aplicado no banco: o cliente não consegue pedir mais.
  if v_hours < 1 or v_hours > 24 then
    raise exception 'Validade do acesso inválida (1 a 24 horas).' using errcode = '22023';
  end if;
  v_expires_at := now() + make_interval(hours => v_hours);

  select coalesce(array_agg(scope order by scope), '{}'::text[])
    into v_scopes
    from (
      select distinct btrim(scope) as scope
      from unnest(coalesce(p_scopes, '{}'::text[])) as requested(scope)
      where btrim(scope) <> ''
    ) normalized;

  -- Subconjunto clínico de leitura. `read:profile` fica DE FORA de propósito:
  -- carrega dados cadastrais que o médico não precisa para ver a evolução.
  if cardinality(v_scopes) < 1
     or not (v_scopes <@ array[
       'read:medications',
       'read:vitals',
       'read:allergies',
       'read:exams'
     ]::text[]) then
    raise exception 'Escopo de consulta inválido.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  -- Limite próprio, mais apertado que o do PAT de API (10).
  if (
    select count(*)
    from public.personal_access_tokens
    where user_id = v_user_id
      and name = 'Consulta médica'
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) >= 3 then
    raise exception 'Você já tem 3 acessos de consulta ativos. Revogue um antes de gerar outro.'
      using errcode = 'check_violation';
  end if;

  v_token := 'vlk_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.personal_access_tokens (
    user_id, name, token_hash, token_prefix, scopes, expires_at
  )
  values (
    v_user_id,
    'Consulta médica',
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
    'consultation_access_token',
    v_token_id,
    jsonb_build_object(
      'scopes', to_jsonb(v_scopes),
      'expires_at', v_expires_at,
      'hours', v_hours
    )
  );

  return jsonb_build_object(
    'id', v_token_id,
    'token', v_token,
    'scopes', to_jsonb(v_scopes),
    'expires_at', v_expires_at,
    'created_at', v_created_at
  );
end;
$$;

revoke all on function public.issue_consultation_access_token(text[], integer) from public, anon;
grant execute on function public.issue_consultation_access_token(text[], integer) to authenticated;

comment on function public.issue_consultation_access_token(text[], integer) is
  'Modo Consulta: acesso de leitura por no máximo 24 h, sem exigir AAL2. Limites (validade, escopo, quantidade) são aplicados no banco.';
