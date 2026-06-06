-- ============================================================
-- VidaLog — importação completa do schema (12 migrations)
-- Gerado para colar no Supabase Dashboard → SQL Editor → Run
-- Ordem preservada: 0001 → 0012
-- ============================================================


-- ============================================================
-- 0001_init.sql
-- ============================================================
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


-- ============================================================
-- 0002_profile_clinical.sql
-- ============================================================
-- ============================================================================
-- VidaLog — Migration 0002
-- Perfil clínico estendido + agenda de consultas
--
-- Adiciona: CPF/endereço ao perfil, energia ao diário, status "controlled"
-- às condições, e as tabelas appointments, allergies, surgeries,
-- family_history e insurance_plans (todas com RLS no mesmo padrão de 0001:
-- dono tem CRUD, cuidador aceito tem SELECT via can_view_patient()).
-- ============================================================================

-- ── Novos enums ─────────────────────────────────────────────────────────────
create type allergy_severity as enum ('mild', 'moderate', 'severe');
create type appointment_kind as enum ('in_person', 'telehealth');
create type appointment_status as enum ('scheduled', 'completed', 'cancelled');
create type family_relationship as enum (
  'mother', 'father', 'sibling', 'grandparent', 'child', 'other'
);

-- ── profiles: CPF + endereço ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists cpf text,
  add column if not exists address jsonb not null default '{}'::jsonb;
comment on column public.profiles.cpf is 'PHI: national_id';

-- ── diary_entries: energia (1-5) ────────────────────────────────────────────
alter table public.diary_entries
  add column if not exists energy smallint check (energy between 1 and 5);

-- ── conditions: novo status "controlled" ────────────────────────────────────
-- (PG15 permite ADD VALUE; não usamos o valor nesta mesma migration)
alter type condition_status add value if not exists 'controlled';

-- ============================================================================
-- appointments — agenda de consultas
-- ============================================================================
create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.profiles (id) on delete cascade,
  doctor_name  text not null,
  specialty    text,
  scheduled_at timestamptz not null,
  kind         appointment_kind not null default 'in_person',
  status       appointment_status not null default 'scheduled',
  location     text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on column public.appointments.doctor_name is 'PHI: care_provider';
create index appointments_patient_idx on public.appointments (patient_id, scheduled_at);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ============================================================================
-- allergies — alergias (destaque clínico)
-- ============================================================================
create table public.allergies (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.profiles (id) on delete cascade,
  substance   text not null,
  severity    allergy_severity not null default 'moderate',
  reaction    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on column public.allergies.substance is 'PHI: allergy';
create index allergies_patient_idx on public.allergies (patient_id, severity);

create trigger allergies_set_updated_at
  before update on public.allergies
  for each row execute function public.set_updated_at();

-- ============================================================================
-- surgeries — cirurgias / procedimentos
-- ============================================================================
create table public.surgeries (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.profiles (id) on delete cascade,
  procedure    text not null,
  performed_at date,
  hospital     text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on column public.surgeries.procedure is 'PHI: procedure';
create index surgeries_patient_idx on public.surgeries (patient_id, performed_at desc);

create trigger surgeries_set_updated_at
  before update on public.surgeries
  for each row execute function public.set_updated_at();

-- ============================================================================
-- family_history — antecedentes familiares
-- ============================================================================
create table public.family_history (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.profiles (id) on delete cascade,
  condition    text not null,
  relationship family_relationship not null default 'other',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on column public.family_history.condition is 'PHI: family_diagnosis';
create index family_history_patient_idx on public.family_history (patient_id);

create trigger family_history_set_updated_at
  before update on public.family_history
  for each row execute function public.set_updated_at();

-- ============================================================================
-- insurance_plans — convênio
-- ============================================================================
create table public.insurance_plans (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.profiles (id) on delete cascade,
  operator    text not null,
  card_number text,
  valid_until date,
  is_primary  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on column public.insurance_plans.card_number is 'PHI: insurance';
create index insurance_plans_patient_idx on public.insurance_plans (patient_id);

create trigger insurance_plans_set_updated_at
  before update on public.insurance_plans
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS — mesmo padrão de 0001 (dono CRUD; cuidador aceito SELECT)
-- ============================================================================
alter table public.appointments    enable row level security;
alter table public.allergies       enable row level security;
alter table public.surgeries       enable row level security;
alter table public.family_history  enable row level security;
alter table public.insurance_plans enable row level security;

-- appointments
create policy "appointments_select" on public.appointments for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "appointments_modify" on public.appointments for all to authenticated
  using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));

-- allergies
create policy "allergies_select" on public.allergies for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "allergies_modify" on public.allergies for all to authenticated
  using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));

-- surgeries
create policy "surgeries_select" on public.surgeries for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "surgeries_modify" on public.surgeries for all to authenticated
  using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));

-- family_history
create policy "family_history_select" on public.family_history for select to authenticated
  using (public.can_view_patient(patient_id));
create policy "family_history_modify" on public.family_history for all to authenticated
  using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));

-- insurance_plans (somente o dono — dado sensível financeiro)
create policy "insurance_select_owner" on public.insurance_plans for select to authenticated
  using (patient_id = (select auth.uid()));
create policy "insurance_modify_owner" on public.insurance_plans for all to authenticated
  using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()));


-- ============================================================
-- 0003_diary_meds.sql
-- ============================================================
-- ============================================================================
-- VidaLog — Migration 0003
-- Diário (dor) + Medicamentos (frequência/horários/prescritor) + interações
-- ============================================================================

-- ── diary_entries: dor (0-10) ───────────────────────────────────────────────
alter table public.diary_entries
  add column if not exists pain smallint check (pain between 0 and 10);

-- ── medications: frequência, horários, unidade, prescritor ──────────────────
alter table public.medications
  add column if not exists frequency medication_frequency not null default 'daily',
  add column if not exists times time[] not null default '{}',
  add column if not exists unit text,
  add column if not exists prescriber text;
comment on column public.medications.prescriber is 'PHI: care_provider';

-- ── medication_intakes: motivo de pular ─────────────────────────────────────
alter table public.medication_intakes
  add column if not exists skip_reason text;

-- ── Interações medicamentosas (dado de referência, não-PHI) ─────────────────
create type interaction_severity as enum ('minor', 'moderate', 'major');

create table public.drug_interactions (
  id          uuid primary key default gen_random_uuid(),
  drug_a      text not null,
  drug_b      text not null,
  severity    interaction_severity not null default 'moderate',
  description text not null,
  created_at  timestamptz not null default now(),
  constraint drug_interactions_pair_unique unique (drug_a, drug_b)
);
create index drug_interactions_drug_a_idx on public.drug_interactions (drug_a);
create index drug_interactions_drug_b_idx on public.drug_interactions (drug_b);

-- Referência: legível por qualquer usuário autenticado; sem escrita pelo cliente.
alter table public.drug_interactions enable row level security;
create policy "drug_interactions_read" on public.drug_interactions
  for select to authenticated using (true);

-- ── Seed curado (~12 pares comuns) — NÃO é o DDInter completo ────────────────
-- Nomes em minúsculas (genérico) para casamento case-insensitive no cliente.
insert into public.drug_interactions (drug_a, drug_b, severity, description) values
  ('varfarina', 'aspirina', 'major', 'Risco aumentado de sangramento.'),
  ('varfarina', 'amiodarona', 'major', 'Amiodarona potencializa a varfarina — risco de sangramento.'),
  ('varfarina', 'ibuprofeno', 'major', 'AINEs aumentam o risco de sangramento com varfarina.'),
  ('fluoxetina', 'tramadol', 'major', 'Risco de síndrome serotoninérgica.'),
  ('sinvastatina', 'claritromicina', 'major', 'Risco elevado de miopatia/rabdomiólise.'),
  ('clopidogrel', 'omeprazol', 'moderate', 'Omeprazol pode reduzir o efeito do clopidogrel.'),
  ('losartana', 'espironolactona', 'moderate', 'Risco de hipercalemia (potássio elevado).'),
  ('losartana', 'ibuprofeno', 'moderate', 'AINEs reduzem o efeito anti-hipertensivo e afetam os rins.'),
  ('captopril', 'espironolactona', 'moderate', 'Risco de hipercalemia.'),
  ('digoxina', 'furosemida', 'moderate', 'Hipocalemia pela furosemida aumenta toxicidade da digoxina.'),
  ('metformina', 'álcool', 'moderate', 'Álcool aumenta o risco de acidose láctica.'),
  ('aspirina', 'ibuprofeno', 'minor', 'Ibuprofeno pode reduzir o efeito cardioprotetor da aspirina.')
on conflict (drug_a, drug_b) do nothing;


-- ============================================================
-- 0004_exams_narrative.sql
-- ============================================================
-- ============================================================================
-- VidaLog — Migration 0004
-- Exames: Narrativa de Saúde (explicações leigas por métrica)
--
-- Estende exams/exam_metrics (criadas na 0001) e adiciona a tabela pública
-- exam_metric_explanations (conteúdo EDUCATIVO — deve ser revisado por um
-- profissional de saúde antes de uso em produção).
-- ============================================================================

create type exam_category as enum ('lab', 'imaging', 'cardio');

-- ── exams: categoria, médico, laudo textual ─────────────────────────────────
alter table public.exams
  add column if not exists category exam_category not null default 'lab',
  add column if not exists doctor_name text,
  add column if not exists doctor_crm text,
  add column if not exists raw_text text;
comment on column public.exams.doctor_name is 'PHI: care_provider';
comment on column public.exams.raw_text is 'PHI: clinical_report';

-- ── exam_metrics: código (LOINC opcional) ───────────────────────────────────
alter table public.exam_metrics
  add column if not exists metric_code text;
create index if not exists exam_metrics_metric_code_idx on public.exam_metrics (metric_code);

-- ── exam_metric_explanations: dicionário educativo (público p/ leitura) ──────
create table public.exam_metric_explanations (
  id           uuid primary key default gen_random_uuid(),
  metric_key   text not null unique,          -- chave normalizada (ex.: 'hemoglobina')
  metric_name  text not null,                 -- rótulo PT-BR (ex.: 'Hemoglobina')
  category     exam_category not null default 'lab',
  what_measures text not null,                -- o que mede
  why_matters   text not null,                -- por que importa
  low_means     text,                         -- o que significa estar baixo
  high_means    text,                         -- o que significa estar alto
  actions_low   text,                         -- o que conversar com o médico se baixo
  actions_high  text,                         -- o que conversar com o médico se alto
  created_at    timestamptz not null default now()
);
create index exam_metric_explanations_key_idx on public.exam_metric_explanations (metric_key);

-- Conteúdo educativo, não-PHI: legível por qualquer usuário autenticado.
alter table public.exam_metric_explanations enable row level security;
create policy "exam_explanations_read" on public.exam_metric_explanations
  for select to authenticated using (true);

-- ============================================================================
-- O SEED educacional fica na migration seguinte: 0005_exam_explanations_seed.sql
-- ⚠️ Conteúdo educativo. Revisar com profissional de saúde antes de produção.
-- ============================================================================


-- ============================================================
-- 0005_exam_explanations_seed.sql
-- ============================================================
-- ⚠️ Conteúdo educativo gerado para o MVP. Revisar com profissional de saúde antes de produção.
insert into public.exam_metric_explanations
  (metric_key, metric_name, category, what_measures, why_matters, low_means, high_means, actions_low, actions_high)
values
  ('hemoglobina', 'Hemoglobina', 'lab', 'Proteína dos glóbulos vermelhos que transporta oxigênio pelo corpo.', 'Mostra se o seu sangue está levando oxigênio bem para os órgãos.', 'Valores baixos podem estar associados a anemia, deixando você mais cansado(a) ou pálido(a).', 'Valores altos às vezes aparecem em desidratação ou em outras condições do sangue.', 'Vale levar este resultado ao seu médico para investigar a causa do valor baixo.', 'Converse com seu médico sobre o que pode estar elevando este valor.'),
  ('hematocrito', 'Hematócrito', 'lab', 'Porcentagem do sangue que é formada por glóbulos vermelhos.', 'Complementa a hemoglobina para avaliar se há anemia ou sangue muito concentrado.', 'Valores baixos podem estar associados a anemia ou perda de sangue.', 'Valores altos às vezes indicam desidratação ou produção aumentada de glóbulos vermelhos.', 'Converse com seu médico sobre investigar a causa do valor baixo.', 'Vale levar este resultado ao seu médico para entender o valor elevado.'),
  ('hemacias', 'Hemácias (glóbulos vermelhos)', 'lab', 'Quantidade de glóbulos vermelhos, as células que carregam oxigênio.', 'Ajuda a avaliar a capacidade do sangue de oxigenar o corpo.', 'Valores baixos podem estar associados a anemia.', 'Valores altos às vezes aparecem em desidratação ou em outras condições.', 'Converse com seu médico para investigar a causa do valor baixo.', 'Vale levar este resultado ao seu médico para entender o valor elevado.'),
  ('leucocitos', 'Leucócitos (glóbulos brancos)', 'lab', 'Quantidade de glóbulos brancos, as células de defesa do corpo.', 'Ajuda a avaliar como anda a sua defesa contra infecções e inflamações.', 'Valores baixos podem estar associados a queda na imunidade ou a alguns medicamentos.', 'Valores altos às vezes indicam infecção, inflamação ou estresse no organismo.', 'Converse com seu médico sobre o que pode estar reduzindo suas defesas.', 'Vale levar este resultado ao seu médico para investigar a causa do valor alto.'),
  ('plaquetas', 'Plaquetas', 'lab', 'Pequenas células do sangue que ajudam na coagulação e a estancar sangramentos.', 'Mostra se o seu sangue tem boa capacidade de coagular quando necessário.', 'Valores baixos podem aumentar o risco de sangramentos e manchas roxas na pele.', 'Valores altos às vezes estão ligados a inflamação ou a maior tendência de coagulação.', 'Converse com seu médico sobre o que pode estar reduzindo as plaquetas.', 'Vale levar este resultado ao seu médico para investigar o valor elevado.'),
  ('colesterol_total', 'Colesterol total', 'lab', 'Soma de todos os tipos de colesterol que circulam no seu sangue.', 'Ajuda a avaliar o risco para o coração e os vasos sanguíneos.', 'Valores muito baixos são incomuns e às vezes pedem avaliação de causas específicas.', 'Valores altos podem estar associados a maior risco para o coração ao longo do tempo.', 'Converse com seu médico caso o valor esteja abaixo do esperado.', 'Converse com seu médico sobre alimentação, hábitos e acompanhamento do colesterol.'),
  ('ldl', 'LDL (colesterol ruim)', 'lab', 'Tipo de colesterol que pode se acumular nas paredes das artérias.', 'É um dos principais indicadores de risco para o coração.', 'Valores baixos costumam ser favoráveis para o coração.', 'Valores altos podem estar associados a maior risco de entupimento das artérias.', 'Geralmente não exige ação; confirme com seu médico na consulta.', 'Converse com seu médico sobre alimentação, atividade física e acompanhamento.'),
  ('hdl', 'HDL (colesterol bom)', 'lab', 'Tipo de colesterol que ajuda a remover gordura das artérias.', 'Valores mais altos costumam proteger o coração.', 'Valores baixos podem estar associados a maior risco para o coração.', 'Valores altos costumam ser considerados favoráveis.', 'Converse com seu médico sobre atividade física e hábitos que ajudam a elevar o HDL.', 'Geralmente é um bom sinal; confirme com seu médico na consulta.'),
  ('triglicerides', 'Triglicérides', 'lab', 'Tipo de gordura que circula no sangue, muito ligada à alimentação.', 'Valores elevados podem aumentar o risco para o coração e o pâncreas.', 'Valores baixos raramente são preocupantes.', 'Valores altos podem estar associados a excesso de açúcar, álcool ou gordura na dieta.', 'Geralmente não exige ação; confirme com seu médico se tiver dúvidas.', 'Converse com seu médico sobre alimentação, álcool e acompanhamento dos triglicérides.'),
  ('glicose_jejum', 'Glicose em jejum', 'lab', 'Quantidade de açúcar no sangue após algumas horas sem comer.', 'Ajuda a avaliar como o corpo controla o açúcar e o risco de diabetes.', 'Valores baixos (hipoglicemia) podem causar tremores, suor e tontura.', 'Valores altos podem estar associados a pré-diabetes ou diabetes.', 'Converse com seu médico, principalmente se sentir sintomas de açúcar baixo.', 'Vale levar este resultado ao seu médico para avaliar o controle do açúcar.'),
  ('hba1c', 'Hemoglobina glicada (HbA1c)', 'lab', 'Média do açúcar no sangue dos últimos 2 a 3 meses.', 'Mostra o controle do açúcar ao longo do tempo, não só no dia do exame.', 'Valores baixos raramente preocupam, mas podem refletir episódios de açúcar baixo.', 'Valores altos podem estar associados a pré-diabetes ou diabetes.', 'Converse com seu médico caso costume ter episódios de açúcar baixo.', 'Vale levar este resultado ao seu médico para avaliar o controle do açúcar a longo prazo.'),
  ('creatinina', 'Creatinina', 'lab', 'Substância filtrada pelos rins, usada para avaliar a função renal.', 'Ajuda a verificar se os seus rins estão filtrando o sangue adequadamente.', 'Valores baixos costumam ter pouca importância e às vezes refletem pouca massa muscular.', 'Valores altos podem estar associados a redução na função dos rins.', 'Geralmente não exige ação; confirme com seu médico se tiver dúvidas.', 'Vale levar este resultado ao seu médico para avaliar a função dos rins.'),
  ('ureia', 'Ureia', 'lab', 'Resíduo da digestão de proteínas que os rins eliminam.', 'Ajuda a avaliar a função dos rins e a hidratação.', 'Valores baixos podem aparecer com dieta pobre em proteínas ou boa hidratação.', 'Valores altos às vezes indicam desidratação ou redução na função dos rins.', 'Geralmente não exige ação; confirme com seu médico na consulta.', 'Converse com seu médico sobre hidratação e a função dos seus rins.'),
  ('tfg', 'Taxa de filtração glomerular (TFG)', 'lab', 'Estimativa da velocidade com que os rins filtram o sangue.', 'É uma das melhores formas de avaliar a saúde geral dos rins.', 'Valores baixos podem estar associados a redução na função dos rins.', 'Valores altos costumam indicar boa filtração e raramente preocupam.', 'Vale levar este resultado ao seu médico para avaliar a função dos rins.', 'Geralmente é um bom sinal; confirme com seu médico na consulta.'),
  ('tgo', 'TGO / AST', 'lab', 'Enzima presente no fígado e também nos músculos.', 'Ajuda a avaliar possíveis alterações no fígado.', 'Valores baixos não costumam ter importância clínica.', 'Valores altos podem estar associados a sobrecarga no fígado ou esforço muscular.', 'Geralmente não exige ação; confirme com seu médico se tiver dúvidas.', 'Vale levar este resultado ao seu médico para investigar o valor elevado.'),
  ('tgp', 'TGP / ALT', 'lab', 'Enzima encontrada principalmente no fígado.', 'É um indicador sensível de possíveis alterações no fígado.', 'Valores baixos não costumam ter importância clínica.', 'Valores altos podem estar associados a inflamação ou sobrecarga do fígado.', 'Geralmente não exige ação; confirme com seu médico na consulta.', 'Vale levar este resultado ao seu médico para investigar a causa do valor alto.'),
  ('ggt', 'Gama GT (GGT)', 'lab', 'Enzima do fígado e das vias que conduzem a bile.', 'Ajuda a avaliar o fígado e a via biliar, sendo sensível ao álcool.', 'Valores baixos não costumam ter importância clínica.', 'Valores altos podem estar associados a álcool, alguns medicamentos ou alterações no fígado.', 'Geralmente não exige ação; confirme com seu médico se tiver dúvidas.', 'Converse com seu médico sobre hábitos e acompanhamento do fígado.'),
  ('bilirrubina_total', 'Bilirrubina total', 'lab', 'Substância amarelada produzida quando o corpo recicla glóbulos vermelhos.', 'Ajuda a avaliar o fígado e a via biliar; em excesso pode amarelar a pele e os olhos.', 'Valores baixos não costumam ter importância clínica.', 'Valores altos podem estar associados a alterações no fígado, na bile ou no sangue.', 'Geralmente não exige ação; confirme com seu médico na consulta.', 'Vale levar este resultado ao seu médico, principalmente se notar a pele ou os olhos amarelados.'),
  ('fosfatase_alcalina', 'Fosfatase alcalina', 'lab', 'Enzima presente no fígado, nos ossos e na via biliar.', 'Ajuda a avaliar alterações no fígado, na bile ou nos ossos.', 'Valores baixos são incomuns e raramente preocupam.', 'Valores altos podem estar associados a alterações no fígado, na via biliar ou nos ossos.', 'Geralmente não exige ação; confirme com seu médico se tiver dúvidas.', 'Vale levar este resultado ao seu médico para investigar a causa do valor alto.'),
  ('tsh', 'TSH (hormônio da tireoide)', 'lab', 'Hormônio que comanda o funcionamento da glândula tireoide.', 'Ajuda a avaliar se a tireoide está trabalhando de forma equilibrada.', 'Valores baixos podem estar associados a uma tireoide acelerada (hipertireoidismo).', 'Valores altos podem estar associados a uma tireoide lenta (hipotireoidismo).', 'Vale levar este resultado ao seu médico para avaliar a tireoide.', 'Vale levar este resultado ao seu médico para avaliar a tireoide.'),
  ('t4_livre', 'T4 livre', 'lab', 'Hormônio produzido pela tireoide e disponível para uso pelo corpo.', 'Complementa o TSH na avaliação do funcionamento da tireoide.', 'Valores baixos podem estar associados a uma tireoide pouco ativa.', 'Valores altos podem estar associados a uma tireoide muito ativa.', 'Converse com seu médico sobre avaliar a tireoide.', 'Converse com seu médico sobre avaliar a tireoide.'),
  ('vitamina_d', 'Vitamina D', 'lab', 'Vitamina ligada à saúde dos ossos, dos músculos e da imunidade.', 'Níveis adequados ajudam na absorção de cálcio e na força dos ossos.', 'Valores baixos podem estar associados a ossos mais fracos e cansaço.', 'Valores muito altos geralmente vêm de suplementação em excesso.', 'Converse com seu médico sobre sol, alimentação e a necessidade de avaliar suplementação.', 'Converse com seu médico sobre revisar qualquer suplemento que você esteja usando.'),
  ('vitamina_b12', 'Vitamina B12', 'lab', 'Vitamina importante para o sangue e para o sistema nervoso.', 'Níveis adequados ajudam a evitar anemia e formigamentos.', 'Valores baixos podem estar associados a anemia, cansaço e formigamento.', 'Valores altos costumam ter pouca importância clínica.', 'Converse com seu médico sobre alimentação e a necessidade de avaliar suplementação.', 'Geralmente não exige ação; confirme com seu médico na consulta.'),
  ('acido_folico', 'Ácido fólico (folato)', 'lab', 'Vitamina do complexo B importante para a formação do sangue.', 'Níveis adequados ajudam a evitar um tipo de anemia e são importantes na gestação.', 'Valores baixos podem estar associados a anemia e cansaço.', 'Valores altos costumam ter pouca importância clínica.', 'Converse com seu médico sobre alimentação e a necessidade de avaliar suplementação.', 'Geralmente não exige ação; confirme com seu médico se tiver dúvidas.'),
  ('sodio', 'Sódio', 'lab', 'Mineral que ajuda a equilibrar os líquidos e o funcionamento dos nervos.', 'O equilíbrio do sódio é importante para o coração, o cérebro e os músculos.', 'Valores baixos podem causar confusão, fraqueza ou náuseas.', 'Valores altos costumam estar ligados a desidratação.', 'Vale levar este resultado ao seu médico para investigar a causa do valor baixo.', 'Converse com seu médico sobre hidratação e a causa do valor elevado.'),
  ('potassio', 'Potássio', 'lab', 'Mineral essencial para os músculos e para o ritmo do coração.', 'Tanto a falta quanto o excesso podem afetar o coração.', 'Valores baixos podem causar fraqueza, cãibras e alterações no coração.', 'Valores altos podem afetar o ritmo do coração e merecem atenção.', 'Vale levar este resultado ao seu médico para investigar o valor baixo.', 'Vale levar este resultado ao seu médico para avaliar o valor elevado.'),
  ('calcio', 'Cálcio', 'lab', 'Mineral fundamental para ossos, músculos e nervos.', 'O equilíbrio do cálcio é importante para os ossos e para o coração.', 'Valores baixos podem causar formigamento e cãibras.', 'Valores altos podem estar associados a alterações nas glândulas ou nos ossos.', 'Converse com seu médico sobre investigar a causa do valor baixo.', 'Vale levar este resultado ao seu médico para investigar o valor elevado.'),
  ('magnesio', 'Magnésio', 'lab', 'Mineral envolvido em músculos, nervos e produção de energia.', 'O equilíbrio do magnésio ajuda no funcionamento dos músculos e do coração.', 'Valores baixos podem causar cãibras, fraqueza e alterações no coração.', 'Valores altos são menos comuns e às vezes ligados aos rins ou a suplementos.', 'Converse com seu médico sobre alimentação e a causa do valor baixo.', 'Vale levar este resultado ao seu médico para avaliar o valor elevado.'),
  ('ferritina', 'Ferritina', 'lab', 'Reflete os estoques de ferro guardados no seu corpo.', 'Ajuda a avaliar se há falta ou excesso de ferro no organismo.', 'Valores baixos podem estar associados a falta de ferro e anemia.', 'Valores altos às vezes indicam inflamação ou excesso de ferro.', 'Converse com seu médico sobre alimentação e a necessidade de investigar a falta de ferro.', 'Vale levar este resultado ao seu médico para investigar a causa do valor alto.'),
  ('ferro_serico', 'Ferro sérico', 'lab', 'Quantidade de ferro circulando no sangue no momento do exame.', 'Complementa a ferritina na avaliação do ferro do corpo.', 'Valores baixos podem estar associados a falta de ferro e anemia.', 'Valores altos às vezes indicam excesso de ferro ou uso de suplementos.', 'Converse com seu médico sobre alimentação e a necessidade de investigar a falta de ferro.', 'Vale levar este resultado ao seu médico para investigar o valor elevado.'),
  ('pcr', 'Proteína C reativa (PCR)', 'lab', 'Substância que aumenta no sangue quando há inflamação no corpo.', 'Ajuda a identificar inflamação ou infecção, sem apontar o local exato.', 'Valores baixos costumam ser um bom sinal, indicando pouca inflamação.', 'Valores altos podem estar associados a infecção ou inflamação em algum ponto do corpo.', 'Geralmente é um bom sinal; confirme com seu médico na consulta.', 'Vale levar este resultado ao seu médico para investigar a causa da inflamação.'),
  ('acido_urico', 'Ácido úrico', 'lab', 'Resíduo formado pela quebra de certas substâncias dos alimentos e das células.', 'Em excesso pode se acumular nas articulações e nos rins.', 'Valores baixos raramente são preocupantes.', 'Valores altos podem estar associados a crises de gota e a pedras nos rins.', 'Geralmente não exige ação; confirme com seu médico se tiver dúvidas.', 'Converse com seu médico sobre alimentação e acompanhamento do ácido úrico.'),
  ('vhs', 'VHS (velocidade de hemossedimentação)', 'lab', 'Mede de forma indireta a presença de inflamação no organismo.', 'Ajuda a identificar e acompanhar processos inflamatórios.', 'Valores baixos costumam ser normais e raramente preocupam.', 'Valores altos podem estar associados a inflamação ou infecção.', 'Geralmente é um bom sinal; confirme com seu médico na consulta.', 'Vale levar este resultado ao seu médico para investigar a causa do valor elevado.')
on conflict (metric_key) do nothing;


-- ============================================================
-- 0006_analysis_consultas.sql
-- ============================================================
-- ============================================================================
-- VidaLog — Migration 0006
-- Análise (altura p/ IMC) + Consultas (CRM, link, lembretes, anexo)
-- ============================================================================

-- ── profiles: altura (para cálculo de IMC) ──────────────────────────────────
alter table public.profiles
  add column if not exists height_cm numeric(5, 1);

-- ── appointments: CRM, link de teleconsulta, lembretes, anexo de exame ──────
alter table public.appointments
  add column if not exists doctor_crm text,
  add column if not exists meeting_link text,
  -- minutos antes da consulta para lembrar (gancho p/ notificações — Fase 4)
  add column if not exists reminders smallint[] not null default '{1440,60}',
  add column if not exists exam_id uuid references public.exams (id) on delete set null;
comment on column public.appointments.doctor_crm is 'PHI: care_provider';

create index if not exists appointments_exam_idx on public.appointments (exam_id);


-- ============================================================
-- 0007_consent_settings_education.sql
-- ============================================================
-- ============================================================================
-- VidaLog — Migration 0007
-- Consentimento (operadora + soft-delete) · Configurações · Educação
-- ============================================================================

-- ── Consentimento: escopo "Operadora de saúde" ──────────────────────────────
alter type consent_purpose add value if not exists 'data_sharing_insurance';

-- ── Soft-delete de conta (LGPD: carência de 30 dias) ────────────────────────
alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_scheduled_at timestamptz;

-- ── user_settings: tema, idioma, notificações ───────────────────────────────
create table public.user_settings (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  theme             text not null default 'system',     -- 'light' | 'dark' | 'system'
  locale            text not null default 'pt-BR',
  notif_push        boolean not null default true,
  notif_email       boolean not null default true,
  notif_whatsapp    boolean not null default false,     -- Plus (envio = Fase 4)
  quiet_hours_start time,
  quiet_hours_end   time,
  updated_at        timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "user_settings_select_own" on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_settings_modify_own" on public.user_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ── health_content: conteúdo educativo (leitura pública) ────────────────────
create table public.health_content (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text not null,
  tags            text[] not null default '{}',   -- códigos/chaves CID associados
  reading_minutes smallint not null default 3,
  source          text not null,                  -- ex.: 'Ministério da Saúde', 'SBC'
  source_url      text,
  created_at      timestamptz not null default now()
);
create index health_content_tags_idx on public.health_content using gin (tags);

alter table public.health_content enable row level security;
create policy "health_content_read" on public.health_content for select to authenticated using (true);

-- ── reading_list: salvar para depois ────────────────────────────────────────
create table public.reading_list (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  content_id uuid not null references public.health_content (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, content_id)
);
alter table public.reading_list enable row level security;
create policy "reading_list_select_own" on public.reading_list for select to authenticated
  using (user_id = (select auth.uid()));
create policy "reading_list_modify_own" on public.reading_list for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- O seed de health_content fica em 0008_health_content_seed.sql.


-- ============================================================
-- 0008_health_content_seed.sql
-- ============================================================
-- Seed: conteúdo educativo (health_content)
-- ATENÇÃO: conteúdo educativo curado para MVP. Apenas informativo — NÃO substitui
-- avaliação médica. Deve ser revisado por profissional de saúde antes de produção.

insert into public.health_content (title, body, tags, reading_minutes, source, source_url)
values
  (
    'Entendendo a hipertensão',
    'A hipertensão, conhecida como pressão alta, acontece quando a força do sangue contra as paredes das artérias fica elevada por muito tempo. Na maioria das vezes não causa sintomas, por isso é chamada de "inimiga silenciosa".

Hábitos saudáveis ajudam a manter a pressão sob controle: reduzir o sal, comer mais frutas e verduras, praticar atividade física com regularidade, evitar o cigarro e o excesso de álcool e cuidar do sono e do estresse.

Medir a pressão de tempos em tempos é uma forma simples de se cuidar. Converse sempre com seu médico antes de mudar hábitos ou qualquer medicação, pois cada pessoa é única.',
    '{I10}', 3, 'Sociedade Brasileira de Cardiologia (SBC)', 'https://www.cardiol.br'
  ),
  (
    'Convivendo com o diabetes tipo 2',
    'No diabetes tipo 2, o corpo tem dificuldade de usar bem a insulina, o hormônio que ajuda o açúcar do sangue a entrar nas células. Com o tempo, a glicose pode ficar mais alta do que o ideal.

A boa notícia é que pequenos hábitos fazem muita diferença: alimentação equilibrada com menos açúcar e ultraprocessados, movimento no dia a dia, sono adequado e acompanhamento regular ajudam bastante.

Manter um peso saudável e não fumar também contribuem. Converse sempre com seu médico sobre o seu caso e siga as orientações de quem acompanha a sua saúde.',
    '{E11}', 3, 'Sociedade Brasileira de Diabetes (SBD)', 'https://diabetes.org.br'
  ),
  (
    'O que é o diabetes tipo 1',
    'O diabetes tipo 1 costuma surgir na infância ou juventude, quando o corpo deixa de produzir insulina. Por isso, quem tem essa condição precisa repor a insulina para manter a glicose equilibrada.

Com informação e rotina, é totalmente possível viver bem. Monitorar a glicose, manter horários de alimentação, praticar atividades e contar com apoio de familiares e da equipe de saúde fazem parte do cuidado.

Cada pessoa responde de um jeito, então o plano é sempre individual. Converse sempre com seu médico e a equipe que acompanha você para ajustar o cuidado às suas necessidades.',
    '{E10}', 3, 'Sociedade Brasileira de Diabetes (SBD)', 'https://diabetes.org.br'
  ),
  (
    'Colesterol alto: o que saber',
    'O colesterol é uma gordura importante para o corpo, mas em excesso no sangue pode se acumular nas artérias ao longo do tempo. Existe o colesterol "bom" (HDL) e o "ruim" (LDL), e o equilíbrio entre eles importa.

Hábitos que ajudam: preferir alimentos naturais, reduzir frituras e ultraprocessados, incluir fibras, frutas e verduras, manter-se ativo e evitar o cigarro. Pequenas mudanças somam muito.

Exames de rotina ajudam a acompanhar seus níveis. Converse sempre com seu médico para entender seus resultados e definir, em conjunto, o melhor caminho para você.',
    '{E78}', 3, 'Sociedade Brasileira de Cardiologia (SBC)', 'https://www.cardiol.br'
  ),
  (
    'Asma: respirar com mais tranquilidade',
    'A asma é uma condição em que as vias respiratórias ficam mais sensíveis e podem inflamar, causando tosse, chiado no peito e falta de ar em alguns momentos.

Conhecer o que costuma desencadear as crises — como poeira, fumaça, mofo ou ar muito frio — ajuda a evitá-las. Manter a casa arejada e limpa e não fumar perto de casa também fazem diferença.

Com acompanhamento adequado, a maioria das pessoas leva uma vida ativa e tranquila. Converse sempre com seu médico para entender seu caso e ter um plano de cuidado feito para você.',
    '{J45}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Entendendo a ansiedade',
    'Sentir ansiedade faz parte da vida. Ela se torna um sinal de atenção quando é muito frequente, intensa ou atrapalha o dia a dia, o sono ou os relacionamentos.

Algumas práticas podem trazer alívio: respiração calma, atividade física, contato com pessoas de confiança, reduzir cafeína e cuidar do sono. Reservar momentos para descansar também ajuda.

Pedir ajuda é um ato de cuidado, não de fraqueza. Converse sempre com seu médico ou um profissional de saúde mental se a ansiedade estiver pesando — há apoio disponível e tratamento.',
    '{F41}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Depressão: você não está sozinho',
    'A depressão é mais do que tristeza passageira. Ela pode trazer desânimo persistente, perda de interesse, cansaço, alterações no sono e no apetite por semanas seguidas.

É importante lembrar que se trata de uma condição de saúde, não de "falta de força de vontade". Manter vínculos, rotina, movimento e luz do dia pode ajudar, mas nem sempre é suficiente sozinho.

Buscar apoio faz toda a diferença e a recuperação é possível. Converse sempre com seu médico ou um profissional de saúde mental. Se houver pensamentos de se machucar, procure ajuda imediatamente ou ligue 188 (CVV).',
    '{F32}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Hipotireoidismo em palavras simples',
    'A tireoide é uma glândula no pescoço que ajuda a regular o ritmo do corpo. No hipotireoidismo, ela trabalha de forma mais lenta do que o necessário, o que pode causar cansaço, frio, pele seca ou ganho de peso.

Esses sinais são comuns a muitas situações, por isso só exames e avaliação ajudam a entender o que está acontecendo. Uma alimentação equilibrada e bons hábitos de sono apoiam o bem-estar geral.

Com acompanhamento, a condição costuma ser bem controlada. Converse sempre com seu médico para investigar seus sintomas e definir o cuidado mais adequado ao seu caso.',
    '{E03}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Rinite alérgica: aliviando os sintomas',
    'A rinite alérgica acontece quando o nariz reage a coisas como poeira, ácaros, pólen ou pelos de animais, causando espirros, coceira, nariz entupido ou escorrendo.

Medidas no ambiente ajudam bastante: manter a casa arejada, lavar roupas de cama com frequência, reduzir tapetes e cortinas que acumulam poeira e evitar fumaça de cigarro.

Conhecer os seus "gatilhos" é o primeiro passo para conviver melhor com a rinite. Converse sempre com seu médico para entender o que mais incomoda você e encontrar formas de aliviar os sintomas.',
    '{J30}', 2, 'Fiocruz', 'https://www.fiocruz.br'
  ),
  (
    'Enxaqueca: entendendo as crises',
    'A enxaqueca é uma dor de cabeça que costuma ser forte, muitas vezes de um lado, e pode vir acompanhada de náusea, sensibilidade à luz e aos sons. As crises atrapalham bastante o dia.

Observar possíveis desencadeantes — como sono irregular, jejum prolongado, estresse ou certos alimentos — pode ajudar a reduzir a frequência. Hidratação e rotina de sono também contribuem.

Anotar quando as crises acontecem é uma boa forma de se conhecer melhor. Converse sempre com seu médico se as dores forem frequentes ou intensas, para encontrar um plano de cuidado adequado a você.',
    '{G43}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Obesidade: cuidado e acolhimento',
    'A obesidade é uma condição de saúde complexa, ligada a vários fatores — genéticos, ambientais, emocionais e de estilo de vida. Ela merece cuidado e respeito, sem culpa ou julgamento.

Mudanças pequenas e sustentáveis tendem a funcionar melhor do que dietas radicais: pratos coloridos e equilibrados, mais movimento prazeroso no dia a dia, sono de qualidade e atenção ao bem-estar emocional.

Cada pessoa tem um ponto de partida diferente, e o acompanhamento faz diferença. Converse sempre com seu médico e, se possível, uma equipe multiprofissional para um plano feito para você.',
    '{E66}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Cuidando do coração no dia a dia',
    'Cuidar do coração é cuidar da vida toda. Pressão, colesterol e açúcar no sangue equilibrados ajudam a manter as artérias saudáveis e reduzem o risco de problemas cardiovasculares ao longo do tempo.

Hábitos protetores caminham juntos: alimentação rica em alimentos naturais, atividade física regular, não fumar, moderar o álcool, dormir bem e cuidar do estresse. Pequenas escolhas diárias somam muito.

Acompanhar a saúde com exames de rotina ajuda a perceber sinais cedo. Converse sempre com seu médico para conhecer seus números e construir, juntos, um plano de prevenção que combine com a sua vida.',
    '{I10,E78,I25}', 4, 'Sociedade Brasileira de Cardiologia (SBC)', 'https://www.cardiol.br'
  )
;


-- ============================================================
-- 0009_family.sql
-- ============================================================
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


-- ============================================================
-- 0010_social.sql
-- ============================================================
-- ============================================================================
-- VidaLog — Migration 0010
-- Comunidade (grupos por CID-10) + Rede Social, com Realtime.
--
-- Privacidade: posts anônimos NÃO expõem o autor a nenhum cliente (a view
-- feed_posts oculta author_id quando is_anonymous). O author_id segue gravado
-- na tabela base apenas para o dono apagar/moderar (não é exposto via API).
-- ============================================================================

-- ── Grupos de apoio por condição ────────────────────────────────────────────
create table public.community_groups (
  id          uuid primary key default gen_random_uuid(),
  cid10_code  text,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);
alter table public.community_groups enable row level security;
create policy "groups_read" on public.community_groups for select to authenticated using (true);

create table public.group_members (
  group_id   uuid not null references public.community_groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;
create policy "group_members_select" on public.group_members for select to authenticated using (true);
create policy "group_members_modify_own" on public.group_members for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Perfis sociais (opt-in, controla o que expõe) ───────────────────────────
create table public.social_profiles (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  display_name      text,
  bio               text,
  is_public         boolean not null default false,
  show_achievements boolean not null default true,
  verified_crm      boolean not null default false,   -- selo médico (via verify-crm)
  crm               text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.social_profiles enable row level security;
create policy "social_profiles_read" on public.social_profiles for select to authenticated
  using (is_public or user_id = (select auth.uid()));
create policy "social_profiles_modify_own" on public.social_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger social_profiles_set_updated_at
  before update on public.social_profiles for each row execute function public.set_updated_at();

-- ── Posts (comunidade quando group_id; rede social quando group_id is null) ──
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid references public.community_groups (id) on delete cascade,
  author_id      uuid not null references public.profiles (id) on delete cascade,
  is_anonymous   boolean not null default false,
  content        text not null,
  flair          text,
  is_achievement boolean not null default false,
  hidden         boolean not null default false,
  created_at     timestamptz not null default now()
);
create index posts_group_idx on public.posts (group_id, created_at desc);
create index posts_feed_idx on public.posts (created_at desc) where group_id is null;
alter table public.posts enable row level security;
create policy "posts_select" on public.posts for select to authenticated using (not hidden);
create policy "posts_insert_own" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "posts_update_own" on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "posts_delete_own" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

-- ── Reações ─────────────────────────────────────────────────────────────────
create table public.post_reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);
create index post_reactions_post_idx on public.post_reactions (post_id);
alter table public.post_reactions enable row level security;
create policy "reactions_select" on public.post_reactions for select to authenticated using (true);
create policy "reactions_modify_own" on public.post_reactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Comentários ─────────────────────────────────────────────────────────────
create table public.post_comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  is_anonymous boolean not null default false,
  content      text not null,
  hidden       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
create policy "comments_select" on public.post_comments for select to authenticated using (not hidden);
create policy "comments_insert_own" on public.post_comments for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "comments_delete_own" on public.post_comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- ── Enquetes ────────────────────────────────────────────────────────────────
create table public.polls (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null unique references public.posts (id) on delete cascade,
  question text not null,
  options  text[] not null
);
alter table public.polls enable row level security;
create policy "polls_select" on public.polls for select to authenticated using (true);
create policy "polls_insert_author" on public.polls for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

create table public.poll_votes (
  poll_id      uuid not null references public.polls (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  option_index smallint not null,
  created_at   timestamptz not null default now(),
  primary key (poll_id, user_id)
);
alter table public.poll_votes enable row level security;
create policy "poll_votes_select" on public.poll_votes for select to authenticated using (true);
create policy "poll_votes_modify_own" on public.poll_votes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Conexões (seguir) ───────────────────────────────────────────────────────
create table public.user_connections (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);
alter table public.user_connections enable row level security;
create policy "connections_select_involved" on public.user_connections for select to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));
create policy "connections_modify_own" on public.user_connections for all to authenticated
  using (follower_id = (select auth.uid())) with check (follower_id = (select auth.uid()));

-- ── Denúncias (moderação) ───────────────────────────────────────────────────
create table public.user_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  post_id     uuid references public.posts (id) on delete cascade,
  comment_id  uuid references public.post_comments (id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now()
);
alter table public.user_reports enable row level security;
create policy "reports_insert_own" on public.user_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "reports_select_own" on public.user_reports for select to authenticated
  using (reporter_id = (select auth.uid()));

-- ── VIEW feed_posts — oculta o autor em posts anônimos ──────────────────────
create view public.feed_posts
with (security_invoker = on) as
select
  p.id,
  p.group_id,
  p.content,
  p.flair,
  p.is_achievement,
  p.is_anonymous,
  p.created_at,
  case when p.is_anonymous then null else p.author_id end as author_id,
  case when p.is_anonymous then 'Anônimo' else coalesce(sp.display_name, 'Usuário') end as author_display,
  case when p.is_anonymous then false else coalesce(sp.verified_crm, false) end as author_verified
from public.posts p
left join public.social_profiles sp on sp.user_id = p.author_id
where not p.hidden;

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='post_reactions') then
    alter publication supabase_realtime add table public.post_reactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='post_comments') then
    alter publication supabase_realtime add table public.post_comments;
  end if;
end $$;

-- ── Seed de grupos ──────────────────────────────────────────────────────────
insert into public.community_groups (cid10_code, name, description) values
  ('E11', 'Diabetes tipo 2', 'Apoio e troca de experiências sobre o convívio com o diabetes.'),
  ('I10', 'Hipertensão', 'Dicas e acolhimento para quem cuida da pressão arterial.'),
  ('M32', 'Lúpus', 'Comunidade de pessoas que convivem com o lúpus.'),
  ('J45', 'Asma', 'Respirar melhor: experiências e apoio sobre asma.'),
  ('F32', 'Depressão', 'Um espaço seguro de apoio mútuo. Você não está sozinho(a).'),
  ('F41', 'Ansiedade', 'Acolhimento e estratégias para lidar com a ansiedade.'),
  ('E03', 'Hipotireoidismo', 'Troca de experiências sobre a tireoide.'),
  ('E66', 'Obesidade', 'Cuidado e acolhimento, sem julgamentos.'),
  (null, 'Bem-estar geral', 'Conversas gerais sobre saúde, hábitos e qualidade de vida.')
on conflict do nothing;


-- ============================================================
-- 0011_security_hardening.sql
-- ============================================================
-- ============================================================================
-- VidaLog — Migration 0011 — Endurecimento de segurança/privacidade
-- (correções da auditoria)
-- ============================================================================

-- ── audit_log imutável a nível de banco (inclusive sob service_role) ────────
create or replace function public.prevent_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Registro imutável (append-only).';
end;
$$;

drop trigger if exists audit_log_no_update on public.audit_log;
drop trigger if exists audit_log_no_delete on public.audit_log;
create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.prevent_mutation();
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.prevent_mutation();

-- ── Anonimato de COMENTÁRIOS: view que oculta o autor quando anônimo ────────
-- (espelha o que feed_posts já faz para posts — fecha o vazamento de author_id)
create view public.feed_comments
with (security_invoker = on) as
select
  c.id,
  c.post_id,
  c.content,
  c.is_anonymous,
  c.created_at,
  case when c.is_anonymous then null else c.author_id end as author_id,
  case when c.is_anonymous then 'Anônimo' else coalesce(sp.display_name, 'Usuário') end as author_display
from public.post_comments c
left join public.social_profiles sp on sp.user_id = c.author_id
where not c.hidden;


-- ============================================================
-- 0012_forum.sql
-- ============================================================
-- ============================================================================
-- VidaLog — Migration 0012 — Fórum (Rede Social)
-- Reusa `posts` como TÓPICOS e `post_comments` como RESPOSTAS (threaded 1 nível).
-- ============================================================================

-- ── posts vira "tópico" ─────────────────────────────────────────────────────
alter table public.posts
  add column if not exists title text,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists is_locked boolean not null default false,
  add column if not exists is_solved boolean not null default false,
  add column if not exists best_comment_id uuid,
  add column if not exists reply_count integer not null default 0,
  add column if not exists last_activity_at timestamptz not null default now();

create index if not exists posts_forum_idx
  on public.posts (group_id, is_pinned desc, last_activity_at desc);

-- ── post_comments vira "resposta" (árvore de 1 nível) ───────────────────────
alter table public.post_comments
  add column if not exists parent_comment_id uuid references public.post_comments (id) on delete cascade;
create index if not exists post_comments_parent_idx on public.post_comments (parent_comment_id);

-- best_comment_id referencia uma resposta (adicionado após as duas tabelas)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_best_comment_fk') then
    alter table public.posts
      add constraint posts_best_comment_fk
      foreign key (best_comment_id) references public.post_comments (id) on delete set null;
  end if;
end $$;

-- ── Seguir tópico ───────────────────────────────────────────────────────────
create table if not exists public.thread_follows (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.thread_follows enable row level security;
create policy "thread_follows_select_own" on public.thread_follows for select to authenticated
  using (user_id = (select auth.uid()));
create policy "thread_follows_modify_own" on public.thread_follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Trigger: mantém reply_count + last_activity_at do tópico ────────────────
create or replace function public.bump_thread_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set reply_count = reply_count + 1, last_activity_at = now() where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set reply_count = greatest(0, reply_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end; $$;

drop trigger if exists comments_bump_activity on public.post_comments;
create trigger comments_bump_activity
  after insert or delete on public.post_comments
  for each row execute function public.bump_thread_activity();

-- ── Atualiza as views para expor os campos do fórum ─────────────────────────
create or replace view public.feed_posts
with (security_invoker = on) as
select
  p.id, p.group_id, p.content, p.flair, p.is_achievement, p.is_anonymous, p.created_at,
  case when p.is_anonymous then null else p.author_id end as author_id,
  case when p.is_anonymous then 'Anônimo' else coalesce(sp.display_name, 'Usuário') end as author_display,
  case when p.is_anonymous then false else coalesce(sp.verified_crm, false) end as author_verified,
  p.title, p.reply_count, p.last_activity_at, p.is_solved, p.is_pinned, p.best_comment_id, p.is_locked
from public.posts p
left join public.social_profiles sp on sp.user_id = p.author_id
where not p.hidden;

create or replace view public.feed_comments
with (security_invoker = on) as
select
  c.id, c.post_id, c.content, c.is_anonymous, c.created_at,
  case when c.is_anonymous then null else c.author_id end as author_id,
  case when c.is_anonymous then 'Anônimo' else coalesce(sp.display_name, 'Usuário') end as author_display,
  c.parent_comment_id, coalesce(sp.verified_crm, false) and not c.is_anonymous as author_verified
from public.post_comments c
left join public.social_profiles sp on sp.user_id = c.author_id
where not c.hidden;

