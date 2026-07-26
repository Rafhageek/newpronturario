-- ============================================================================
-- VidaLog — Migration 0015 — Caderneta da Criança (Child Health)
--
-- Ética reforçada (LGPD Art. 14 — dado de criança é sensível especial):
--  * Criança NÃO é uma conta/perfil: é um dependente vinculado a um responsável.
--  * Acesso só do responsável (parent_profile_id) ou de cuidador com permissão
--    explícita 'children' no vínculo de cuidado.
--  * TODO acesso é auditável: mutações geram trilha automática (trigger) e as
--    LEITURAS são registradas pela camada de app via RPC log_child_access
--    (Postgres não tem trigger de SELECT).
--  * Curvas de crescimento usam EXCLUSIVAMENTE dados oficiais da OMS (tabela
--    who_growth_standards, semeada em 0016 a partir de fonte citada).
--  * Marcos do desenvolvimento (CDC) e calendário vacinal (PNI/MS) são
--    referência educativa, com a fonte registrada.
--
-- IDEMPOTENTE: pode ser reaplicada com segurança (tipos guardados, tabelas
-- "if not exists", policies recriadas). NÃO rodar em produção sem dev primeiro.
-- ============================================================================

do $$ begin create type child_sex as enum ('male', 'female'); exception when duplicate_object then null; end $$;
do $$ begin create type delivery_type as enum ('vaginal', 'cesarean'); exception when duplicate_object then null; end $$;
do $$ begin create type milestone_category as enum ('motor', 'language', 'social', 'cognitive'); exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 1) children — dependente criança (sem conta própria)
-- ----------------------------------------------------------------------------
create table if not exists public.children (
  id                              uuid primary key default gen_random_uuid(),
  parent_profile_id               uuid not null references public.profiles (id) on delete cascade,
  full_name                       text not null,
  birth_date                      date not null,
  sex                             child_sex not null,
  birth_weight_g                  integer check (birth_weight_g is null or birth_weight_g between 200 and 7000),
  birth_length_cm                 numeric(4, 1) check (birth_length_cm is null or birth_length_cm between 20 and 70),
  birth_head_circumference_cm     numeric(4, 1) check (birth_head_circumference_cm is null or birth_head_circumference_cm between 20 and 50),
  gestational_age_weeks_at_birth  integer check (gestational_age_weeks_at_birth is null or gestational_age_weeks_at_birth between 20 and 45),
  delivery_type                   delivery_type,
  blood_type                      blood_type not null default 'unknown',
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  constraint children_age_v1 check (birth_date <= current_date and birth_date >= (current_date - interval '13 years'))
);
create index if not exists children_parent_idx on public.children (parent_profile_id);
drop trigger if exists children_set_updated_at on public.children;
create trigger children_set_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2) child_growth_measurements — medidas antropométricas (IMC gerado)
-- ----------------------------------------------------------------------------
create table if not exists public.child_growth_measurements (
  id                        uuid primary key default gen_random_uuid(),
  child_id                  uuid not null references public.children (id) on delete cascade,
  measured_at               date not null default current_date,
  age_months_at_measurement integer not null check (age_months_at_measurement between 0 and 240),
  weight_kg                 numeric(5, 2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 150)),
  length_or_height_cm       numeric(5, 1) check (length_or_height_cm is null or (length_or_height_cm > 0 and length_or_height_cm < 230)),
  head_circumference_cm     numeric(4, 1) check (head_circumference_cm is null or (head_circumference_cm > 0 and head_circumference_cm < 70)),
  bmi numeric(5, 2) generated always as (
    case
      when length_or_height_cm is not null and length_or_height_cm > 0 and weight_kg is not null
      then round((weight_kg / ((length_or_height_cm / 100) * (length_or_height_cm / 100)))::numeric, 2)
      else null
    end
  ) stored,
  notes                     text,
  created_at                timestamptz not null default now()
);
create index if not exists child_growth_child_idx on public.child_growth_measurements (child_id, age_months_at_measurement);

-- ----------------------------------------------------------------------------
-- 3) Marcos do desenvolvimento — catálogo (referência, fonte CDC) + instâncias
-- ----------------------------------------------------------------------------
create table if not exists public.child_milestone_catalog (
  code                   text primary key,
  label_pt               text not null,
  category               milestone_category not null,
  typical_age_months_min smallint not null,
  typical_age_months_max smallint not null,
  description_short       text,
  source                 text not null default 'CDC'
);

create table if not exists public.child_milestones (
  id             uuid primary key default gen_random_uuid(),
  child_id       uuid not null references public.children (id) on delete cascade,
  milestone_code text not null references public.child_milestone_catalog (code),
  achieved_at    date,
  notes          text,
  created_at     timestamptz not null default now(),
  unique (child_id, milestone_code)
);
create index if not exists child_milestones_child_idx on public.child_milestones (child_id);

-- ----------------------------------------------------------------------------
-- 4) Calendário vacinal infantil (PNI/MS) — referência
-- ----------------------------------------------------------------------------
create table if not exists public.child_vaccine_schedule (
  code                  text primary key,
  label_pt              text not null,
  dose_label            text not null,
  recommended_age_months smallint not null,
  source                text not null default 'PNI'
);

-- Reaproveita a tabela vaccinations (0001): distingue vacina de adulto x criança.
alter table public.vaccinations
  add column if not exists child_id     uuid references public.children (id) on delete cascade,
  add column if not exists manufacturer text;
create index if not exists vaccinations_child_idx on public.vaccinations (child_id);

-- ----------------------------------------------------------------------------
-- 5) Padrões de crescimento da OMS (LMS) — semeado em 0016 (fonte citada)
-- ----------------------------------------------------------------------------
create table if not exists public.who_growth_standards (
  indicator  text not null,
  sex        child_sex not null,
  x          numeric not null,
  l          numeric not null,
  m          numeric not null,
  s          numeric not null,
  source     text not null default 'WHO',
  primary key (indicator, sex, x)
);

-- ----------------------------------------------------------------------------
-- Seeds de referência (fontes citadas). Curvas da OMS entram na 0016.
-- ----------------------------------------------------------------------------
insert into public.child_milestone_catalog
  (code, label_pt, category, typical_age_months_min, typical_age_months_max, description_short) values
  ('social_smile',     'Sorri para as pessoas',                       'social',    1,  3, 'Sorriso social em resposta a estímulos.'),
  ('coos',             'Faz sons (arrulhos)',                          'language',  1,  4, 'Vocaliza sons de vogais.'),
  ('head_control',     'Sustenta a cabeça',                            'motor',     2,  4, 'Firmeza do pescoço quando apoiado sentado.'),
  ('reaches_objects',  'Tenta alcançar objetos',                       'motor',     3,  5, 'Estende os braços em direção a objetos.'),
  ('rolls_over',       'Rola sozinho',                                 'motor',     4,  6, 'Vira de barriga para cima e vice-versa.'),
  ('babbles',          'Balbucia (ba-ba, da-da)',                      'language',  4,  7, 'Combina sons em sequência.'),
  ('sits_unsupported', 'Senta sem apoio',                              'motor',     6,  9, 'Mantém-se sentado sem ajuda.'),
  ('stranger_anxiety', 'Estranha pessoas desconhecidas',               'social',    6,  9, 'Reage a rostos não familiares.'),
  ('crawls',           'Engatinha',                                    'motor',     7, 10, 'Desloca-se de quatro.'),
  ('pincer_grasp',     'Pega objetos com pinça (polegar e indicador)', 'motor',     8, 12, 'Preensão fina de pequenos objetos.'),
  ('first_words',      'Fala as primeiras palavras com sentido',       'language', 10, 15, 'Ex.: "mamãe", "papá", com intenção.'),
  ('stands_alone',     'Fica em pé sozinho',                           'motor',    10, 14, 'Equilíbrio em pé sem apoio.'),
  ('walks',            'Anda sozinho',                                 'motor',    11, 16, 'Primeiros passos independentes.'),
  ('points',           'Aponta para mostrar interesse',                'social',   12, 18, 'Aponta para objetos/pessoas.'),
  ('follows_command',  'Entende ordens simples',                       'cognitive',12, 18, 'Ex.: "me dá", "vem cá".'),
  ('two_words',        'Junta duas palavras',                          'language', 18, 24, 'Ex.: "quer água".'),
  ('runs',             'Corre',                                        'motor',    18, 24, 'Corre com estabilidade crescente.'),
  ('symbolic_play',    'Brinca de faz de conta',                       'cognitive',24, 36, 'Imita situações do cotidiano.'),
  ('names_objects',    'Nomeia objetos e figuras',                     'language', 24, 36, 'Identifica e nomeia itens comuns.')
on conflict (code) do nothing;

insert into public.child_vaccine_schedule
  (code, label_pt, dose_label, recommended_age_months) values
  ('bcg',            'BCG',                              'Dose única',  0),
  ('hepb_birth',     'Hepatite B',                       'Ao nascer',   0),
  ('penta_1',        'Pentavalente (DTP+Hib+HepB)',      '1ª dose',     2),
  ('vip_1',          'Poliomielite (VIP)',               '1ª dose',     2),
  ('pneumo10_1',     'Pneumocócica 10-valente',          '1ª dose',     2),
  ('rota_1',         'Rotavírus humano',                 '1ª dose',     2),
  ('penta_2',        'Pentavalente (DTP+Hib+HepB)',      '2ª dose',     4),
  ('vip_2',          'Poliomielite (VIP)',               '2ª dose',     4),
  ('pneumo10_2',     'Pneumocócica 10-valente',          '2ª dose',     4),
  ('rota_2',         'Rotavírus humano',                 '2ª dose',     4),
  ('penta_3',        'Pentavalente (DTP+Hib+HepB)',      '3ª dose',     6),
  ('vip_3',          'Poliomielite (VIP)',               '3ª dose',     6),
  ('meningoc_1',     'Meningocócica C (conjugada)',      '1ª dose',     3),
  ('meningoc_2',     'Meningocócica C (conjugada)',      '2ª dose',     5),
  ('febre_amarela',  'Febre amarela',                    '1ª dose',     9),
  ('pneumo10_ref',   'Pneumocócica 10-valente',          'Reforço',    12),
  ('meningoc_ref',   'Meningocócica C (conjugada)',      'Reforço',    12),
  ('triplice_viral_1','Tríplice viral (SCR)',            '1ª dose',    12),
  ('hepa',           'Hepatite A',                       'Dose única', 15),
  ('penta_ref1',     'DTP (tríplice bacteriana)',        '1º reforço', 15),
  ('vop_ref1',       'Poliomielite (VOP)',               '1º reforço', 15),
  ('tetraviral',     'Tetraviral (SCR + varicela)',      'Dose única', 15),
  ('dtp_ref2',       'DTP (tríplice bacteriana)',        '2º reforço', 48),
  ('vop_ref2',       'Poliomielite (VOP)',               '2º reforço', 48),
  ('varicela_2',     'Varicela',                         '2ª dose',    48),
  ('febre_amarela_ref','Febre amarela',                  'Reforço',    48)
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- Helper de acesso + auditoria
-- ----------------------------------------------------------------------------
create or replace function public.can_access_child(p_child uuid)
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
      and (
        c.parent_profile_id = (select auth.uid())
        or exists (
          select 1 from public.care_relationships cr
          where cr.patient_id = c.parent_profile_id
            and cr.caregiver_id = (select auth.uid())
            and cr.status = 'accepted'
            and coalesce((cr.permissions ->> 'children')::boolean, false) = true
        )
      )
  );
$$;

create or replace function public.log_child_access(p_child uuid, p_action audit_action)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent uuid;
begin
  if not public.can_access_child(p_child) then
    raise exception 'Sem permissão para acessar esta criança.' using errcode = 'insufficient_privilege';
  end if;
  select parent_profile_id into v_parent from public.children where id = p_child;
  insert into public.audit_log (actor_id, patient_id, action, resource_type, resource_id)
  values ((select auth.uid()), v_parent, p_action, 'child', p_child);
end;
$$;

create or replace function public.audit_child_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child  uuid := coalesce(new.child_id, old.child_id);
  v_parent uuid;
  v_action audit_action := case tg_op
    when 'INSERT' then 'create'
    when 'UPDATE' then 'update'
    when 'DELETE' then 'delete'
  end::audit_action;
begin
  select parent_profile_id into v_parent from public.children where id = v_child;
  if v_parent is not null then
    insert into public.audit_log (actor_id, patient_id, action, resource_type, resource_id)
    values ((select auth.uid()), v_parent, v_action, tg_table_name, v_child);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_growth_mut on public.child_growth_measurements;
create trigger audit_growth_mut
  after insert or update or delete on public.child_growth_measurements
  for each row execute function public.audit_child_mutation();
drop trigger if exists audit_child_milestones_mut on public.child_milestones;
create trigger audit_child_milestones_mut
  after insert or update or delete on public.child_milestones
  for each row execute function public.audit_child_mutation();

-- ----------------------------------------------------------------------------
-- RLS (policies recriadas para idempotência)
-- ----------------------------------------------------------------------------
alter table public.children                  enable row level security;
alter table public.child_growth_measurements enable row level security;
alter table public.child_milestones          enable row level security;
alter table public.child_milestone_catalog   enable row level security;
alter table public.child_vaccine_schedule    enable row level security;
alter table public.who_growth_standards      enable row level security;

drop policy if exists "children_access" on public.children;
create policy "children_access" on public.children
  for all to authenticated
  using (
    parent_profile_id = (select auth.uid())
    or exists (
      select 1 from public.care_relationships cr
      where cr.patient_id = parent_profile_id
        and cr.caregiver_id = (select auth.uid())
        and cr.status = 'accepted'
        and coalesce((cr.permissions ->> 'children')::boolean, false) = true
    )
  )
  with check (parent_profile_id = (select auth.uid()));

drop policy if exists "child_growth_access" on public.child_growth_measurements;
create policy "child_growth_access" on public.child_growth_measurements
  for all to authenticated
  using (public.can_access_child(child_id))
  with check (public.can_access_child(child_id));

drop policy if exists "child_milestones_access" on public.child_milestones;
create policy "child_milestones_access" on public.child_milestones
  for all to authenticated
  using (public.can_access_child(child_id))
  with check (public.can_access_child(child_id));

drop policy if exists "child_milestone_catalog_read" on public.child_milestone_catalog;
create policy "child_milestone_catalog_read" on public.child_milestone_catalog
  for select to authenticated using (true);
drop policy if exists "child_vaccine_schedule_read" on public.child_vaccine_schedule;
create policy "child_vaccine_schedule_read" on public.child_vaccine_schedule
  for select to authenticated using (true);
drop policy if exists "who_growth_read" on public.who_growth_standards;
create policy "who_growth_read" on public.who_growth_standards
  for select to authenticated using (true);

drop policy if exists "vaccinations_child_access" on public.vaccinations;
create policy "vaccinations_child_access" on public.vaccinations
  for all to authenticated
  using (child_id is not null and public.can_access_child(child_id))
  with check (child_id is not null and public.can_access_child(child_id));
