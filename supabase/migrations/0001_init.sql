-- ============================================================================
-- VidaLog — Prontuário Pessoal de Saúde (PHR)
-- Migration 0001 — esquema inicial
--
-- Princípios (LGPD + CFM):
--   * Paciente é dono dos próprios dados; RLS em TODAS as tabelas.
--   * Cuidador/família acessa apenas com vínculo ACEITO (is_accepted_caregiver).
--   * Dados sensíveis (Art. 11 LGPD) marcados com COMMENT 'PHI: ...'.
--   * audit_log é append-only (à prova de adulteração).
--   * Consentimento granular registrado em `consents`.
--
-- Convenções:
--   * UUID opaco como PK (gen_random_uuid()).
--   * timestamptz, text, numeric — nunca timestamp/varchar/float.
--   * Políticas RLS usam (select auth.uid()) por performance.
-- ============================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type biological_sex as enum ('female', 'male', 'intersex', 'unspecified');
create type blood_type as enum ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown');
create type care_relationship_kind as enum ('family', 'caregiver', 'doctor', 'lab');
create type care_status as enum ('pending', 'accepted', 'revoked');
create type vital_type as enum (
  'blood_pressure', 'glucose', 'weight', 'heart_rate', 'temperature', 'oxygen_saturation'
);
create type medication_form as enum (
  'tablet', 'capsule', 'liquid', 'injection', 'drops', 'inhaler', 'cream', 'other'
);
create type medication_frequency as enum ('daily', 'weekly', 'as_needed');
create type intake_status as enum ('pending', 'taken', 'skipped');
create type exam_status as enum ('uploaded', 'processing', 'processed');
create type metric_flag as enum ('ok', 'attention', 'alert');
create type condition_status as enum ('active', 'resolved', 'suspected');
create type consent_purpose as enum (
  'data_sharing_family', 'data_sharing_doctor', 'data_sharing_lab', 'research', 'marketing'
);
create type audit_action as enum ('create', 'read', 'update', 'delete', 'export', 'print', 'share');

-- ----------------------------------------------------------------------------
-- Trigger helper: mantém updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1) profiles — extende auth.users
-- ============================================================================
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null,
  date_of_birth   date,
  biological_sex  biological_sex not null default 'unspecified',
  blood_type      blood_type not null default 'unknown',
  phone           text,
  -- Dados de menores: vínculo com responsável + log reforçado (LGPD Art. 14).
  guardian_id     uuid references public.profiles (id) on delete set null,
  is_minor        boolean not null default false,
  emergency_note  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on column public.profiles.full_name is 'PHI: patient_name';
comment on column public.profiles.date_of_birth is 'PHI: date_of_birth';
comment on column public.profiles.phone is 'PHI: contact';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2) care_relationships — família / cuidador / médico / lab (com aceite)
-- ============================================================================
create table public.care_relationships (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.profiles (id) on delete cascade,
  caregiver_id   uuid not null references public.profiles (id) on delete cascade,
  kind           care_relationship_kind not null default 'family',
  status         care_status not null default 'pending',
  -- Permissões granulares (LGPD): quais módulos o cuidador pode ver.
  permissions    jsonb not null default '{"diary": true, "vitals": true, "medications": true, "exams": false}'::jsonb,
  invited_at     timestamptz not null default now(),
  accepted_at    timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint care_relationships_no_self check (patient_id <> caregiver_id),
  constraint care_relationships_unique unique (patient_id, caregiver_id)
);
create index care_relationships_caregiver_idx on public.care_relationships (caregiver_id, status);
create index care_relationships_patient_idx on public.care_relationships (patient_id, status);

create trigger care_relationships_set_updated_at
  before update on public.care_relationships
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Função central de autorização: vínculo de cuidador ACEITO?
-- SECURITY DEFINER para evitar recursão de RLS ao consultar care_relationships.
-- ----------------------------------------------------------------------------
create or replace function public.is_accepted_caregiver(target_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.care_relationships cr
    where cr.caregiver_id = (select auth.uid())
      and cr.patient_id = target_patient
      and cr.status = 'accepted'
  );
$$;

-- Conveniência: dono OU cuidador aceito.
create or replace function public.can_view_patient(target_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) = target_patient
      or public.is_accepted_caregiver(target_patient);
$$;

-- ============================================================================
-- 3) diary_entries — Diário (sintomas, humor, notas)
-- ============================================================================
create table public.diary_entries (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.profiles (id) on delete cascade,
  entry_date   date not null default current_date,
  mood         smallint check (mood between 1 and 5),
  symptoms     text[] not null default '{}',
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on column public.diary_entries.note is 'PHI: clinical_note';
create index diary_entries_patient_date_idx on public.diary_entries (patient_id, entry_date desc);

create trigger diary_entries_set_updated_at
  before update on public.diary_entries
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 4) vitals — medições (PA, glicemia, peso, FC, temperatura, SpO2)
--    Para PA: value_primary = sistólica, value_secondary = diastólica.
-- ============================================================================
create table public.vitals (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.profiles (id) on delete cascade,
  type            vital_type not null,
  measured_at     timestamptz not null default now(),
  value_primary   numeric(8,2) not null,
  value_secondary numeric(8,2),
  unit            text not null,
  note            text,
  created_at      timestamptz not null default now()
);
comment on column public.vitals.value_primary is 'PHI: clinical_measurement';
create index vitals_patient_type_idx on public.vitals (patient_id, type, measured_at desc);

-- ============================================================================
-- 5) medications — lista de medicamentos
-- ============================================================================
create table public.medications (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  dosage       text,
  form         medication_form not null default 'tablet',
  active       boolean not null default true,
  started_at   date,
  ended_at     date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on column public.medications.name is 'PHI: medication';
create index medications_patient_active_idx on public.medications (patient_id, active);

create trigger medications_set_updated_at
  before update on public.medications
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 6) medication_schedules — horários / lembretes
-- ============================================================================
create table public.medication_schedules (
  id               uuid primary key default gen_random_uuid(),
  medication_id    uuid not null references public.medications (id) on delete cascade,
  patient_id       uuid not null references public.profiles (id) on delete cascade,
  frequency        medication_frequency not null default 'daily',
  times            time[] not null default '{}',     -- horários no dia
  days_of_week     smallint[] not null default '{}', -- 0=domingo .. 6=sábado
  reminder_enabled boolean not null default true,
  start_date       date not null default current_date,
  end_date         date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index medication_schedules_patient_idx on public.medication_schedules (patient_id);
create index medication_schedules_medication_idx on public.medication_schedules (medication_id);

create trigger medication_schedules_set_updated_at
  before update on public.medication_schedules
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 7) medication_intakes — registro de tomada
-- ============================================================================
create table public.medication_intakes (
  id            uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete cascade,
  schedule_id   uuid references public.medication_schedules (id) on delete set null,
  patient_id    uuid not null references public.profiles (id) on delete cascade,
  scheduled_for timestamptz,
  taken_at      timestamptz,
  status        intake_status not null default 'pending',
  note          text,
  created_at    timestamptz not null default now()
);
create index medication_intakes_patient_idx on public.medication_intakes (patient_id, scheduled_for desc);
create index medication_intakes_medication_idx on public.medication_intakes (medication_id);

-- ============================================================================
-- 8) exams — metadados de exames (arquivo no bucket privado 'exams')
-- ============================================================================
create table public.exams (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.profiles (id) on delete cascade,
  title         text not null,
  exam_type     text,
  exam_date     date,
  -- caminho dentro do bucket 'exams': sempre prefixado por <auth.uid()>/...
  storage_path  text,
  file_mime     text,
  lab_name      text,
  status        exam_status not null default 'uploaded',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.exams.storage_path is 'PHI: exam_file_reference';
create index exams_patient_date_idx on public.exams (patient_id, exam_date desc);

create trigger exams_set_updated_at
  before update on public.exams
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 9) exam_metrics — resultados estruturados (preparado p/ OCR — Fase 3)
-- ============================================================================
create table public.exam_metrics (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references public.exams (id) on delete cascade,
  patient_id     uuid not null references public.profiles (id) on delete cascade,
  name           text not null,
  value          numeric(12,4),
  value_text     text,
  unit           text,
  reference_min  numeric(12,4),
  reference_max  numeric(12,4),
  flag           metric_flag not null default 'ok',
  measured_at    timestamptz,
  created_at     timestamptz not null default now()
);
comment on column public.exam_metrics.value is 'PHI: lab_result';
create index exam_metrics_exam_idx on public.exam_metrics (exam_id);
create index exam_metrics_patient_idx on public.exam_metrics (patient_id, name);

-- ============================================================================
-- 10) conditions — condições CID-10
-- ============================================================================
create table public.conditions (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.profiles (id) on delete cascade,
  cid10_code    text,
  name          text not null,
  status        condition_status not null default 'active',
  diagnosed_at  date,
  resolved_at   date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.conditions.cid10_code is 'PHI: diagnosis';
comment on column public.conditions.name is 'PHI: diagnosis';
create index conditions_patient_idx on public.conditions (patient_id, status);

create trigger conditions_set_updated_at
  before update on public.conditions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 11) vaccinations — carteira de vacinação
-- ============================================================================
create table public.vaccinations (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.profiles (id) on delete cascade,
  vaccine_name  text not null,
  dose_label    text,
  applied_at    date,
  lot           text,
  location      text,
  next_dose_at  date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.vaccinations.vaccine_name is 'PHI: immunization';
create index vaccinations_patient_idx on public.vaccinations (patient_id, applied_at desc);

create trigger vaccinations_set_updated_at
  before update on public.vaccinations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 12) consents — consentimento granular (LGPD Art. 7/11)
-- ============================================================================
create table public.consents (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.profiles (id) on delete cascade,
  purpose      consent_purpose not null,
  scope        jsonb not null default '{}'::jsonb,
  granted      boolean not null default false,
  version      text not null default 'v1',
  granted_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index consents_patient_idx on public.consents (patient_id, purpose);

create trigger consents_set_updated_at
  before update on public.consents
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 13) audit_log — trilha de auditoria de acessos (append-only)
-- ============================================================================
create table public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid not null references public.profiles (id) on delete cascade,
  patient_id     uuid not null references public.profiles (id) on delete cascade,
  action         audit_action not null,
  resource_type  text not null,
  resource_id    uuid,
  ip_address     inet,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index audit_log_patient_idx on public.audit_log (patient_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles             enable row level security;
alter table public.care_relationships   enable row level security;
alter table public.diary_entries        enable row level security;
alter table public.vitals               enable row level security;
alter table public.medications          enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.medication_intakes   enable row level security;
alter table public.exams                enable row level security;
alter table public.exam_metrics         enable row level security;
alter table public.conditions           enable row level security;
alter table public.vaccinations         enable row level security;
alter table public.consents             enable row level security;
alter table public.audit_log            enable row level security;

-- ---- profiles ----
create policy "profiles_select_self_or_caregiver" on public.profiles
  for select to authenticated
  using (public.can_view_patient(id));
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---- care_relationships ----
-- Paciente e cuidador enxergam os vínculos em que participam.
create policy "care_select_involved" on public.care_relationships
  for select to authenticated
  using (patient_id = (select auth.uid()) or caregiver_id = (select auth.uid()));
-- Apenas o paciente (dono) convida.
create policy "care_insert_owner" on public.care_relationships
  for insert to authenticated
  with check (patient_id = (select auth.uid()));
-- Paciente gerencia/revoga; cuidador pode aceitar o próprio convite.
create policy "care_update_involved" on public.care_relationships
  for update to authenticated
  using (patient_id = (select auth.uid()) or caregiver_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()) or caregiver_id = (select auth.uid()));
create policy "care_delete_owner" on public.care_relationships
  for delete to authenticated
  using (patient_id = (select auth.uid()));

-- ---- Macro: tabelas de dados do paciente (dono CRUD; cuidador aceito SELECT) ----
-- Padrão aplicado a: diary_entries, vitals, medications, medication_schedules,
-- medication_intakes, exams, exam_metrics, conditions, vaccinations, consents.

-- diary_entries
create policy "diary_select" on public.diary_entries for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "diary_modify" on public.diary_entries for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

-- vitals
create policy "vitals_select" on public.vitals for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "vitals_modify" on public.vitals for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

-- medications
create policy "medications_select" on public.medications for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "medications_modify" on public.medications for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

-- medication_schedules
create policy "med_schedules_select" on public.medication_schedules for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "med_schedules_modify" on public.medication_schedules for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

-- medication_intakes
create policy "med_intakes_select" on public.medication_intakes for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "med_intakes_modify" on public.medication_intakes for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

-- exams
create policy "exams_select" on public.exams for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "exams_modify" on public.exams for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

-- exam_metrics
create policy "exam_metrics_select" on public.exam_metrics for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "exam_metrics_modify" on public.exam_metrics for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

-- conditions
create policy "conditions_select" on public.conditions for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "conditions_modify" on public.conditions for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

-- vaccinations
create policy "vaccinations_select" on public.vaccinations for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "vaccinations_modify" on public.vaccinations for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

-- consents — somente o próprio dono (não visível a cuidadores).
create policy "consents_select_owner" on public.consents for select to authenticated
  using (patient_id = (select auth.uid()));
create policy "consents_modify_owner" on public.consents for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

-- audit_log — append-only. Paciente vê sua própria trilha; ninguém altera/apaga.
create policy "audit_insert" on public.audit_log for insert to authenticated
  with check (actor_id = (select auth.uid()));
create policy "audit_select_subject_or_actor" on public.audit_log for select to authenticated
  using (patient_id = (select auth.uid()) or actor_id = (select auth.uid()));
-- (sem políticas de UPDATE/DELETE => bloqueado por padrão)

-- ============================================================================
-- STORAGE — bucket privado 'exams'
--   Caminho exigido: "<auth.uid()>/<arquivo>" — primeira pasta = dono.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exams', 'exams', false, 52428800,
  array['application/pdf','image/png','image/jpeg','image/webp','image/heic']
)
on conflict (id) do nothing;

create policy "exams_storage_select_owner" on storage.objects for select to authenticated
  using (bucket_id = 'exams' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "exams_storage_insert_owner" on storage.objects for insert to authenticated
  with check (bucket_id = 'exams' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "exams_storage_update_owner" on storage.objects for update to authenticated
  using (bucket_id = 'exams' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "exams_storage_delete_owner" on storage.objects for delete to authenticated
  using (bucket_id = 'exams' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============================================================================
-- Trigger: cria profile automaticamente ao registrar usuário no Auth
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'Paciente'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
