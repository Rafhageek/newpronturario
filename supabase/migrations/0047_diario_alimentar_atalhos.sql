-- ============================================================================
-- HubPatients — Migration 0047 — Diário alimentar: origem do dado e atalhos
--
-- O QUE FAZ
--   1. `food_entries` passa a guardar FIBRA e a ORIGEM de cada valor.
--   2. `food_library` — os alimentos que a pessoa marcou como favoritos e os
--      que ela mesma cadastrou ("Meus alimentos"). Uma tabela só, porque as
--      duas abas da busca rápida são a mesma coisa com um sinalizador
--      diferente.
--   3. `saved_meals` + `saved_meal_items` — combinações que se repetem ("meu
--      café da manhã"), para registrar em um toque.
--
-- POR QUE A COLUNA `source` É A PARTE SÉRIA DESTA MIGRAÇÃO
--   Hoje a tela escreve "Valores da Tabela TACO" embaixo de TODO item — mas o
--   app já registra itens vindos da Open Food Facts (base colaborativa, que
--   erra) e itens digitados à mão pela pessoa lendo o rótulo. Ou seja: o
--   prontuário estava assinando uma fonte que não conferiu, em um documento
--   que a pessoa leva ao médico.
--
--   `source` é NULL nas linhas antigas de propósito. NULL aqui significa "não
--   dá para saber", e a tela mostra exatamente isso ("Origem não registrada").
--   Preencher as linhas antigas com 'taco' seria inventar procedência — o
--   mesmo defeito, só que agora gravado no banco e impossível de desfazer.
--
--   `source_ref` guarda o rastro: o id do alimento na TACO ou o código de
--   barras (EAN) consultado. É o que permite conferir de onde o número saiu.
--
-- SOBRE FIBRA
--   A TACO já traz fibra em todos os 597 alimentos e o app simplesmente jogava
--   fora. Fibra é dado clinicamente útil (constipação, diabetes, doença
--   diverticular) e é o que menos se consegue estimar de cabeça.
--
-- O QUE ESTAS TABELAS **NÃO** FAZEM
--   Nenhuma delas prescreve, pontua ou classifica alimento. Não há campo de
--   "permitido/proibido", "saudável", nota, categoria de dieta nem meta por
--   alimento. O diário registra o que a pessoa comeu; quem interpreta é a
--   equipe de saúde.
--
-- ACESSO
--   Tudo dono-apenas (owner-only), igual ao `food_entries` da 0031.
-- ============================================================================

-- 1) Fibra e procedência no item do diário ------------------------------------
alter table public.food_entries
  add column if not exists fiber_g   numeric(6,1) not null default 0,
  add column if not exists source    text,
  add column if not exists source_ref text;

alter table public.food_entries drop constraint if exists food_entries_source_check;
alter table public.food_entries add constraint food_entries_source_check
  check (source is null or source in ('taco', 'openfoodfacts', 'manual'));

comment on column public.food_entries.source is
  'De onde veio a composição: taco | openfoodfacts | manual. NULL = registro '
  'anterior a esta coluna; a tela mostra "origem não registrada" e NÃO chuta TACO.';
comment on column public.food_entries.source_ref is
  'Rastro da origem: id do alimento na TACO ou o EAN consultado na Open Food Facts.';

-- 2) Biblioteca pessoal: favoritos e alimentos próprios ------------------------
create table if not exists public.food_library (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  food_name   text not null check (length(btrim(food_name)) between 1 and 120),
  /* Composição SEMPRE por 100 g, como na TACO e como nos rótulos brasileiros. */
  kcal        numeric(7,1) not null default 0 check (kcal >= 0),
  protein_g   numeric(6,1) not null default 0 check (protein_g >= 0),
  carbs_g     numeric(6,1) not null default 0 check (carbs_g >= 0),
  fat_g       numeric(6,1) not null default 0 check (fat_g >= 0),
  fiber_g     numeric(6,1) not null default 0 check (fiber_g >= 0),
  /* Porção que a pessoa costuma comer — o atalho que evita digitar gramas. */
  default_grams numeric(7,1) check (default_grams is null or default_grams > 0),
  source      text not null check (source in ('taco', 'openfoodfacts', 'manual')),
  source_ref  text,
  /* Favorito (estrela) e/ou cadastrado pela pessoa. Um item pode ser os dois. */
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

/* Mesmo alimento não entra duas vezes na biblioteca da mesma pessoa. */
create unique index if not exists food_library_user_name_idx
  on public.food_library (user_id, lower(btrim(food_name)));

alter table public.food_library enable row level security;
drop policy if exists "food_library_own" on public.food_library;
create policy "food_library_own" on public.food_library
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3) Refeições salvas ----------------------------------------------------------
create table if not exists public.saved_meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 80),
  /* Refeição sugerida ao aplicar; a pessoa pode mudar na hora. */
  meal_type  text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  created_at timestamptz not null default now()
);

create unique index if not exists saved_meals_user_name_idx
  on public.saved_meals (user_id, lower(btrim(name)));

alter table public.saved_meals enable row level security;
drop policy if exists "saved_meals_own" on public.saved_meals;
create policy "saved_meals_own" on public.saved_meals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.saved_meal_items (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid not null references public.saved_meals (id) on delete cascade,
  food_name  text not null,
  /* Aqui os valores são da PORÇÃO (já multiplicados), não por 100 g: uma
     refeição salva é uma fotografia de um prato real que a pessoa já montou. */
  grams      numeric(7,1) not null check (grams > 0),
  kcal       numeric(7,1) not null default 0,
  protein_g  numeric(6,1) not null default 0,
  carbs_g    numeric(6,1) not null default 0,
  fat_g      numeric(6,1) not null default 0,
  fiber_g    numeric(6,1) not null default 0,
  source     text check (source is null or source in ('taco', 'openfoodfacts', 'manual')),
  source_ref text,
  position   integer not null default 0
);

create index if not exists saved_meal_items_meal_idx
  on public.saved_meal_items (meal_id, position);

alter table public.saved_meal_items enable row level security;
drop policy if exists "saved_meal_items_own" on public.saved_meal_items;
/* O dono do item é o dono da refeição — a checagem passa pela tabela-pai. */
create policy "saved_meal_items_own" on public.saved_meal_items
  for all to authenticated
  using (
    exists (
      select 1 from public.saved_meals m
      where m.id = saved_meal_items.meal_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.saved_meals m
      where m.id = saved_meal_items.meal_id and m.user_id = (select auth.uid())
    )
  );

-- 4) Índice para a navegação por dia e para a visão da semana -------------------
/* A tela agora abre em qualquer data e conta os dias da semana com registro;
   o índice da 0031 (user_id, logged_at desc) já serve às duas consultas. */
