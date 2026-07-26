-- ============================================================================
-- VidaLog — Migration 0024 — Moderação e Segurança da Comunidade (Sub-fase 3)
--
-- ESTENDE 0010_social (posts/post_comments/user_reports), 0022_community_roles
-- (community_members, is_staff/is_admin, padrão de escrita SECURITY DEFINER) e
-- 0023_forum_structure (forum_categories, posts.category_id). NÃO recria tabelas.
--
-- Princípios de segurança (idênticos a 0022):
--   • Tabelas de auditoria/moderação NÃO têm policy de INSERT/UPDATE/DELETE para
--     `authenticated`. Toda escrita passa por funções SECURITY DEFINER que se
--     auto-gateiam com is_staff/is_admin e lançam exception se não autorizado.
--   • Suspensão bloqueia POSTAGEM (não a leitura): recriamos as policies de
--     INSERT de posts/post_comments adicionando `not is_suspended(...)`.
--   • Staff enxerga itens ocultos/para-revisão via policy SELECT extra.
--
-- IDEMPOTENTE (reexecutável). NÃO aplicar em produção sem testar em dev.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Colunas novas
-- ────────────────────────────────────────────────────────────────────────────
alter table public.community_members
  add column if not exists suspended_until timestamptz;

alter table public.posts
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text;

alter table public.post_comments
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text;

create index if not exists posts_needs_review_idx
  on public.posts (created_at desc) where needs_review;
create index if not exists post_comments_needs_review_idx
  on public.post_comments (created_at desc) where needs_review;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) moderation_actions — trilha de auditoria (INSERT-only via funções)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.moderation_actions (
  id                uuid primary key default gen_random_uuid(),
  actor_id          uuid not null references public.profiles (id) on delete cascade,
  action            text not null check (action in
                      ('hide','unhide','pin','unpin','lock','unlock','move','strike','suspend')),
  target_post_id    uuid references public.posts (id) on delete set null,
  target_comment_id uuid references public.post_comments (id) on delete set null,
  target_user_id    uuid references public.profiles (id) on delete set null,
  reason            text,
  meta              jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists moderation_actions_created_idx
  on public.moderation_actions (created_at desc);
create index if not exists moderation_actions_target_post_idx
  on public.moderation_actions (target_post_id) where target_post_id is not null;

alter table public.moderation_actions enable row level security;
-- Só staff lê a trilha. SEM INSERT/UPDATE/DELETE para authenticated.
drop policy if exists "moderation_actions_select_staff" on public.moderation_actions;
create policy "moderation_actions_select_staff" on public.moderation_actions
  for select to authenticated
  using (public.is_staff((select auth.uid())));

-- ────────────────────────────────────────────────────────────────────────────
-- 3) user_strikes — advertências (escrita só via mod_add_strike)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_strikes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  reason     text not null,
  issued_by  uuid references public.profiles (id) on delete set null,
  post_id    uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);
create index if not exists user_strikes_user_idx
  on public.user_strikes (user_id, expires_at desc);

alter table public.user_strikes enable row level security;
-- O próprio usuário vê suas advertências; staff vê todas. SEM INSERT/UPDATE/DELETE.
drop policy if exists "user_strikes_select_own_or_staff" on public.user_strikes;
create policy "user_strikes_select_own_or_staff" on public.user_strikes
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff((select auth.uid())));

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Helper de suspensão (SECURITY DEFINER, evita recursão de RLS)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.is_suspended(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_members
    where user_id = uid and suspended_until is not null and suspended_until > now()
  );
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5) Bloqueio de postagem para suspensos (recria as INSERT policies de 0010,
--    preservando author_id = auth.uid() e adicionando not is_suspended).
--    Suspensão é só de POSTAGEM — a leitura segue liberada.
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and not public.is_suspended((select auth.uid()))
  );

drop policy if exists "comments_insert_own" on public.post_comments;
create policy "comments_insert_own" on public.post_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and not public.is_suspended((select auth.uid()))
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 6) Staff enxerga itens ocultos / para-revisão.
--    As policies "posts_select"/"comments_select" (0010) já liberam não-ocultos
--    a todos; estas ADICIONAM acesso do staff aos ocultos (RLS é OR entre policies).
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "posts_select_staff" on public.posts;
create policy "posts_select_staff" on public.posts for select to authenticated
  using (public.is_staff((select auth.uid())));

drop policy if exists "comments_select_staff" on public.post_comments;
create policy "comments_select_staff" on public.post_comments for select to authenticated
  using (public.is_staff((select auth.uid())));

-- ────────────────────────────────────────────────────────────────────────────
-- 7) Funções de moderação (SECURITY DEFINER). Cada uma:
--      • exige staff (raise exception se não for) — spec: staff_role obrigatório;
--      • aplica a mudança;
--      • registra em moderation_actions;
--      • notifica o autor afetado via notification_queue quando faz sentido.
--    NÃO revogamos EXECUTE: são chamadas por RPC pelo painel e se auto-gateiam.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.mod_hide_post(p_post_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if not public.is_staff((select auth.uid())) then
    raise exception 'Apenas a equipe de moderação pode ocultar publicações.'
      using errcode = 'check_violation';
  end if;
  update public.posts set hidden = true, needs_review = false where id = p_post_id
    returning author_id into v_author;
  if not found then raise exception 'Publicação não encontrada.'; end if;

  insert into public.moderation_actions (actor_id, action, target_post_id, target_user_id, reason)
    values ((select auth.uid()), 'hide', p_post_id, v_author, p_reason);

  if v_author is not null then
    insert into public.notification_queue (user_id, type, title, body, resource_type, resource_id)
      values (v_author, 'mod_hidden', 'Sua publicação foi ocultada',
              coalesce(
                'Uma publicação sua foi ocultada pela moderação. Motivo: ' || nullif(p_reason, ''),
                'Uma publicação sua foi ocultada pela moderação por violar as regras da comunidade.'),
              'post', p_post_id);
  end if;
end; $$;

create or replace function public.mod_unhide_post(p_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if not public.is_staff((select auth.uid())) then
    raise exception 'Apenas a equipe de moderação pode reexibir publicações.'
      using errcode = 'check_violation';
  end if;
  update public.posts set hidden = false, needs_review = false, review_reason = null
    where id = p_post_id returning author_id into v_author;
  if not found then raise exception 'Publicação não encontrada.'; end if;

  insert into public.moderation_actions (actor_id, action, target_post_id, target_user_id)
    values ((select auth.uid()), 'unhide', p_post_id, v_author);
end; $$;

create or replace function public.mod_set_pinned(p_post_id uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff((select auth.uid())) then
    raise exception 'Apenas a equipe de moderação pode fixar tópicos.'
      using errcode = 'check_violation';
  end if;
  update public.posts set is_pinned = p_pinned where id = p_post_id;
  if not found then raise exception 'Publicação não encontrada.'; end if;

  insert into public.moderation_actions (actor_id, action, target_post_id)
    values ((select auth.uid()), case when p_pinned then 'pin' else 'unpin' end, p_post_id);
end; $$;

create or replace function public.mod_set_locked(p_post_id uuid, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff((select auth.uid())) then
    raise exception 'Apenas a equipe de moderação pode trancar tópicos.'
      using errcode = 'check_violation';
  end if;
  update public.posts set is_locked = p_locked where id = p_post_id;
  if not found then raise exception 'Publicação não encontrada.'; end if;

  insert into public.moderation_actions (actor_id, action, target_post_id)
    values ((select auth.uid()), case when p_locked then 'lock' else 'unlock' end, p_post_id);
end; $$;

create or replace function public.mod_move_topic(p_post_id uuid, p_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_old uuid;
begin
  if not public.is_staff((select auth.uid())) then
    raise exception 'Apenas a equipe de moderação pode mover tópicos.'
      using errcode = 'check_violation';
  end if;
  select category_id into v_old from public.posts where id = p_post_id;
  if not found then raise exception 'Publicação não encontrada.'; end if;
  update public.posts set category_id = p_category_id where id = p_post_id;

  insert into public.moderation_actions (actor_id, action, target_post_id, meta)
    values ((select auth.uid()), 'move', p_post_id,
            jsonb_build_object('from_category_id', v_old, 'to_category_id', p_category_id));
end; $$;

-- Advertência: registra strike; ao acumular 3 ativos, suspende 7 dias.
create or replace function public.mod_add_strike(
  p_user_id uuid, p_reason text, p_post_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_active integer;
begin
  if not public.is_staff((select auth.uid())) then
    raise exception 'Apenas a equipe de moderação pode aplicar advertências.'
      using errcode = 'check_violation';
  end if;
  if p_user_id is null then raise exception 'Usuário inválido.'; end if;

  insert into public.user_strikes (user_id, reason, issued_by, post_id)
    values (p_user_id, p_reason, (select auth.uid()), p_post_id);

  -- Garante a linha em community_members (idempotente) para a suspensão.
  insert into public.community_members (user_id) values (p_user_id) on conflict do nothing;

  -- Sempre registra e notifica a advertência.
  insert into public.moderation_actions (actor_id, action, target_user_id, target_post_id, reason)
    values ((select auth.uid()), 'strike', p_user_id, p_post_id, p_reason);
  insert into public.notification_queue (user_id, type, title, body, resource_type, resource_id)
    values (p_user_id, 'mod_strike', 'Você recebeu uma advertência',
            coalesce('Advertência da moderação. Motivo: ' || nullif(p_reason, ''),
                     'Você recebeu uma advertência da moderação por violar as regras da comunidade.'),
            'post', p_post_id);

  -- Conta advertências ainda ativas (não expiradas).
  select count(*) into v_active
    from public.user_strikes
    where user_id = p_user_id and expires_at > now();

  if v_active >= 3 then
    update public.community_members
      set suspended_until = now() + interval '7 days'
      where user_id = p_user_id;
    insert into public.moderation_actions (actor_id, action, target_user_id, reason, meta)
      values ((select auth.uid()), 'suspend', p_user_id,
              'Suspensão automática por acúmulo de advertências.',
              jsonb_build_object('active_strikes', v_active, 'days', 7));
    insert into public.notification_queue (user_id, type, title, body)
      values (p_user_id, 'mod_suspended', 'Sua conta foi suspensa do fórum',
              'Você acumulou 3 advertências e está suspenso de publicar por 7 dias. '
              || 'A leitura continua liberada.');
  end if;
end; $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 8) Onboarding: o usuário aceita as regras (grava só na própria linha).
--    community_members não tem UPDATE para authenticated; este RPC SECURITY
--    DEFINER escreve apenas para auth.uid() — sem expor escrita privilegiada.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.accept_community_rules()
returns void language sql security definer set search_path = public as $$
  insert into public.community_members (user_id, community_rules_accepted_at)
  values ((select auth.uid()), now())
  on conflict (user_id) do update set community_rules_accepted_at = now();
$$;
