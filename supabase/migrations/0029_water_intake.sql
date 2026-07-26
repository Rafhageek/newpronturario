-- ============================================================================
-- 0029 — Hidratação (água). Registro simples de ingestão diária.
-- Feature de bem-estar (grátis). Meta calculada no cliente (25-35 ml/kg);
-- teto para cardiopata/renal é orientação de UI, não regra do banco.
-- ============================================================================

create table if not exists public.water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  ml         integer not null check (ml > 0 and ml <= 3000),
  logged_at  timestamptz not null default now()
);

create index if not exists water_logs_user_day_idx
  on public.water_logs (user_id, logged_at desc);

alter table public.water_logs enable row level security;

drop policy if exists "water_own" on public.water_logs;
create policy "water_own" on public.water_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
