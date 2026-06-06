-- ============================================================================
-- VidaLog — Migration 0010
-- Comunidade (grupos por CID-10) + Rede Social, com Realtime.
--
-- Privacidade: posts anônimos NÃO expõem o autor a nenhum cliente (a view
-- feed_posts oculta author_id quando is_anonymous). O author_id segue gravado
-- na tabela base apenas para o dono apagar/moderar (não é exposto via API).
-- ============================================================================

-- ── Grupos de apoio por condição ────────────────────────────────────────────
create table public.community_groups (
  id          uuid primary key default gen_random_uuid(),
  cid10_code  text,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);
alter table public.community_groups enable row level security;
create policy "groups_read" on public.community_groups for select to authenticated using (true);

create table public.group_members (
  group_id   uuid not null references public.community_groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;
create policy "group_members_select" on public.group_members for select to authenticated using (true);
create policy "group_members_modify_own" on public.group_members for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Perfis sociais (opt-in, controla o que expõe) ───────────────────────────
create table public.social_profiles (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  display_name      text,
  bio               text,
  is_public         boolean not null default false,
  show_achievements boolean not null default true,
  verified_crm      boolean not null default false,   -- selo médico (via verify-crm)
  crm               text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.social_profiles enable row level security;
create policy "social_profiles_read" on public.social_profiles for select to authenticated
  using (is_public or user_id = (select auth.uid()));
create policy "social_profiles_modify_own" on public.social_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger social_profiles_set_updated_at
  before update on public.social_profiles for each row execute function public.set_updated_at();

-- ── Posts (comunidade quando group_id; rede social quando group_id is null) ──
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid references public.community_groups (id) on delete cascade,
  author_id      uuid not null references public.profiles (id) on delete cascade,
  is_anonymous   boolean not null default false,
  content        text not null,
  flair          text,
  is_achievement boolean not null default false,
  hidden         boolean not null default false,
  created_at     timestamptz not null default now()
);
create index posts_group_idx on public.posts (group_id, created_at desc);
create index posts_feed_idx on public.posts (created_at desc) where group_id is null;
alter table public.posts enable row level security;
create policy "posts_select" on public.posts for select to authenticated using (not hidden);
create policy "posts_insert_own" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "posts_update_own" on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "posts_delete_own" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

-- ── Reações ─────────────────────────────────────────────────────────────────
create table public.post_reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);
create index post_reactions_post_idx on public.post_reactions (post_id);
alter table public.post_reactions enable row level security;
create policy "reactions_select" on public.post_reactions for select to authenticated using (true);
create policy "reactions_modify_own" on public.post_reactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Comentários ─────────────────────────────────────────────────────────────
create table public.post_comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  is_anonymous boolean not null default false,
  content      text not null,
  hidden       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
create policy "comments_select" on public.post_comments for select to authenticated using (not hidden);
create policy "comments_insert_own" on public.post_comments for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "comments_delete_own" on public.post_comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- ── Enquetes ────────────────────────────────────────────────────────────────
create table public.polls (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null unique references public.posts (id) on delete cascade,
  question text not null,
  options  text[] not null
);
alter table public.polls enable row level security;
create policy "polls_select" on public.polls for select to authenticated using (true);
create policy "polls_insert_author" on public.polls for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

create table public.poll_votes (
  poll_id      uuid not null references public.polls (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  option_index smallint not null,
  created_at   timestamptz not null default now(),
  primary key (poll_id, user_id)
);
alter table public.poll_votes enable row level security;
create policy "poll_votes_select" on public.poll_votes for select to authenticated using (true);
create policy "poll_votes_modify_own" on public.poll_votes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Conexões (seguir) ───────────────────────────────────────────────────────
create table public.user_connections (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);
alter table public.user_connections enable row level security;
create policy "connections_select_involved" on public.user_connections for select to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));
create policy "connections_modify_own" on public.user_connections for all to authenticated
  using (follower_id = (select auth.uid())) with check (follower_id = (select auth.uid()));

-- ── Denúncias (moderação) ───────────────────────────────────────────────────
create table public.user_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  post_id     uuid references public.posts (id) on delete cascade,
  comment_id  uuid references public.post_comments (id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now()
);
alter table public.user_reports enable row level security;
create policy "reports_insert_own" on public.user_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "reports_select_own" on public.user_reports for select to authenticated
  using (reporter_id = (select auth.uid()));

-- ── VIEW feed_posts — oculta o autor em posts anônimos ──────────────────────
create view public.feed_posts
with (security_invoker = on) as
select
  p.id,
  p.group_id,
  p.content,
  p.flair,
  p.is_achievement,
  p.is_anonymous,
  p.created_at,
  case when p.is_anonymous then null else p.author_id end as author_id,
  case when p.is_anonymous then 'Anônimo' else coalesce(sp.display_name, 'Usuário') end as author_display,
  case when p.is_anonymous then false else coalesce(sp.verified_crm, false) end as author_verified
from public.posts p
left join public.social_profiles sp on sp.user_id = p.author_id
where not p.hidden;

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='post_reactions') then
    alter publication supabase_realtime add table public.post_reactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='post_comments') then
    alter publication supabase_realtime add table public.post_comments;
  end if;
end $$;

-- ── Seed de grupos ──────────────────────────────────────────────────────────
insert into public.community_groups (cid10_code, name, description) values
  ('E11', 'Diabetes tipo 2', 'Apoio e troca de experiências sobre o convívio com o diabetes.'),
  ('I10', 'Hipertensão', 'Dicas e acolhimento para quem cuida da pressão arterial.'),
  ('M32', 'Lúpus', 'Comunidade de pessoas que convivem com o lúpus.'),
  ('J45', 'Asma', 'Respirar melhor: experiências e apoio sobre asma.'),
  ('F32', 'Depressão', 'Um espaço seguro de apoio mútuo. Você não está sozinho(a).'),
  ('F41', 'Ansiedade', 'Acolhimento e estratégias para lidar com a ansiedade.'),
  ('E03', 'Hipotireoidismo', 'Troca de experiências sobre a tireoide.'),
  ('E66', 'Obesidade', 'Cuidado e acolhimento, sem julgamentos.'),
  (null, 'Bem-estar geral', 'Conversas gerais sobre saúde, hábitos e qualidade de vida.')
on conflict do nothing;
