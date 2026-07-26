-- ============================================================================
-- VidaLog — Migration 0014 — Jornada GESTANTE (Modo Gestante)
--
-- Princípios reforçados (LGPD + CFM, saúde materna = risco aumentado):
--  * O app NUNCA interpreta sinais nem infere risco. `risk_level` só é o que o
--    usuário/médico informar (null = não informado — jamais "baixo risco").
--  * Movimentos fetais são apenas REGISTRO, sem interpretação automática.
--  * Marcos do pré-natal vêm de catálogo curado do Ministério da Saúde (MS).
--  * Sem compartilhamento com cuidador por padrão — a gestante decide.
--
-- NÃO rodar em produção: gerar e aplicar com `npx supabase db push` em dev.
-- ============================================================================

create type pregnancy_status as enum ('active', 'completed', 'lost', 'archived');
create type pregnancy_risk as enum ('habitual', 'alto');

-- ----------------------------------------------------------------------------
-- 1) Jornada de gestação (1 ativa por usuário)
-- ----------------------------------------------------------------------------
create table public.pregnancy_journeys (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  started_at          date not null default current_date,
  due_date            date,            -- DPP (Data Provável do Parto)
  lmp_date            date,            -- DUM (Data da Última Menstruação)
  risk_level          pregnancy_risk,  -- null = NÃO informado (nunca inferir)
  obstetrician_name   text,
  obstetrician_crm    text,
  obstetrician_phone  text,            -- botão "Falar com meu obstetra"
  maternity_reference text,            -- maternidade de referência (texto livre)
  maternity_phone     text,            -- banner de emergência
  status              pregnancy_status not null default 'active',
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint pregnancy_has_some_date check (due_date is not null or lmp_date is not null)
);
-- Apenas 1 gestação 'active' por usuária.
create unique index pregnancy_one_active_per_user
  on public.pregnancy_journeys (user_id) where (status = 'active');
create index pregnancy_journeys_user_idx on public.pregnancy_journeys (user_id, status);

create trigger pregnancy_journeys_set_updated_at
  before update on public.pregnancy_journeys
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2) Registro de peso por semana gestacional
-- ----------------------------------------------------------------------------
create table public.pregnancy_weight_log (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null references public.pregnancy_journeys (id) on delete cascade,
  week        integer not null check (week between 1 and 42),
  weight_kg   numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 400),
  recorded_at timestamptz not null default now()
);
create index pregnancy_weight_journey_idx on public.pregnancy_weight_log (journey_id, week);

-- ----------------------------------------------------------------------------
-- 3) Movimentos fetais — APENAS registro, sem interpretação
-- ----------------------------------------------------------------------------
create table public.pregnancy_fetal_movements (
  id               uuid primary key default gen_random_uuid(),
  journey_id       uuid not null references public.pregnancy_journeys (id) on delete cascade,
  recorded_at      timestamptz not null default now(),
  duration_minutes integer check (duration_minutes >= 0),
  movements_count  integer check (movements_count >= 0),
  notes            text
);
create index pregnancy_movements_journey_idx
  on public.pregnancy_fetal_movements (journey_id, recorded_at desc);

-- ----------------------------------------------------------------------------
-- 4) Catálogo de marcos do pré-natal (referência pública — fonte MS)
-- ----------------------------------------------------------------------------
create table public.pregnancy_milestone_catalog (
  code              text primary key,
  label_pt          text not null,
  trimester         smallint not null check (trimester in (1, 2, 3)),
  week_min          smallint not null,
  week_max          smallint not null,
  category          text not null default 'consulta', -- 'consulta'|'exame'|'vacina'
  description_short text,
  source            text not null default 'MS'        -- Ministério da Saúde
);

-- ----------------------------------------------------------------------------
-- 5) Marcos da jornada (instâncias por gestação)
-- ----------------------------------------------------------------------------
create table public.pregnancy_milestones (
  id             uuid primary key default gen_random_uuid(),
  journey_id     uuid not null references public.pregnancy_journeys (id) on delete cascade,
  milestone_code text not null references public.pregnancy_milestone_catalog (code),
  planned_at     date,
  completed_at   date,
  notes          text,
  created_at     timestamptz not null default now(),
  unique (journey_id, milestone_code)
);
create index pregnancy_milestones_journey_idx on public.pregnancy_milestones (journey_id);

-- ----------------------------------------------------------------------------
-- Seed do catálogo — Caderno de Atenção ao Pré-natal de Baixo Risco (MS).
-- Conteúdo educativo e factual; a interpretação é sempre do pré-natal.
-- ----------------------------------------------------------------------------
insert into public.pregnancy_milestone_catalog
  (code, label_pt, trimester, week_min, week_max, category, description_short) values
  ('first_consult',        'Primeira consulta de pré-natal',           1,  6, 12, 'consulta', 'Idealmente até a 12ª semana. Início do acompanhamento.'),
  ('lab_routine_1t',       'Exames de rotina do 1º trimestre',         1,  6, 13, 'exame',    'Hemograma, tipagem sanguínea/fator Rh, glicemia, sorologias e urina.'),
  ('usg_nuchal',           'Ultrassom — translucência nucal',          1, 11, 14, 'exame',    'Ultrassom morfológico do 1º trimestre (11ª a 14ª semana).'),
  ('vaccine_hepb',         'Vacina hepatite B (se necessário)',        1,  6, 14, 'vacina',   'Conforme situação vacinal, orientada no pré-natal.'),
  ('consult_monthly_t1',   'Consulta mensal (até 28 semanas)',         1, 14, 28, 'consulta', 'Consultas mensais durante o 1º e 2º trimestres.'),
  ('usg_morphological',    'Ultrassom morfológico do 2º trimestre',    2, 20, 24, 'exame',    'Avaliação morfológica fetal (20ª a 24ª semana).'),
  ('glucose_tolerance',    'Teste de tolerância à glicose (TOTG)',     2, 24, 28, 'exame',    'Rastreio de diabetes gestacional (24ª a 28ª semana).'),
  ('vaccine_dtpa',         'Vacina dTpa',                              2, 20, 36, 'vacina',   'Recomendada a partir da 20ª semana, a cada gestação.'),
  ('vaccine_influenza',    'Vacina influenza (sazonal)',               2, 14, 40, 'vacina',   'Em qualquer trimestre, conforme campanha.'),
  ('consult_biweekly',     'Consulta quinzenal (28–36 semanas)',       3, 28, 36, 'consulta', 'Consultas a cada 15 dias entre a 28ª e a 36ª semana.'),
  ('lab_routine_3t',       'Exames de rotina do 3º trimestre',         3, 28, 36, 'exame',    'Repetição de hemograma, sorologias e glicemia.'),
  ('gbs_swab',             'Pesquisa de estreptococo B (GBS)',         3, 35, 37, 'exame',    'Swab vaginal/retal entre a 35ª e a 37ª semana.'),
  ('consult_weekly',       'Consulta semanal (a partir de 36 semanas)',3, 36, 41, 'consulta', 'Consultas semanais a partir da 36ª semana até o parto.');

-- ----------------------------------------------------------------------------
-- RPC atômica: inicia a gestação e popula os marcos do catálogo de uma vez.
-- planned_at é ESTIMADO a partir da DPP (DPP = 40ª semana), só como sugestão.
-- ----------------------------------------------------------------------------
create or replace function public.start_pregnancy(
  p_due_date            date,
  p_lmp_date            date default null,
  p_risk                pregnancy_risk default null,
  p_obstetrician_name   text default null,
  p_obstetrician_crm    text default null,
  p_obstetrician_phone  text default null,
  p_maternity_reference text default null,
  p_maternity_phone     text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_journey uuid;
  v_anchor  date := coalesce(p_due_date, p_lmp_date + 280);
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = 'insufficient_privilege';
  end if;
  if p_due_date is null and p_lmp_date is null then
    raise exception 'Informe a DPP ou a DUM.' using errcode = 'check_violation';
  end if;

  insert into public.pregnancy_journeys
    (user_id, due_date, lmp_date, risk_level, obstetrician_name, obstetrician_crm,
     obstetrician_phone, maternity_reference, maternity_phone)
  values
    (v_uid, p_due_date, p_lmp_date, p_risk, p_obstetrician_name, p_obstetrician_crm,
     p_obstetrician_phone, p_maternity_reference, p_maternity_phone)
  returning id into v_journey;

  insert into public.pregnancy_milestones (journey_id, milestone_code, planned_at)
  select
    v_journey,
    c.code,
    (v_anchor - ((40 - ((c.week_min + c.week_max) / 2)) * 7))::date
  from public.pregnancy_milestone_catalog c;

  return v_journey;
end;
$$;

-- ----------------------------------------------------------------------------
-- RLS — tudo restrito à dona da gestação. Sem acesso de cuidador por padrão.
-- ----------------------------------------------------------------------------
alter table public.pregnancy_journeys        enable row level security;
alter table public.pregnancy_weight_log       enable row level security;
alter table public.pregnancy_fetal_movements  enable row level security;
alter table public.pregnancy_milestones       enable row level security;
alter table public.pregnancy_milestone_catalog enable row level security;

create policy "preg_journey_own" on public.pregnancy_journeys
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Helper de propriedade via journey (evita repetição).
create or replace function public.owns_pregnancy_journey(p_journey uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pregnancy_journeys j
    where j.id = p_journey and j.user_id = (select auth.uid())
  );
$$;

create policy "preg_weight_own" on public.pregnancy_weight_log
  for all to authenticated
  using (public.owns_pregnancy_journey(journey_id))
  with check (public.owns_pregnancy_journey(journey_id));

create policy "preg_movements_own" on public.pregnancy_fetal_movements
  for all to authenticated
  using (public.owns_pregnancy_journey(journey_id))
  with check (public.owns_pregnancy_journey(journey_id));

create policy "preg_milestones_own" on public.pregnancy_milestones
  for all to authenticated
  using (public.owns_pregnancy_journey(journey_id))
  with check (public.owns_pregnancy_journey(journey_id));

create policy "preg_catalog_read" on public.pregnancy_milestone_catalog
  for select to authenticated using (true);
