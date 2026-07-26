-- ============================================================================
-- 0031 — Diário alimentar completo (contagem nutricional via TACO).
-- food_entries = itens consumidos, com a nutrição JÁ calculada no cliente
-- (a partir da Tabela TACO). Owner-only. Só registra; nunca prescreve dieta.
-- ============================================================================

create table if not exists public.food_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  logged_at   timestamptz not null default now(),
  meal_type   text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  food_name   text not null,
  grams       numeric(7,1) not null check (grams > 0),
  kcal        numeric(7,1) not null default 0,
  protein_g   numeric(6,1) not null default 0,
  carbs_g     numeric(6,1) not null default 0,
  fat_g       numeric(6,1) not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists food_entries_user_day_idx
  on public.food_entries (user_id, logged_at desc);

alter table public.food_entries enable row level security;
drop policy if exists "food_entries_own" on public.food_entries;
create policy "food_entries_own" on public.food_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Metas: liberar o tipo 'calories' (além de weight/steps/water da 0030).
alter table public.user_goals drop constraint if exists user_goals_goal_type_check;
alter table public.user_goals add constraint user_goals_goal_type_check
  check (goal_type in ('weight','steps','water','calories'));
