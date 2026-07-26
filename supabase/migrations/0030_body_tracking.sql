-- ============================================================================
-- 0030 — Acompanhamento corporal e alimentar (inspirado em Fitdays + WebDiet).
-- 4 tabelas de bem-estar (grátis), owner-only (user_id = auth.uid()), como água.
-- NUNCA diagnostica: só REGISTRA o que a pessoa/balança informa. Cuidador não
-- acessa nesta v1 (mesmo padrão do ciclo/água); pode virar patient_id depois.
-- ============================================================================

-- 1) Composição corporal (o que a balança inteligente reporta) --------------
create table if not exists public.body_composition (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  measured_at      timestamptz not null default now(),
  weight_kg        numeric(6,2),
  bmi              numeric(5,2),
  body_fat_pct     numeric(5,2),
  muscle_mass_pct  numeric(5,2),
  visceral_fat     numeric(5,1),
  body_water_pct   numeric(5,2),
  bone_mass_kg     numeric(5,2),
  bmr_kcal         integer,
  created_at       timestamptz not null default now()
);
create index if not exists body_composition_user_idx
  on public.body_composition (user_id, measured_at desc);

-- 2) Circunferências (cintura, quadril, etc.) --------------------------------
create table if not exists public.body_measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  measured_at  timestamptz not null default now(),
  waist_cm     numeric(5,1),
  hip_cm       numeric(5,1),
  arm_cm       numeric(5,1),
  thigh_cm     numeric(5,1),
  calf_cm      numeric(5,1),
  neck_cm      numeric(5,1),
  chest_cm     numeric(5,1),
  created_at   timestamptz not null default now()
);
create index if not exists body_measurements_user_idx
  on public.body_measurements (user_id, measured_at desc);

-- 3) Diário alimentar (registro simples, sem prescrição) ---------------------
create table if not exists public.meal_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  logged_at    timestamptz not null default now(),
  meal_type    text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  description  text not null,
  feeling      smallint check (feeling between 1 and 5),
  photo_url    text,
  created_at   timestamptz not null default now()
);
create index if not exists meal_logs_user_idx
  on public.meal_logs (user_id, logged_at desc);

-- 4) Metas (peso, passos, água) ----------------------------------------------
create table if not exists public.user_goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  goal_type    text not null check (goal_type in ('weight','steps','water')),
  target_value numeric(8,2) not null,
  updated_at   timestamptz not null default now(),
  unique (user_id, goal_type)
);

-- RLS owner-only para as 4 tabelas -------------------------------------------
alter table public.body_composition  enable row level security;
alter table public.body_measurements enable row level security;
alter table public.meal_logs         enable row level security;
alter table public.user_goals        enable row level security;

drop policy if exists "body_composition_own" on public.body_composition;
create policy "body_composition_own" on public.body_composition
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "body_measurements_own" on public.body_measurements;
create policy "body_measurements_own" on public.body_measurements
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "meal_logs_own" on public.meal_logs;
create policy "meal_logs_own" on public.meal_logs
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "user_goals_own" on public.user_goals;
create policy "user_goals_own" on public.user_goals
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
