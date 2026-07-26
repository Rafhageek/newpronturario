-- ============================================================================
-- VidaLog — Migration 0023 — Estrutura de fórum madura
--
-- ESTENDE 0010/0012 (posts=tópicos, post_comments=respostas, thread_follows) e
-- 0022 (badges em community_members, is_admin). NÃO recria tabelas.
--
-- Adiciona: taxonomia de categorias (temas fixos + auto a partir dos grupos CID),
-- tags + busca full-text em português nos posts, "resposta útil" múltipla
-- (useful_marks, +5 reputação) e views de contadores/trending.
-- A inscrição em tópico REUSA thread_follows (0012).
--
-- IDEMPOTENTE.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Categorias de fórum (taxonomia)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.forum_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  icon        text,            -- nome do ícone lucide (UI mapeia)
  sort        integer not null default 100,
  kind        text not null default 'theme' check (kind in ('theme','condition')),
  group_id    uuid references public.community_groups (id) on delete cascade,
  disclaimer  text,            -- override; null = usa o disclaimer padrão da UI
  created_at  timestamptz not null default now()
);
create index if not exists forum_categories_sort_idx on public.forum_categories (sort, name);
create unique index if not exists forum_categories_group_uidx
  on public.forum_categories (group_id) where group_id is not null;

alter table public.forum_categories enable row level security;
drop policy if exists "forum_categories_read" on public.forum_categories;
create policy "forum_categories_read" on public.forum_categories
  for select to authenticated using (true);
-- Escrita só admin (além de service_role).
drop policy if exists "forum_categories_admin_write" on public.forum_categories;
create policy "forum_categories_admin_write" on public.forum_categories
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- Seed das categorias temáticas fixas.
insert into public.forum_categories (slug, name, description, icon, sort, kind) values
  ('diabetes',     'Convivendo com Diabetes',    'Experiências de quem vive com diabetes no dia a dia.',                'Activity',      10, 'theme'),
  ('hipertensao',  'Hipertensão',                'Cuidando da pressão: rotina, hábitos e acolhimento.',                'HeartPulse',    20, 'theme'),
  ('saude-mental', 'Saúde Mental',               'Um espaço seguro de apoio mútuo. Você não está sozinho(a).',         'Brain',         30, 'theme'),
  ('maternidade',  'Maternidade e Gestação',     'Da gravidez aos primeiros anos: trocas entre quem vive isso.',       'Baby',          40, 'theme'),
  ('cuidadores',   'Cuidadores',                 'Para quem cuida de alguém — com carinho e sem se esquecer de si.',   'Users',         50, 'theme'),
  ('medicamentos', 'Medicamentos e Tratamentos', 'Experiências pessoais — NUNCA recomendações de dose ou troca.',      'Pill',          60, 'theme'),
  ('vida-saudavel','Vida Saudável',              'Alimentação, movimento e bem-estar no cotidiano.',                   'Salad',         70, 'theme'),
  ('sobre-vidalog','Dúvidas sobre o VidaLog',    'Ajuda, sugestões e dúvidas sobre o app.',                            'CircleHelp',    80, 'theme')
on conflict (slug) do nothing;

-- Auto-gera categorias "de condição" a partir dos grupos CID já existentes
-- (integra, não duplica). Slug estável baseado no CID quando houver.
insert into public.forum_categories (slug, name, description, icon, sort, kind, group_id)
select
  'cond-' || lower(coalesce(g.cid10_code, left(replace(g.id::text, '-', ''), 8))),
  g.name, g.description, 'Stethoscope', 200, 'condition', g.id
from public.community_groups g
where not exists (
  select 1 from public.forum_categories fc where fc.group_id = g.id
)
on conflict (slug) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) posts: categoria, tags e busca full-text (português)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.posts
  add column if not exists category_id uuid references public.forum_categories (id) on delete set null,
  add column if not exists tags text[] not null default '{}';

create index if not exists posts_category_idx on public.posts (category_id, last_activity_at desc);
create index if not exists posts_tags_idx on public.posts using gin (tags);

-- Coluna gerada (sem trigger): título peso A, corpo peso B.
alter table public.posts
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(content, '')), 'B')
  ) stored;
create index if not exists posts_search_idx on public.posts using gin (search_tsv);

-- Backfill: posts de grupo herdam a categoria de condição do grupo.
update public.posts p
  set category_id = fc.id
from public.forum_categories fc
where fc.group_id = p.group_id and p.group_id is not null and p.category_id is null;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) "Resposta útil" (múltipla) — só o autor do tópico marca; +5 reputação
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.useful_marks (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.posts (id) on delete cascade,
  comment_id uuid not null references public.post_comments (id) on delete cascade,
  marked_by  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id)
);
create index if not exists useful_marks_topic_idx on public.useful_marks (topic_id);

alter table public.useful_marks enable row level security;
drop policy if exists "useful_marks_select" on public.useful_marks;
create policy "useful_marks_select" on public.useful_marks
  for select to authenticated using (true);
-- Só o AUTOR DO TÓPICO pode marcar/desmarcar.
drop policy if exists "useful_marks_insert_topic_author" on public.useful_marks;
create policy "useful_marks_insert_topic_author" on public.useful_marks
  for insert to authenticated
  with check (
    marked_by = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = topic_id and p.author_id = (select auth.uid()))
  );
drop policy if exists "useful_marks_delete_topic_author" on public.useful_marks;
create policy "useful_marks_delete_topic_author" on public.useful_marks
  for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = topic_id and p.author_id = (select auth.uid())));

-- +5 ao autor da resposta marcada + marca o tópico como resolvido.
create or replace function public.rep_on_useful_mark()
returns trigger language plpgsql security definer set search_path = public as $$
declare comment_author uuid;
begin
  select author_id into comment_author from public.post_comments where id = new.comment_id;
  if comment_author is not null then
    perform public.award_reputation(comment_author, 'useful_marked', 5, new.topic_id);
  end if;
  update public.posts set is_solved = true where id = new.topic_id;
  return new;
end; $$;

drop trigger if exists useful_marks_award on public.useful_marks;
create trigger useful_marks_award after insert on public.useful_marks
  for each row execute function public.rep_on_useful_mark();
revoke execute on function public.rep_on_useful_mark() from public, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Views: contadores por categoria e tags em alta (7 dias)
-- ────────────────────────────────────────────────────────────────────────────
create or replace view public.forum_category_stats
with (security_invoker = on) as
select
  fc.id as category_id, fc.slug, fc.name, fc.description, fc.icon, fc.sort,
  fc.kind, fc.group_id,
  count(p.id) filter (where p.id is not null) as topic_count,
  max(p.last_activity_at) as last_activity_at
from public.forum_categories fc
left join public.posts p on p.category_id = fc.id and not p.hidden
group by fc.id;

create or replace view public.forum_trending_tags
with (security_invoker = on) as
select tag, count(*)::int as uses
from public.posts p
cross join lateral unnest(p.tags) as tag
where not p.hidden and p.created_at >= now() - interval '7 days'
group by tag
order by uses desc;

-- feed_posts: acrescenta category_id e tags (reproduz a definição de 0022 +
-- as 2 colunas no fim; create or replace só permite APPEND).
-- drop + create (reaplicável): recria feed_posts com category_id/tags. O cascade
-- remove temporariamente search_forum_topics, recriada logo abaixo.
drop view if exists public.feed_posts cascade;
create view public.feed_posts
with (security_invoker = on) as
select
  p.id, p.group_id, p.content, p.flair, p.is_achievement, p.is_anonymous, p.created_at,
  case when p.is_anonymous then null else p.author_id end as author_id,
  case when p.is_anonymous then 'Anônimo' else coalesce(sp.display_name, 'Usuário') end as author_display,
  case when p.is_anonymous then false else coalesce(cm.professional_badge = 'doctor', false) end as author_verified,
  p.title, p.reply_count, p.last_activity_at, p.is_solved, p.is_pinned, p.best_comment_id, p.is_locked,
  case when p.is_anonymous then null else cm.staff_role end as author_staff_role,
  case when p.is_anonymous then null else cm.professional_badge end as author_professional_badge,
  case when p.is_anonymous then null else cm.professional_registry end as author_professional_registry,
  case when p.is_anonymous then null else coalesce(cm.member_tier, 'member') end as author_member_tier,
  case when p.is_anonymous then null else coalesce(cm.reputation_points, 0) end as author_reputation,
  p.category_id, p.tags
from public.posts p
left join public.social_profiles sp on sp.user_id = p.author_id
left join public.community_members cm on cm.user_id = p.author_id
where not p.hidden;

-- ────────────────────────────────────────────────────────────────────────────
-- 5) Busca full-text (português) — RPC sobre a view feed_posts (respeita RLS).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.search_forum_topics(q text, lim integer default 30)
returns setof public.feed_posts
language sql stable security invoker set search_path = public as $$
  select fp.*
  from public.feed_posts fp
  join public.posts p on p.id = fp.id
  where p.search_tsv @@ websearch_to_tsquery('portuguese', q)
  order by ts_rank(p.search_tsv, websearch_to_tsquery('portuguese', q)) desc
  limit lim;
$$;
