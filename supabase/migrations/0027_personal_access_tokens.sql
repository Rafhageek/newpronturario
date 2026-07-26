-- ============================================================================
-- VidaLog — Migration 0027 — Tokens de acesso pessoal (acesso de IA ao prontuário)
--
-- Base para "meu assistente de IA acessa meu prontuário" SEM compartilhar
-- login/senha. O usuário gera um token (mostrado UMA vez); guardamos só o HASH.
-- Um endpoint lê os dados do PRÓPRIO usuário, restrito aos escopos do token.
--
-- Segurança (mesmo modelo do calendar_feed): a leitura é uma função SECURITY
-- DEFINER gateada pelo HASH do token (o token é o segredo) — sem service_role
-- no servidor web. Toda leitura é auditada.
--
-- Usa has_plus_access() (0026) + consents (0007). IDEMPOTENTE.
-- ============================================================================

create table if not exists public.personal_access_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  token_hash   text not null unique,        -- SHA-256 do token (NUNCA o token em claro)
  token_prefix text not null,               -- ex.: "vlk_ab12…" só para exibir na lista
  scopes       text[] not null default '{}',-- ex.: read:profile, read:medications…
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists pat_user_idx on public.personal_access_tokens (user_id, created_at desc);

alter table public.personal_access_tokens enable row level security;
drop policy if exists "pat_select_own" on public.personal_access_tokens;
create policy "pat_select_own" on public.personal_access_tokens
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "pat_insert_own" on public.personal_access_tokens;
create policy "pat_insert_own" on public.personal_access_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "pat_update_own" on public.personal_access_tokens;
create policy "pat_update_own" on public.personal_access_tokens
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "pat_delete_own" on public.personal_access_tokens;
create policy "pat_delete_own" on public.personal_access_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────
-- Elegibilidade do "assistente de IA mínimo": Plus (voucher) OU consentimento
-- de compartilhamento ativo (pesquisa/laboratório/médico). NÃO afrouxa nenhum
-- guardrail ético — só liga a flag.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.has_ai_assistant_access(uid uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_plus_access(coalesce(uid, (select auth.uid())))
    or exists (
      select 1 from public.consents c
      where c.patient_id = coalesce(uid, (select auth.uid()))
        and c.granted = true
        and c.purpose in ('research', 'data_sharing_lab', 'data_sharing_doctor')
    );
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Leitura via token: gateada pelo HASH (o token é o segredo). Retorna um pacote
-- no estilo FHIR, restrito aos ESCOPOS do token. Atualiza last_used + audita.
-- O servidor web só passa o hash; nenhum dado de outro usuário é acessível sem
-- o token correspondente (hash de 256 bits — inviável adivinhar).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.api_me_bundle(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t record;
  uid uuid;
  result jsonb;
begin
  select * into t from public.personal_access_tokens
   where token_hash = p_token_hash
     and revoked_at is null
     and (expires_at is null or expires_at > now());
  if not found then
    raise exception 'Token inválido ou expirado.' using errcode = 'check_violation';
  end if;
  uid := t.user_id;

  update public.personal_access_tokens set last_used_at = now() where id = t.id;
  insert into public.audit_log (actor_id, patient_id, action, resource_type, resource_id, metadata)
    values (uid, uid, 'read', 'api_token_access', t.id, jsonb_build_object('scopes', t.scopes));

  result := jsonb_build_object('resourceType', 'Bundle', 'generatedAt', now());

  if 'read:profile' = any (t.scopes) then
    result := result || jsonb_build_object('patient', (
      select jsonb_build_object(
        'resourceType', 'Patient', 'name', p.full_name, 'birthDate', p.date_of_birth,
        'gender', p.biological_sex, 'bloodType', p.blood_type)
      from public.profiles p where p.id = uid));
  end if;

  if 'read:medications' = any (t.scopes) then
    result := result || jsonb_build_object('medications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'resourceType', 'MedicationStatement', 'name', m.name, 'dosage', m.dosage,
        'form', m.form, 'frequency', m.frequency, 'status', case when m.active then 'active' else 'inactive' end))
      from public.medications m where m.patient_id = uid and m.active), '[]'::jsonb));
  end if;

  if 'read:vitals' = any (t.scopes) then
    result := result || jsonb_build_object('vitals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'resourceType', 'Observation', 'type', v.type, 'value', v.value_primary,
        'valueSecondary', v.value_secondary, 'unit', v.unit, 'effectiveDateTime', v.measured_at))
      from (select * from public.vitals where patient_id = uid order by measured_at desc limit 100) v), '[]'::jsonb));
  end if;

  if 'read:allergies' = any (t.scopes) then
    result := result || jsonb_build_object('allergies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'resourceType', 'AllergyIntolerance', 'substance', a.substance,
        'criticality', a.severity, 'reaction', a.reaction))
      from public.allergies a where a.patient_id = uid), '[]'::jsonb));
  end if;

  if 'read:exams' = any (t.scopes) then
    result := result || jsonb_build_object('exams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'resourceType', 'DiagnosticReport', 'title', e.title, 'category', e.category,
        'effectiveDateTime', e.exam_date, 'status', e.status))
      from public.exams e where e.patient_id = uid), '[]'::jsonb));
  end if;

  return result;
end; $$;
