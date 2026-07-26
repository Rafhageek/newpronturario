-- ============================================================================
-- VidaLog — Migration 0017 — Ciclo Menstrual (privacidade máxima)
--
-- Princípios reforçados:
--  * Dado ÍNTIMO: RLS ultra-restritiva — SOMENTE a própria pessoa
--    (user_id = auth.uid()). Sem exceção de cuidador, em nenhuma hipótese.
--  * Compartilhamento (família/médico/pesquisa) é OPT-IN explícito por escopo,
--    todos default FALSE. O mecanismo de compartilhamento temporário em si fica
--    para uma fase futura — aqui só guardamos a preferência.
--  * O app NÃO é método contraceptivo. Previsões são estimativas, não exatidão.
--  * Ao iniciar uma gestação (0014), o tracking do ciclo é pausado
--    automaticamente (preserva os dados; só desliga o acompanhamento ativo).
--
-- NÃO rodar em produção: aplicar com `npx supabase db push` em dev.
-- ============================================================================

create table if not exists public.menstrual_cycle_settings (
  user_id              uuid primary key references public.profiles (id) on delete cascade,
  tracking_enabled     boolean not null default true,
  average_cycle_days   smallint not null default 28 check (average_cycle_days between 15 and 60),
  average_period_days  smallint not null default 5 check (average_period_days between 1 and 15),
  contraceptive_method text,
  -- Compartilhamento: OPT-IN explícito por escopo (todos OFF por padrão).
  share_with_caregiver boolean not null default false,
  share_with_doctor    boolean not null default false,
  share_with_research  boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
drop trigger if exists menstrual_settings_set_updated_at on public.menstrual_cycle_settings;
create trigger menstrual_settings_set_updated_at
  before update on public.menstrual_cycle_settings
  for each row execute function public.set_updated_at();

create table if not exists public.menstrual_cycle_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  log_date   date not null,
  -- 0 = nenhum, 1 = leve, 2 = médio, 3 = intenso
  flow_level smallint not null default 0 check (flow_level between 0 and 3),
  symptoms   text[] not null default '{}',
  mood       text[] not null default '{}',
  notes      text,
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);
create index if not exists menstrual_logs_user_idx on public.menstrual_cycle_logs (user_id, log_date desc);

-- ----------------------------------------------------------------------------
-- RLS ULTRA-RESTRITIVA — só a própria pessoa. Sem cuidador.
-- ----------------------------------------------------------------------------
alter table public.menstrual_cycle_settings enable row level security;
alter table public.menstrual_cycle_logs     enable row level security;

drop policy if exists "cycle_settings_own" on public.menstrual_cycle_settings;
create policy "cycle_settings_own" on public.menstrual_cycle_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "cycle_logs_own" on public.menstrual_cycle_logs;
create policy "cycle_logs_own" on public.menstrual_cycle_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- Ponte com a Gestação: ao engravidar, pausa o tracking do ciclo
-- (preserva os dados — só desliga tracking_enabled).
-- ----------------------------------------------------------------------------
create or replace function public.pause_cycle_on_pregnancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    insert into public.menstrual_cycle_settings (user_id, tracking_enabled)
    values (new.user_id, false)
    on conflict (user_id) do update set tracking_enabled = false, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists pregnancy_pauses_cycle on public.pregnancy_journeys;
create trigger pregnancy_pauses_cycle
  after insert on public.pregnancy_journeys
  for each row execute function public.pause_cycle_on_pregnancy();
