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
