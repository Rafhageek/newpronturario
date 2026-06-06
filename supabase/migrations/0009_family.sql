-- ============================================================================
-- VidaLog — Migration 0009
-- Família / modo cuidador: convites, permissões granulares, RLS por permissão
--
-- Reusa care_relationships e can_view_patient()/is_accepted_caregiver() (0001).
-- ============================================================================

-- ── Novo conjunto de permissões granulares (chaves usadas pelo app) ─────────
alter table public.care_relationships
  alter column permissions set default
    '{"ver_vitais": true, "registrar_tomada": false, "ver_exames": false, "agendar_consulta": false, "receber_alertas": true}'::jsonb;

-- ── Convites de cuidador (por e-mail, token de 48h) ─────────────────────────
create table public.caregiver_invites (
  id            uuid primary key default gen_random_uuid(),
  inviter_id    uuid not null references public.profiles (id) on delete cascade,
  inviter_name  text,
  invitee_email text not null,
  -- papel do CONVITE sob a ótica de quem convida:
  --   'i_am_caregiver' → inviter cuida do convidado (convidado = paciente/dependente)
  --   'i_am_patient'   → inviter quer ser cuidado pelo convidado (convidado = cuidador)
  role          text not null default 'i_am_caregiver',
  kind          care_relationship_kind not null default 'family',
  permissions   jsonb not null default
    '{"ver_vitais": true, "registrar_tomada": false, "ver_exames": false, "agendar_consulta": false, "receber_alertas": true}'::jsonb,
  token         text not null unique,
  expires_at    timestamptz not null default (now() + interval '48 hours'),
  status        text not null default 'pending',  -- pending | accepted | expired | revoked
  accepted_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index caregiver_invites_email_idx on public.caregiver_invites (lower(invitee_email));
create index caregiver_invites_inviter_idx on public.caregiver_invites (inviter_id);

alter table public.caregiver_invites enable row level security;

-- Quem convida gerencia os próprios convites.
create policy "invites_owner_all" on public.caregiver_invites for all to authenticated
  using (inviter_id = (select auth.uid())) with check (inviter_id = (select auth.uid()));

-- O convidado enxerga convites pendentes endereçados ao seu e-mail.
create policy "invites_invitee_select" on public.caregiver_invites for select to authenticated
  using (lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')));

-- Perfis de pessoas com vínculo aceito (qualquer direção) são visíveis entre si
-- (para mostrar nomes na tela Família).
create policy "profiles_select_related" on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.care_relationships cr
      where cr.status = 'accepted'
        and (
          (cr.patient_id = (select auth.uid()) and cr.caregiver_id = profiles.id)
          or (cr.caregiver_id = (select auth.uid()) and cr.patient_id = profiles.id)
        )
    )
  );

-- ── Função: cuidador aceito COM uma permissão específica? ───────────────────
create or replace function public.caregiver_has_permission(target_patient uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.care_relationships cr
    where cr.caregiver_id = (select auth.uid())
      and cr.patient_id = target_patient
      and cr.status = 'accepted'
      and coalesce((cr.permissions ->> perm)::boolean, false) = true
  );
$$;

-- ── RLS por permissão (substitui SELECT amplo nas tabelas sensíveis) ────────
-- vitais → ver_vitais
drop policy if exists "vitals_select" on public.vitals;
create policy "vitals_select" on public.vitals for select to authenticated
  using (patient_id = (select auth.uid()) or public.caregiver_has_permission(patient_id, 'ver_vitais'));

-- exames → ver_exames
drop policy if exists "exams_select" on public.exams;
create policy "exams_select" on public.exams for select to authenticated
  using (patient_id = (select auth.uid()) or public.caregiver_has_permission(patient_id, 'ver_exames'));

drop policy if exists "exam_metrics_select" on public.exam_metrics;
create policy "exam_metrics_select" on public.exam_metrics for select to authenticated
  using (patient_id = (select auth.uid()) or public.caregiver_has_permission(patient_id, 'ver_exames'));

-- ── Escrita do cuidador (permissões específicas) ────────────────────────────
-- registrar tomada → registrar_tomada
create policy "med_intakes_caregiver_insert" on public.medication_intakes for insert to authenticated
  with check (public.caregiver_has_permission(patient_id, 'registrar_tomada'));

-- agendar consulta → agendar_consulta
create policy "appointments_caregiver_insert" on public.appointments for insert to authenticated
  with check (public.caregiver_has_permission(patient_id, 'agendar_consulta'));

-- ── RPC: aceitar convite (cria o vínculo aceito a partir do token) ──────────
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
  select * into inv from public.caregiver_invites
    where token = invite_token and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'Convite inválido ou expirado.';
  end if;
  if lower(inv.invitee_email) <> lower(coalesce(my_email, '')) then
    raise exception 'Este convite não é para a sua conta.';
  end if;

  if inv.role = 'i_am_caregiver' then
    p_id := me;            -- convidado é o paciente/dependente
    c_id := inv.inviter_id;
  else
    p_id := inv.inviter_id; -- convidado é o cuidador
    c_id := me;
  end if;

  insert into public.care_relationships (patient_id, caregiver_id, kind, status, permissions, accepted_at)
  values (p_id, c_id, inv.kind, 'accepted', inv.permissions, now())
  on conflict (patient_id, caregiver_id)
  do update set status = 'accepted', permissions = excluded.permissions, accepted_at = now(), revoked_at = null
  returning id into rel_id;

  update public.caregiver_invites set status = 'accepted', accepted_at = now() where id = inv.id;
  return rel_id;
end;
$$;
