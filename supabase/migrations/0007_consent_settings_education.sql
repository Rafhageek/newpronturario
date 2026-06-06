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
