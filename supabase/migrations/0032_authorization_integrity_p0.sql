-- ============================================================================
-- HubPatients — Migration 0032 — Autorização e integridade clínica P0
--
-- Correções aditivas:
--   1. cuidador não reativa vínculo revogado por UPDATE direto;
--   2. consentimento vigente é único e alterado por RPC atômica/auditada;
--   3. tomada e agenda de medicamento pertencem ao mesmo paciente;
--   4. dados pediátricos separam leitura de mutação (mutação só pelo responsável);
--   5. feed anônimo de calendário não retorna link de teleatendimento;
--   6. cuidador recebe perfil mínimo, sem CPF/endereço/token de calendário;
--   7. audit_log não aceita falsificação direta e sobrevive à remoção da conta;
--   8. processamento de exame por IA exige consentimento específico vigente.
--
-- A deduplicação conservadora de consentimentos mantém a versão atualizada mais
-- recentemente antes de criar a unicidade. Executar em janela de manutenção:
-- a criação dos índices/FKs adquire locks curtos nas tabelas envolvidas.
-- ============================================================================

-- ── 1) Transições seguras do vínculo de cuidado ──────────────────────────────
-- O RPC de aceite é SECURITY DEFINER e valida convite/e-mail. UPDATE direto por
-- cuidador pode apenas revogar o próprio acesso; reativação exige novo convite.
create or replace function public.guard_care_permission_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  -- Operações internas validadas por RPC SECURITY DEFINER e administração.
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if uid is null then
    raise exception 'Não autenticado.' using errcode = 'insufficient_privilege';
  end if;

  -- Participantes nunca são mutáveis, nem pelo paciente.
  if new.patient_id is distinct from old.patient_id
     or new.caregiver_id is distinct from old.caregiver_id then
    raise exception 'Não é permitido alterar os participantes do vínculo.'
      using errcode = 'check_violation';
  end if;

  if uid <> old.patient_id then
    if uid <> old.caregiver_id then
      raise exception 'Sem permissão para alterar este vínculo.'
        using errcode = 'insufficient_privilege';
    end if;

    if new.permissions is distinct from old.permissions
       or new.kind is distinct from old.kind
       or new.invited_at is distinct from old.invited_at
       or new.accepted_at is distinct from old.accepted_at
       or new.created_at is distinct from old.created_at then
      raise exception 'O cuidador não pode alterar permissões ou metadados do vínculo.'
        using errcode = 'check_violation';
    end if;

    if old.status = 'revoked' or new.status <> 'revoked' then
      raise exception 'Um vínculo revogado só pode ser reativado por um novo convite.'
        using errcode = 'check_violation';
    end if;

    new.revoked_at := coalesce(new.revoked_at, now());
    return new;
  end if;

  -- O paciente controla permissões e estado, mas timestamps acompanham o estado.
  if new.status = 'pending' then
    new.accepted_at := null;
    new.revoked_at := null;
  elsif new.status = 'accepted' then
    new.accepted_at := coalesce(new.accepted_at, now());
    new.revoked_at := null;
  elsif new.status = 'revoked' then
    new.revoked_at := coalesce(new.revoked_at, now());
  end if;

  return new;
end;
$$;

revoke all on function public.guard_care_permission_change() from public, anon, authenticated;

-- Recria o aceite com lock pessimista: um token só pode ser consumido uma vez.
create or replace function public.accept_caregiver_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.caregiver_invites;
  me uuid := (select auth.uid());
  my_email text := (select auth.jwt() ->> 'email');
  p_id uuid;
  c_id uuid;
  rel_id uuid;
begin
  if me is null or my_email is null then
    raise exception 'Não autenticado.' using errcode = 'insufficient_privilege';
  end if;

  select *
    into inv
    from public.caregiver_invites
   where token = invite_token
     and status = 'pending'
     and expires_at > now()
   for update;

  if not found then
    raise exception 'Convite inválido ou expirado.' using errcode = 'invalid_parameter_value';
  end if;

  if lower(inv.invitee_email) <> lower(my_email)
     or not exists (
       select 1
         from auth.users u
        where u.id = me
          and u.email_confirmed_at is not null
          and lower(u.email) = lower(inv.invitee_email)
     ) then
    raise exception 'Este convite requer uma conta com e-mail confirmado.'
      using errcode = 'insufficient_privilege';
  end if;

  if inv.role = 'i_am_caregiver' then
    p_id := me;
    c_id := inv.inviter_id;
  elsif inv.role = 'i_am_patient' then
    p_id := inv.inviter_id;
    c_id := me;
  else
    raise exception 'Papel de convite inválido.' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.care_relationships
    (patient_id, caregiver_id, kind, status, permissions, accepted_at, revoked_at)
  values
    (p_id, c_id, inv.kind, 'accepted', inv.permissions, now(), null)
  on conflict (patient_id, caregiver_id)
  do update
        set status = 'accepted',
            kind = excluded.kind,
            permissions = excluded.permissions,
            accepted_at = now(),
            revoked_at = null
  returning id into rel_id;

  update public.caregiver_invites
     set status = 'accepted',
         accepted_at = now()
   where id = inv.id
     and status = 'pending';

  if not found then
    raise exception 'Convite já consumido.' using errcode = 'serialization_failure';
  end if;

  return rel_id;
end;
$$;

revoke all on function public.accept_caregiver_invite(text) from public, anon;
grant execute on function public.accept_caregiver_invite(text) to authenticated;

-- ── 2) Consentimento único, atômico e fail-closed ────────────────────────────
alter type consent_purpose add value if not exists 'ai_exam_processing';
-- PostgreSQL 15 permite ADD VALUE; o novo literal só é consumido pela aplicação
-- após o commit desta migration (não é referenciado abaixo).
alter type metric_flag add value if not exists 'unclassified';

-- TRANSAÇÃO EXPLÍCITA, e só aqui.
--
-- O arquivo roda FORA de transação de propósito: `alter type ... add value`
-- (acima) não é permitido dentro de um bloco transacional. Só que `lock table`
-- é o oposto — exige transação, e sem ela o PostgreSQL recusa com
-- "LOCK TABLE can only be used in transaction blocks (25P01)", derrubando a
-- migração inteira. Era isso que quebrava o `supabase db reset` no CI e o que
-- impedia aplicar este arquivo pela CLI.
--
-- O lock existe para que a deduplicação e a criação do índice único aconteçam
-- sem escrita concorrente no meio: sem ele, uma linha inserida entre o DELETE e
-- o CREATE INDEX faria o índice falhar. Então o certo não é remover o lock, e
-- sim dar a ele a transação que falta — abrangendo exatamente os três passos
-- que precisam ser atômicos entre si.
begin;

lock table public.consents in share row exclusive mode;

with ranked as (
  select id,
         row_number() over (
           partition by patient_id, purpose
           order by updated_at desc, created_at desc, id desc
         ) as position
    from public.consents
)
delete from public.consents c
 using ranked r
 where c.id = r.id
   and r.position > 1;

create unique index if not exists consents_patient_purpose_unique
  on public.consents (patient_id, purpose);

commit;

-- Toda escrita passa pelo RPC para que consentimento e auditoria confirmem ou
-- revertam juntos na mesma transação.
drop policy if exists "consents_modify_owner" on public.consents;
revoke insert, update, delete on table public.consents from anon, authenticated;

create or replace function public.set_patient_consent(
  p_purpose consent_purpose,
  p_granted boolean,
  p_scope jsonb default '{}'::jsonb,
  p_version text default 'v1'
)
returns public.consents
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  saved public.consents;
begin
  if uid is null then
    raise exception 'Não autenticado.' using errcode = 'insufficient_privilege';
  end if;
  if p_scope is null or jsonb_typeof(p_scope) <> 'object' then
    raise exception 'O escopo do consentimento deve ser um objeto JSON.'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_version is null or length(trim(p_version)) < 1 or length(p_version) > 40 then
    raise exception 'Versão de consentimento inválida.'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.consents
    (patient_id, purpose, scope, granted, version, granted_at, revoked_at)
  values
    (
      uid,
      p_purpose,
      p_scope,
      p_granted,
      trim(p_version),
      case when p_granted then now() else null end,
      case when p_granted then null else now() end
    )
  on conflict (patient_id, purpose)
  do update
        set scope = excluded.scope,
            granted = excluded.granted,
            version = excluded.version,
            granted_at = case
              when excluded.granted then coalesce(public.consents.granted_at, now())
              else null
            end,
            revoked_at = case when excluded.granted then null else now() end
  returning * into saved;

  insert into public.audit_log
    (actor_id, patient_id, action, resource_type, resource_id, metadata)
  values
    (
      uid,
      uid,
      case when p_granted then 'share' else 'update' end,
      'consent',
      saved.id,
      jsonb_build_object(
        'purpose', p_purpose::text,
        'granted', p_granted,
        'version', trim(p_version)
      )
    );

  return saved;
end;
$$;

revoke all on function public.set_patient_consent(consent_purpose, boolean, jsonb, text)
  from public, anon;
grant execute on function public.set_patient_consent(consent_purpose, boolean, jsonb, text)
  to authenticated;

-- Gate específico: não reutiliza consentimento de pesquisa/médico/laboratório e
-- não recebe uid arbitrário.
create or replace function public.can_process_exam_with_ai()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
         from public.consents c
        where c.patient_id = (select auth.uid())
          and c.purpose::text = 'ai_exam_processing'
          and c.granted = true
          and c.revoked_at is null
     );
$$;

revoke all on function public.can_process_exam_with_ai() from public, anon;
grant execute on function public.can_process_exam_with_ai() to authenticated;

create or replace function public.log_ai_exam_processing(p_exam_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  exam_owner uuid;
  consent_id uuid;
  consent_version text;
begin
  if uid is null then
    raise exception 'Não autenticado.' using errcode = 'insufficient_privilege';
  end if;
  if not public.can_process_exam_with_ai() then
    raise exception 'Consentimento específico para IA ausente ou revogado.'
      using errcode = 'insufficient_privilege';
  end if;

  select e.patient_id
    into exam_owner
    from public.exams e
   where e.id = p_exam_id
     and e.patient_id = uid;

  if not found then
    raise exception 'Exame não encontrado para o usuário autenticado.'
      using errcode = 'insufficient_privilege';
  end if;

  select c.id, c.version
    into consent_id, consent_version
    from public.consents c
   where c.patient_id = uid
     and c.purpose::text = 'ai_exam_processing'
     and c.granted = true
     and c.revoked_at is null;

  if not found then
    raise exception 'Consentimento específico para IA não pôde ser confirmado.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_log
    (actor_id, patient_id, action, resource_type, resource_id, metadata)
  values
    (
      uid,
      exam_owner,
      'share',
      'exam_ai_processing',
      p_exam_id,
      jsonb_build_object(
        'provider', 'anthropic',
        'consent_id', consent_id,
        'consent_version', consent_version
      )
    );
end;
$$;

revoke all on function public.log_ai_exam_processing(uuid) from public, anon;
grant execute on function public.log_ai_exam_processing(uuid) to authenticated;

-- ── 3) Integridade paciente ↔ medicamento ↔ tomada/agenda ───────────────────
create unique index if not exists medications_id_patient_unique
  on public.medications (id, patient_id);

create unique index if not exists medication_schedules_id_med_patient_unique
  on public.medication_schedules (id, medication_id, patient_id);

alter table public.medication_schedules
  drop constraint if exists medication_schedules_medication_patient_fkey;
alter table public.medication_schedules
  add constraint medication_schedules_medication_patient_fkey
  foreign key (medication_id, patient_id)
  references public.medications (id, patient_id)
  on delete cascade
  not valid;

alter table public.medication_intakes
  drop constraint if exists medication_intakes_medication_patient_fkey;
alter table public.medication_intakes
  add constraint medication_intakes_medication_patient_fkey
  foreign key (medication_id, patient_id)
  references public.medications (id, patient_id)
  on delete cascade
  not valid;

alter table public.medication_intakes
  drop constraint if exists medication_intakes_schedule_med_patient_fkey;
alter table public.medication_intakes
  add constraint medication_intakes_schedule_med_patient_fkey
  foreign key (schedule_id, medication_id, patient_id)
  references public.medication_schedules (id, medication_id, patient_id)
  on delete set null (schedule_id)
  not valid;

-- Corrige também UPDATE de uma tomada já marcada como taken para outro
-- medicamento: restaura o antigo e debita o novo, sempre conferindo patient_id.
create or replace function public.adjust_medication_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'taken' then
      update public.medications
         set stock_count = greatest(0, stock_count - 1),
             stock_last_updated_at = now()
       where id = new.medication_id
         and patient_id = new.patient_id
         and stock_count is not null;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'taken' then
      update public.medications
         set stock_count = stock_count + 1,
             stock_last_updated_at = now()
       where id = old.medication_id
         and patient_id = old.patient_id
         and stock_count is not null;
    end if;
    return old;
  end if;

  if old.status = 'taken'
     and (
       new.status is distinct from 'taken'
       or new.medication_id is distinct from old.medication_id
       or new.patient_id is distinct from old.patient_id
     ) then
    update public.medications
       set stock_count = stock_count + 1,
           stock_last_updated_at = now()
     where id = old.medication_id
       and patient_id = old.patient_id
       and stock_count is not null;
  end if;

  if new.status = 'taken'
     and (
       old.status is distinct from 'taken'
       or new.medication_id is distinct from old.medication_id
       or new.patient_id is distinct from old.patient_id
     ) then
    update public.medications
       set stock_count = greatest(0, stock_count - 1),
           stock_last_updated_at = now()
     where id = new.medication_id
       and patient_id = new.patient_id
       and stock_count is not null;
  end if;

  return new;
end;
$$;

revoke all on function public.adjust_medication_stock() from public, anon, authenticated;

-- Permissões explícitas onde o produto já possui controles correspondentes.
drop policy if exists "diary_select" on public.diary_entries;
create policy "diary_select" on public.diary_entries
  for select to authenticated
  using (
    patient_id = (select auth.uid())
    or public.caregiver_has_permission(patient_id, 'ver_vitais')
    or public.caregiver_has_permission(patient_id, 'diary')
  );

drop policy if exists "medications_select" on public.medications;
create policy "medications_select" on public.medications
  for select to authenticated
  using (
    patient_id = (select auth.uid())
    or public.caregiver_has_permission(patient_id, 'registrar_tomada')
    or public.caregiver_has_permission(patient_id, 'receber_alertas')
    or public.caregiver_has_permission(patient_id, 'medications')
  );

drop policy if exists "med_schedules_select" on public.medication_schedules;
create policy "med_schedules_select" on public.medication_schedules
  for select to authenticated
  using (
    patient_id = (select auth.uid())
    or public.caregiver_has_permission(patient_id, 'registrar_tomada')
    or public.caregiver_has_permission(patient_id, 'receber_alertas')
    or public.caregiver_has_permission(patient_id, 'medications')
  );

drop policy if exists "med_intakes_select" on public.medication_intakes;
create policy "med_intakes_select" on public.medication_intakes
  for select to authenticated
  using (
    patient_id = (select auth.uid())
    or public.caregiver_has_permission(patient_id, 'registrar_tomada')
    or public.caregiver_has_permission(patient_id, 'receber_alertas')
    or public.caregiver_has_permission(patient_id, 'medications')
  );

drop policy if exists "appointments_select" on public.appointments;
create policy "appointments_select" on public.appointments
  for select to authenticated
  using (
    patient_id = (select auth.uid())
    or public.caregiver_has_permission(patient_id, 'agendar_consulta')
  );

-- ── 4) Pediatria: leitura compartilhada, mutação somente pelo responsável ───
create or replace function public.owns_child(p_child uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.children c
     where c.id = p_child
       and c.parent_profile_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_child(uuid) from public, anon;
grant execute on function public.owns_child(uuid) to authenticated;

drop policy if exists "children_access" on public.children;
drop policy if exists "children_select" on public.children;
drop policy if exists "children_insert_owner" on public.children;
drop policy if exists "children_update_owner" on public.children;
drop policy if exists "children_delete_owner" on public.children;

create policy "children_select" on public.children
  for select to authenticated
  using (public.can_access_child(id));
create policy "children_insert_owner" on public.children
  for insert to authenticated
  with check (parent_profile_id = (select auth.uid()));
create policy "children_update_owner" on public.children
  for update to authenticated
  using (parent_profile_id = (select auth.uid()))
  with check (parent_profile_id = (select auth.uid()));
create policy "children_delete_owner" on public.children
  for delete to authenticated
  using (parent_profile_id = (select auth.uid()));

drop policy if exists "child_growth_access" on public.child_growth_measurements;
drop policy if exists "child_growth_select" on public.child_growth_measurements;
drop policy if exists "child_growth_insert_owner" on public.child_growth_measurements;
drop policy if exists "child_growth_update_owner" on public.child_growth_measurements;
drop policy if exists "child_growth_delete_owner" on public.child_growth_measurements;

create policy "child_growth_select" on public.child_growth_measurements
  for select to authenticated
  using (public.can_access_child(child_id));
create policy "child_growth_insert_owner" on public.child_growth_measurements
  for insert to authenticated
  with check (public.owns_child(child_id));
create policy "child_growth_update_owner" on public.child_growth_measurements
  for update to authenticated
  using (public.owns_child(child_id))
  with check (public.owns_child(child_id));
create policy "child_growth_delete_owner" on public.child_growth_measurements
  for delete to authenticated
  using (public.owns_child(child_id));

drop policy if exists "child_milestones_access" on public.child_milestones;
drop policy if exists "child_milestones_select" on public.child_milestones;
drop policy if exists "child_milestones_insert_owner" on public.child_milestones;
drop policy if exists "child_milestones_update_owner" on public.child_milestones;
drop policy if exists "child_milestones_delete_owner" on public.child_milestones;

create policy "child_milestones_select" on public.child_milestones
  for select to authenticated
  using (public.can_access_child(child_id));
create policy "child_milestones_insert_owner" on public.child_milestones
  for insert to authenticated
  with check (public.owns_child(child_id));
create policy "child_milestones_update_owner" on public.child_milestones
  for update to authenticated
  using (public.owns_child(child_id))
  with check (public.owns_child(child_id));
create policy "child_milestones_delete_owner" on public.child_milestones
  for delete to authenticated
  using (public.owns_child(child_id));

-- A policy genérica de vaccinations_modify já permite mutação apenas quando
-- patient_id = auth.uid(). Aqui a leitura infantil exige permissão "children".
drop policy if exists "vaccinations_child_access" on public.vaccinations;
drop policy if exists "vaccinations_select" on public.vaccinations;
create policy "vaccinations_select" on public.vaccinations
  for select to authenticated
  using (
    patient_id = (select auth.uid())
    or (child_id is null and public.is_accepted_caregiver(patient_id))
    or (child_id is not null and public.can_access_child(child_id))
  );

-- ── 5) Feed público sem credencial de teleatendimento ───────────────────────
drop function if exists public.calendar_feed(uuid);
create function public.calendar_feed(p_token uuid)
returns table (
  id            uuid,
  doctor_name   text,
  specialty     text,
  scheduled_at  timestamptz,
  kind          appointment_kind,
  location      text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.doctor_name, a.specialty, a.scheduled_at, a.kind, a.location
    from public.profiles p
    join public.appointments a on a.patient_id = p.id
   where p.calendar_token = p_token
     and p.calendar_enabled = true
     and a.status = 'scheduled'
   order by a.scheduled_at asc;
$$;

revoke all on function public.calendar_feed(uuid) from public;
grant execute on function public.calendar_feed(uuid) to anon, authenticated;

-- ── 6) Perfil mínimo para cuidadores, sem PII/token ─────────────────────────
drop policy if exists "profiles_select_self_or_caregiver" on public.profiles;
drop policy if exists "profiles_select_related" on public.profiles;
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create or replace function public.get_accessible_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  result jsonb;
begin
  if uid is null then
    raise exception 'Não autenticado.' using errcode = 'insufficient_privilege';
  end if;

  if uid = p_profile_id then
    select to_jsonb(p) into result
      from public.profiles p
     where p.id = p_profile_id;
    return result;
  end if;

  if not public.is_accepted_caregiver(p_profile_id) then
    return null;
  end if;

  select jsonb_build_object(
           'id', p.id,
           'full_name', p.full_name,
           'date_of_birth', p.date_of_birth,
           'biological_sex', p.biological_sex,
           'blood_type', p.blood_type,
           'height_cm', p.height_cm,
           'guardian_id', p.guardian_id,
           'is_minor', p.is_minor,
           'emergency_note', p.emergency_note,
           'created_at', p.created_at,
           'updated_at', p.updated_at
         )
    into result
    from public.profiles p
   where p.id = p_profile_id;

  return result;
end;
$$;

revoke all on function public.get_accessible_profile(uuid) from public, anon;
grant execute on function public.get_accessible_profile(uuid) to authenticated;

create or replace function public.list_related_profile_names(p_profile_ids uuid[])
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name
    from public.profiles p
   where p.id = any(coalesce(p_profile_ids, array[]::uuid[]))
     and (
       p.id = (select auth.uid())
       or exists (
         select 1
           from public.care_relationships cr
          where cr.status = 'accepted'
            and (
              (cr.patient_id = (select auth.uid()) and cr.caregiver_id = p.id)
              or
              (cr.caregiver_id = (select auth.uid()) and cr.patient_id = p.id)
            )
       )
     );
$$;

revoke all on function public.list_related_profile_names(uuid[]) from public, anon;
grant execute on function public.list_related_profile_names(uuid[]) to authenticated;

-- ── 7) audit_log: somente RPCs/triggers e retenção após exclusão ────────────
-- Não há outro INSERT direto no código além do consentimento migrado acima.
drop policy if exists "audit_insert" on public.audit_log;
revoke insert, update, delete on table public.audit_log from anon, authenticated;

-- Permite exclusivamente o SET NULL interno das FKs quando o perfil já deixou
-- de existir; qualquer outra mutação continua bloqueada.
create or replace function public.prevent_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'actor_id' - 'patient_id')
       is distinct from
       (to_jsonb(old) - 'actor_id' - 'patient_id') then
      raise exception 'Registro imutável (append-only).';
    end if;

    if new.actor_id is distinct from old.actor_id
       and not (
         old.actor_id is not null
         and new.actor_id is null
         and not exists (select 1 from public.profiles p where p.id = old.actor_id)
       ) then
      raise exception 'Registro imutável (append-only).';
    end if;

    if new.patient_id is distinct from old.patient_id
       and not (
         old.patient_id is not null
         and new.patient_id is null
         and not exists (select 1 from public.profiles p where p.id = old.patient_id)
       ) then
      raise exception 'Registro imutável (append-only).';
    end if;

    return new;
  end if;

  raise exception 'Registro imutável (append-only).';
end;
$$;

revoke all on function public.prevent_mutation() from public, anon, authenticated;

alter table public.audit_log
  drop constraint if exists audit_log_actor_id_fkey;
alter table public.audit_log
  drop constraint if exists audit_log_patient_id_fkey;
alter table public.audit_log
  alter column actor_id drop not null;
alter table public.audit_log
  alter column patient_id drop not null;
alter table public.audit_log
  add constraint audit_log_actor_id_fkey
    foreign key (actor_id) references public.profiles (id) on delete set null;
alter table public.audit_log
  add constraint audit_log_patient_id_fkey
    foreign key (patient_id) references public.profiles (id) on delete set null;
