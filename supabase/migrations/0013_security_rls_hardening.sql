-- ============================================================================
-- VidaLog — Migration 0013 — Endurecimento de segurança (RLS / Realtime)
--
-- Corrige achados da auditoria:
--  1) Elevação de privilégio: cuidador conseguia conceder a si mesmo permissões
--     (UPDATE em care_relationships não restringia a coluna `permissions`).
--  2) Vazamento de anonimato pelo Realtime: a publication entregava `author_id`
--     de posts/comentários anônimos a qualquer cliente assinante.
--  3) Tópico "trancado" (is_locked) ainda aceitava respostas.
--  4) Índices faltando em FKs quentes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Anti-elevação de privilégio em care_relationships
--    Só o PACIENTE (dono) pode alterar `permissions` e os participantes do
--    vínculo. O cuidador continua podendo aceitar (status) e se auto-revogar.
-- ----------------------------------------------------------------------------
create or replace function public.guard_care_permission_change()
returns trigger
language plpgsql
as $$
begin
  if (select auth.uid()) <> old.patient_id then
    if new.permissions is distinct from old.permissions then
      raise exception 'Apenas o paciente pode alterar as permissões do vínculo de cuidado.'
        using errcode = 'check_violation';
    end if;
    if new.patient_id is distinct from old.patient_id
       or new.caregiver_id is distinct from old.caregiver_id then
      raise exception 'Não é permitido alterar os participantes do vínculo.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists care_relationships_guard_permissions on public.care_relationships;
create trigger care_relationships_guard_permissions
  before update on public.care_relationships
  for each row execute function public.guard_care_permission_change();

-- ----------------------------------------------------------------------------
-- 2) Anonimato no Realtime — publicar SEM a coluna author_id
--    (column-list publication, Postgres 15+). A identidade de réplica padrão é
--    a PK `id`, já incluída nas listas. As views security_invoker continuam
--    cuidando do REST; aqui protegemos o stream do Realtime.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'posts') then
    alter publication supabase_realtime drop table public.posts;
  end if;
  alter publication supabase_realtime add table public.posts
    (id, group_id, is_anonymous, content, flair, is_achievement, hidden,
     created_at, title, is_pinned, is_locked, is_solved, best_comment_id,
     reply_count, last_activity_at);

  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'post_comments') then
    alter publication supabase_realtime drop table public.post_comments;
  end if;
  alter publication supabase_realtime add table public.post_comments
    (id, post_id, is_anonymous, content, hidden, created_at, parent_comment_id);
end $$;

-- ----------------------------------------------------------------------------
-- 3) Respostas bloqueadas em tópicos trancados (is_locked)
-- ----------------------------------------------------------------------------
create or replace function public.reject_reply_on_locked_post()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.posts p where p.id = new.post_id and p.is_locked) then
    raise exception 'Este tópico está trancado e não aceita novas respostas.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists post_comments_reject_locked on public.post_comments;
create trigger post_comments_reject_locked
  before insert on public.post_comments
  for each row execute function public.reject_reply_on_locked_post();

-- ----------------------------------------------------------------------------
-- 4) Índices em FKs / colunas de filtro quente
-- ----------------------------------------------------------------------------
create index if not exists posts_author_idx           on public.posts (author_id);
create index if not exists post_comments_author_idx    on public.post_comments (author_id);
create index if not exists post_comments_parent_idx    on public.post_comments (parent_comment_id);
create index if not exists post_reactions_user_idx      on public.post_reactions (user_id);
create index if not exists user_connections_following_idx on public.user_connections (following_id);
