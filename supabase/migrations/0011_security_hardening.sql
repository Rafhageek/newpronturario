-- ============================================================================
-- VidaLog — Migration 0011 — Endurecimento de segurança/privacidade
-- (correções da auditoria)
-- ============================================================================

-- ── audit_log imutável a nível de banco (inclusive sob service_role) ────────
create or replace function public.prevent_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Registro imutável (append-only).';
end;
$$;

drop trigger if exists audit_log_no_update on public.audit_log;
drop trigger if exists audit_log_no_delete on public.audit_log;
create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.prevent_mutation();
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.prevent_mutation();

-- ── Anonimato de COMENTÁRIOS: view que oculta o autor quando anônimo ────────
-- (espelha o que feed_posts já faz para posts — fecha o vazamento de author_id)
create view public.feed_comments
with (security_invoker = on) as
select
  c.id,
  c.post_id,
  c.content,
  c.is_anonymous,
  c.created_at,
  case when c.is_anonymous then null else c.author_id end as author_id,
  case when c.is_anonymous then 'Anônimo' else coalesce(sp.display_name, 'Usuário') end as author_display
from public.post_comments c
left join public.social_profiles sp on sp.user_id = c.author_id
where not c.hidden;
