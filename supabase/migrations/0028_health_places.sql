-- ============================================================================
-- VidaLog — Migration 0028 — health_places (diretório de locais de saúde)
--
-- Catálogo curado pelo ADMIN: farmácias, hospitais, laboratórios e clínicas
-- parceiros. Usuário logado LÊ (só ativos); apenas admin (is_admin(), 0022)
-- ESCREVE. O app calcula a distância no cliente a partir de lat/lng. As
-- coordenadas vêm da Edge Function geocode-address (Google Places, no servidor).
--
-- IDEMPOTENTE. Aplicar no SQL Editor do Supabase ou `npx supabase db push`.
-- ============================================================================

create table if not exists public.health_places (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('pharmacy', 'hospital', 'lab', 'clinic')),
  name        text not null,
  address     text,
  city        text,
  state       text,                                   -- UF (2 letras)
  phone       text,
  whatsapp    text,
  hours_text  text,
  is_24h      boolean not null default false,
  lat         double precision,
  lng         double precision,
  link        text,
  notes       text,
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists health_places_type_active_idx on public.health_places (type, active);

alter table public.health_places enable row level security;

-- Leitura: qualquer autenticado vê os ATIVOS; admin vê todos (inclui inativos).
drop policy if exists "health_places_read" on public.health_places;
create policy "health_places_read" on public.health_places
  for select to authenticated
  using (active = true or public.is_admin((select auth.uid())));

-- Escrita (insert/update/delete): só admin.
drop policy if exists "health_places_admin_write" on public.health_places;
create policy "health_places_admin_write" on public.health_places
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- Mantém updated_at em UPDATE.
create or replace function public.tg_health_places_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists health_places_set_updated_at on public.health_places;
create trigger health_places_set_updated_at
  before update on public.health_places
  for each row execute function public.tg_health_places_updated_at();
