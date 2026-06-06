-- ============================================================================
-- VidaLog — Migration 0012 — Fórum (Rede Social)
-- Reusa `posts` como TÓPICOS e `post_comments` como RESPOSTAS (threaded 1 nível).
-- ============================================================================

-- ── posts vira "tópico" ─────────────────────────────────────────────────────
alter table public.posts
  add column if not exists title text,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists is_locked boolean not null default false,
  add column if not exists is_solved boolean not null default false,
  add column if not exists best_comment_id uuid,
  add column if not exists reply_count integer not null default 0,
  add column if not exists last_activity_at timestamptz not null default now();

create index if not exists posts_forum_idx
  on public.posts (group_id, is_pinned desc, last_activity_at desc);

-- ── post_comments vira "resposta" (árvore de 1 nível) ───────────────────────
alter table public.post_comments
  add column if not exists parent_comment_id uuid references public.post_comments (id) on delete cascade;
create index if not exists post_comments_parent_idx on public.post_comments (parent_comment_id);

-- best_comment_id referencia uma resposta (adicionado após as duas tabelas)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_best_comment_fk') then
    alter table public.posts
      add constraint posts_best_comment_fk
      foreign key (best_comment_id) references public.post_comments (id) on delete set null;
  end if;
end $$;

-- ── Seguir tópico ───────────────────────────────────────────────────────────
create table if not exists public.thread_follows (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.thread_follows enable row level security;
create policy "thread_follows_select_own" on public.thread_follows for select to authenticated
  using (user_id = (select auth.uid()));
create policy "thread_follows_modify_own" on public.thread_follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Trigger: mantém reply_count + last_activity_at do tópico ────────────────
create or replace function public.bump_thread_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set reply_count = reply_count + 1, last_activity_at = now() where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set reply_count = greatest(0, reply_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end; $$;

drop trigger if exists comments_bump_activity on public.post_comments;
create trigger comments_bump_activity
  after insert or delete on public.post_comments
  for each row execute function public.bump_thread_activity();

-- ── Atualiza as views para expor os campos do fórum ─────────────────────────
create or replace view public.feed_posts
with (security_invoker = on) as
select
  p.id, p.group_id, p.content, p.flair, p.is_achievement, p.is_anonymous, p.created_at,
  case when p.is_anonymous then null else p.author_id end as author_id,
  case when p.is_anonymous then 'Anônimo' else coalesce(sp.display_name, 'Usuário') end as author_display,
  case when p.is_anonymous then false else coalesce(sp.verified_crm, false) end as author_verified,
  p.title, p.reply_count, p.last_activity_at, p.is_solved, p.is_pinned, p.best_comment_id, p.is_locked
from public.posts p
left join public.social_profiles sp on sp.user_id = p.author_id
where not p.hidden;

create or replace view public.feed_comments
with (security_invoker = on) as
select
  c.id, c.post_id, c.content, c.is_anonymous, c.created_at,
  case when c.is_anonymous then null else c.author_id end as author_id,
  case when c.is_anonymous then 'Anônimo' else coalesce(sp.display_name, 'Usuário') end as author_display,
  c.parent_comment_id, coalesce(sp.verified_crm, false) and not c.is_anonymous as author_verified
from public.post_comments c
left join public.social_profiles sp on sp.user_id = c.author_id
where not c.hidden;
