-- ============================================================================
-- VidaLog — Migration 0025 — Hardening de segurança P0 (auditoria externa)
--
-- ESTENDE 0010/0012 (posts), 0001/0010 (social_profiles) e usa is_staff() (0022).
-- Requer 0022 aplicada (community_members + is_staff). NÃO recria nada.
--
-- Corrige:
--  1) Escalada via UPDATE direto de colunas privilegiadas em posts
--     (is_pinned/is_locked/hidden) e social_profiles (verified_crm).
--     A policy posts_update_own (0010) só checa author_id; aqui um trigger
--     BEFORE UPDATE compara OLD vs NEW e rejeita mudanças privilegiadas por
--     quem não é moderador. is_solved/best_comment_id: só o autor do tópico,
--     e o comentário precisa pertencer ao tópico.
--  2) Funções SECURITY DEFINER de SISTEMA/GATILHO sem REVOKE — fecha o
--     execute para public/anon/authenticated (gatilhos disparam mesmo assim;
--     enqueue_low_stock_alerts é cron). Helpers de RLS e RPCs legítimas
--     (accept_caregiver_invite, start_pregnancy, calendar_feed, mod_*, is_*)
--     PERMANECEM executáveis — revogá-las quebraria o app.
--
-- IDEMPOTENTE.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Guard de colunas privilegiadas em POSTS
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.guard_post_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
begin
  -- service_role (sem JWT) ou moderação podem alterar tudo.
  if uid is null or public.is_staff(uid) then
    return new;
  end if;

  -- Colunas de moderação: usuário comum NÃO altera.
  if (new.is_pinned is distinct from old.is_pinned)
     or (new.is_locked is distinct from old.is_locked)
     or (new.hidden is distinct from old.hidden) then
    raise exception 'Apenas a moderação pode fixar, trancar ou ocultar publicações.'
      using errcode = 'check_violation';
  end if;

  -- "Resposta útil" / resolvido: só o AUTOR DO TÓPICO, e a resposta tem de
  -- pertencer a este tópico.
  if (new.is_solved is distinct from old.is_solved)
     or (new.best_comment_id is distinct from old.best_comment_id) then
    if old.author_id <> uid then
      raise exception 'Apenas o autor do tópico pode marcar a resposta útil.'
        using errcode = 'check_violation';
    end if;
    if new.best_comment_id is not null
       and not exists (
         select 1 from public.post_comments c
         where c.id = new.best_comment_id and c.post_id = old.id
       ) then
      raise exception 'A resposta marcada não pertence a este tópico.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists posts_guard_privileged on public.posts;
create trigger posts_guard_privileged
  before update on public.posts
  for each row execute function public.guard_post_privileged_columns();

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Guard de selo médico em SOCIAL_PROFILES (defesa-em-profundidade;
--    o 0022 já revoga a escrita das colunas, isto cobre se o grant faltar).
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.guard_social_profile_privileged()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or public.is_staff(uid) then
    return new;
  end if;
  if (new.verified_crm is distinct from old.verified_crm)
     or (new.crm is distinct from old.crm) then
    raise exception 'O selo profissional não pode ser alterado pelo próprio usuário.'
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

drop trigger if exists social_profiles_guard_privileged on public.social_profiles;
create trigger social_profiles_guard_privileged
  before update on public.social_profiles
  for each row execute function public.guard_social_profile_privileged();

-- ────────────────────────────────────────────────────────────────────────────
-- 3) REVOKE seletivo em funções SECURITY DEFINER de SISTEMA/GATILHO.
--    (Gatilhos disparam sem EXECUTE; revogar impede chamada direta por RPC.)
--    NÃO tocar em helpers de RLS (is_*, can_*, caregiver_has_permission,
--    owns_pregnancy_journey, can_access_child), nem em RPCs legítimas
--    (accept_caregiver_invite, start_pregnancy, calendar_feed, mod_*, set_*,
--    approve_*, accept_community_rules, log_child_access,
--    medication_daily_doses, medication_days_remaining).
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  fn text;
  sysfns text[] := array[
    'public.enqueue_low_stock_alerts()',                 -- cron (exposição real)
    'public.set_updated_at()',                           -- gatilho
    'public.handle_new_user()',                          -- gatilho (auth.users)
    'public.adjust_medication_stock()',                  -- gatilho
    'public.audit_child_mutation()',                     -- gatilho
    'public.pause_cycle_on_pregnancy()',                 -- gatilho
    'public.bump_thread_activity()',                     -- gatilho
    'public.guard_post_privileged_columns()',            -- gatilho (novo)
    'public.guard_social_profile_privileged()'           -- gatilho (novo)
  ];
begin
  foreach fn in array sysfns loop
    begin
      execute format('revoke all on function %s from public, anon, authenticated;', fn);
    exception when undefined_function then
      raise notice 'Função % não encontrada — ignorada.', fn;
    end;
  end loop;
end $$;

-- A cron precisa poder executar o enqueue (roda como service_role/owner).
do $$
begin
  execute 'grant execute on function public.enqueue_low_stock_alerts() to service_role';
exception when undefined_object then null;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Auditoria de processamento por IA (process-exam). RPC SECURITY DEFINER
--    que registra no audit_log o envio de um exame para leitura por IA — assim
--    há trilha do consentimento. Grava apenas para o próprio usuário.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.log_ai_exam_processing(p_exam_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Não autenticado.' using errcode = 'check_violation';
  end if;
  insert into public.audit_log (actor_id, patient_id, action, resource_type, resource_id, metadata)
  select uid, e.patient_id, 'share', 'exam_ai_processing', e.id,
         jsonb_build_object('provider', 'anthropic', 'consent', true)
  from public.exams e
  where e.id = p_exam_id;
end; $$;

-- Evento de segurança da própria conta (ex.: 2FA ativado/removido).
create or replace function public.log_self_security_event(p_resource_type text, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Não autenticado.' using errcode = 'check_violation';
  end if;
  insert into public.audit_log (actor_id, patient_id, action, resource_type, resource_id, metadata)
  values (uid, uid, 'update', coalesce(p_resource_type, 'security'), uid, coalesce(p_metadata, '{}'::jsonb));
end; $$;
