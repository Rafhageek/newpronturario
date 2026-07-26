-- ============================================================================
-- VidaLog — Migration 0022 — Papéis, Badges e Reputação da Comunidade
--
-- ESTENDE 0010_social / 0012_forum / 0013_hardening. NÃO recria tabelas.
--
-- Identidade de fórum:
--   • social_profiles (0010) = o que o USUÁRIO edita (display_name, bio…).
--   • community_members (NOVA) = campos controlados por admin/sistema
--     (staff_role, professional_badge, member_tier, reputation_points).
--     SEM policy de escrita para `authenticated` → escalada de privilégio
--     é IMPOSSÍVEL por construção (só service_role / SECURITY DEFINER escrevem).
--
-- Correção de segurança (achado de auditoria): a policy social_profiles_modify_own
-- era FOR ALL, permitindo a QUALQUER usuário `UPDATE … SET verified_crm = true`
-- e forjar o selo médico. Aqui o selo migra para community_members.professional_badge
-- (admin-only) e revogamos a escrita de verified_crm/crm pelo usuário.
--
-- IDEMPOTENTE (reexecutável).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) community_members — identidade pública controlada por admin/sistema
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.community_members (
  user_id                    uuid primary key references public.profiles (id) on delete cascade,
  staff_role                 text check (staff_role in ('admin','moderator')),
  professional_badge         text check (professional_badge in ('doctor','nurse','nutritionist','psychologist')),
  professional_registry      text,                 -- ex.: "CRM 12345-PE"
  professional_verified_at   timestamptz,
  member_tier                text not null default 'member' check (member_tier in ('member','vip')),
  reputation_points          integer not null default 0,
  community_rules_accepted_at timestamptz,         -- onboarding (sub-fase 3)
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index if not exists community_members_staff_idx on public.community_members (staff_role) where staff_role is not null;
create index if not exists community_members_prof_idx on public.community_members (professional_badge) where professional_badge is not null;

alter table public.community_members enable row level security;
-- Badges são públicos no fórum → SELECT liberado.
drop policy if exists "community_members_select_all" on public.community_members;
create policy "community_members_select_all" on public.community_members
  for select to authenticated using (true);
-- PROPOSITALMENTE não há policy de INSERT/UPDATE/DELETE para authenticated.
-- Toda escrita passa por funções SECURITY DEFINER ou service_role.

drop trigger if exists community_members_set_updated_at on public.community_members;
create trigger community_members_set_updated_at
  before update on public.community_members
  for each row execute function public.set_updated_at();

-- Auto-provisão: todo profile ganha sua linha em community_members.
create or replace function public.provision_community_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.community_members (user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists profiles_provision_community on public.profiles;
create trigger profiles_provision_community
  after insert on public.profiles
  for each row execute function public.provision_community_member();

-- Backfill dos profiles já existentes.
insert into public.community_members (user_id) select id from public.profiles on conflict do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Helpers de papel (SECURITY DEFINER, evita recursão de RLS)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.is_staff(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_members
    where user_id = uid and staff_role in ('admin','moderator')
  );
$$;

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_members
    where user_id = uid and staff_role = 'admin'
  );
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) reputation_events — auditável; pontos NUNCA editados à mão
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.reputation_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  event_type      text not null,    -- topic_created | reply_created | reaction_received | useful_marked | moderation_removed
  points          integer not null,
  related_post_id uuid references public.posts (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists reputation_events_user_idx on public.reputation_events (user_id, created_at desc);
create index if not exists reputation_events_daily_idx on public.reputation_events (user_id, event_type, created_at);

alter table public.reputation_events enable row level security;
drop policy if exists "reputation_events_select_own" on public.reputation_events;
create policy "reputation_events_select_own" on public.reputation_events
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));
-- SEM INSERT/UPDATE/DELETE para authenticated → só via award_reputation().

-- Aplica o evento ao saldo (trigger; soma incremental).
create or replace function public.apply_reputation_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.community_members (user_id) values (new.user_id) on conflict do nothing;
  update public.community_members
    set reputation_points = reputation_points + new.points
    where user_id = new.user_id;
  return new;
end; $$;

drop trigger if exists reputation_events_apply on public.reputation_events;
create trigger reputation_events_apply
  after insert on public.reputation_events
  for each row execute function public.apply_reputation_event();

-- Concede reputação respeitando o cap diário de reações (+10/dia).
create or replace function public.award_reputation(
  p_user_id uuid, p_event_type text, p_points integer, p_related_post_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare today_pts integer;
begin
  if p_user_id is null then return; end if;
  if p_event_type = 'reaction_received' then
    select coalesce(sum(points), 0) into today_pts
      from public.reputation_events
      where user_id = p_user_id and event_type = 'reaction_received'
        and created_at >= date_trunc('day', now());
    if today_pts >= 10 then return; end if;  -- cap diário
  end if;
  insert into public.reputation_events (user_id, event_type, points, related_post_id)
    values (p_user_id, p_event_type, p_points, p_related_post_id);
end; $$;

-- Gatilhos de contribuição: +2 tópico/post, +1 resposta, +1 reação recebida.
create or replace function public.rep_on_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.award_reputation(new.author_id, 'topic_created', 2, new.id);
  return new;
end; $$;
drop trigger if exists posts_award_reputation on public.posts;
create trigger posts_award_reputation after insert on public.posts
  for each row execute function public.rep_on_post();

create or replace function public.rep_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.award_reputation(new.author_id, 'reply_created', 1, new.post_id);
  return new;
end; $$;
drop trigger if exists comments_award_reputation on public.post_comments;
create trigger comments_award_reputation after insert on public.post_comments
  for each row execute function public.rep_on_comment();

create or replace function public.rep_on_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare post_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  if post_author is not null and post_author <> new.user_id then
    perform public.award_reputation(post_author, 'reaction_received', 1, new.post_id);
  end if;
  return new;
end; $$;
drop trigger if exists reactions_award_reputation on public.post_reactions;
create trigger reactions_award_reputation after insert on public.post_reactions
  for each row execute function public.rep_on_reaction();

-- ────────────────────────────────────────────────────────────────────────────
-- 4) professional_verifications — pedido de selo profissional
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.professional_verifications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  type                text not null default 'doctor'
                        check (type in ('doctor','nurse','nutritionist','psychologist')),
  registry_number     text not null,   -- "12345"
  registry_state      text not null,   -- "PE"
  status              text not null default 'pending'
                        check (status in ('pending','approved','rejected','expired')),
  verify_crm_response jsonb,
  document_path       text,            -- bucket privado professional-docs
  reviewed_by         uuid references public.profiles (id),
  reviewed_at         timestamptz,
  expires_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists prof_verif_user_idx on public.professional_verifications (user_id, created_at desc);
create index if not exists prof_verif_status_idx on public.professional_verifications (status);

alter table public.professional_verifications enable row level security;
-- Usuário cria o próprio pedido (sempre 'pending') e lê o próprio status.
drop policy if exists "prof_verif_insert_own" on public.professional_verifications;
create policy "prof_verif_insert_own" on public.professional_verifications
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
drop policy if exists "prof_verif_select_own" on public.professional_verifications;
create policy "prof_verif_select_own" on public.professional_verifications
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));
-- Apenas admin atualiza (aprovar/rejeitar) — além das funções SECURITY DEFINER.
drop policy if exists "prof_verif_admin_update" on public.professional_verifications;
create policy "prof_verif_admin_update" on public.professional_verifications
  for update to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- Aprovação (admin): concede a badge em community_members + notifica.
create or replace function public.approve_professional_verification(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'Apenas administradores podem aprovar verificações.' using errcode = 'check_violation';
  end if;
  select * into v from public.professional_verifications where id = p_id;
  if not found then raise exception 'Verificação não encontrada.'; end if;

  update public.professional_verifications
    set status = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now(),
        expires_at = now() + interval '90 days'
    where id = p_id;

  insert into public.community_members
      (user_id, professional_badge, professional_registry, professional_verified_at)
    values (v.user_id, v.type, 'CRM ' || v.registry_number || '-' || v.registry_state, now())
  on conflict (user_id) do update set
    professional_badge = excluded.professional_badge,
    professional_registry = excluded.professional_registry,
    professional_verified_at = excluded.professional_verified_at;

  insert into public.notification_queue (user_id, type, title, body)
    values (v.user_id, 'professional_verified', 'Selo profissional aprovado',
            'Seu registro foi verificado. Sua badge já aparece nas suas participações no fórum.');
end; $$;

create or replace function public.reject_professional_verification(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'Apenas administradores podem rejeitar verificações.' using errcode = 'check_violation';
  end if;
  select * into v from public.professional_verifications where id = p_id;
  if not found then raise exception 'Verificação não encontrada.'; end if;
  update public.professional_verifications
    set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = p_id;
  insert into public.notification_queue (user_id, type, title, body)
    values (v.user_id, 'professional_rejected', 'Verificação não aprovada',
            coalesce(p_reason, 'Não foi possível confirmar seu registro. Você pode reenviar os dados.'));
end; $$;

-- Revalidação automática (cron 90 dias): expira e remove a badge.
create or replace function public.expire_professional_verifications()
returns void language plpgsql security definer set search_path = public as $$
declare v record;
begin
  for v in
    select * from public.professional_verifications
    where status = 'approved' and expires_at is not null and expires_at < now()
  loop
    update public.professional_verifications set status = 'expired' where id = v.id;
    update public.community_members
      set professional_badge = null, professional_registry = null, professional_verified_at = null
      where user_id = v.user_id;
    insert into public.notification_queue (user_id, type, title, body)
      values (v.user_id, 'professional_expired', 'Selo profissional expirado',
              'A revalidação do seu registro venceu (90 dias). Reenvie seus dados para manter a badge.');
  end loop;
end; $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5) Atribuições manuais admin-only (staff e VIP)
--    VIP: enquanto não há Stripe/subscriptions, é flag manual. Quando a
--    assinatura existir, trocar set_member_tier por sync a partir de subscriptions.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.set_staff_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'Apenas administradores.' using errcode = 'check_violation';
  end if;
  if p_role is not null and p_role not in ('admin','moderator') then
    raise exception 'Papel inválido.';
  end if;
  insert into public.community_members (user_id, staff_role) values (p_user_id, p_role)
  on conflict (user_id) do update set staff_role = excluded.staff_role;
end; $$;

create or replace function public.set_member_tier(p_user_id uuid, p_tier text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'Apenas administradores.' using errcode = 'check_violation';
  end if;
  if p_tier not in ('member','vip') then raise exception 'Tier inválido.'; end if;
  insert into public.community_members (user_id, member_tier) values (p_user_id, p_tier)
  on conflict (user_id) do update set member_tier = excluded.member_tier;
end; $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6) BLINDAGEM: funções internas NÃO podem ser chamadas por RPC.
--    Triggers disparam sem precisar de EXECUTE; revogar bloqueia auto-inflar
--    reputação / auto-expirar selos via /rest/v1/rpc. (as funções com checagem
--    is_admin interna continuam executáveis — elas se auto-protegem.)
-- ────────────────────────────────────────────────────────────────────────────
revoke execute on function public.award_reputation(uuid, text, integer, uuid) from public, authenticated;
revoke execute on function public.apply_reputation_event() from public, authenticated;
revoke execute on function public.provision_community_member() from public, authenticated;
revoke execute on function public.rep_on_post() from public, authenticated;
revoke execute on function public.rep_on_comment() from public, authenticated;
revoke execute on function public.rep_on_reaction() from public, authenticated;
revoke execute on function public.expire_professional_verifications() from public, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 7) CORREÇÃO do furo de selo: tirar verified_crm/crm do alcance do usuário.
--    O selo agora vem de community_members.professional_badge (admin-only).
-- ────────────────────────────────────────────────────────────────────────────
revoke insert, update on public.social_profiles from authenticated;
grant insert (user_id, display_name, bio, is_public, show_achievements) on public.social_profiles to authenticated;
grant update (display_name, bio, is_public, show_achievements) on public.social_profiles to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 8) Views do feed expõem as badges (de community_members), nuladas se anônimo.
--    Mantém o prefixo de colunas de 0012; novas colunas só no fim.
-- ────────────────────────────────────────────────────────────────────────────
-- drop + create (em vez de create or replace) para ser reaplicável mesmo se a
-- view já tiver colunas a mais de uma execução anterior do 0023 (evita 42P16).
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
  case when p.is_anonymous then null else coalesce(cm.reputation_points, 0) end as author_reputation
from public.posts p
left join public.social_profiles sp on sp.user_id = p.author_id
left join public.community_members cm on cm.user_id = p.author_id
where not p.hidden;

drop view if exists public.feed_comments cascade;
create view public.feed_comments
with (security_invoker = on) as
select
  c.id, c.post_id, c.content, c.is_anonymous, c.created_at,
  case when c.is_anonymous then null else c.author_id end as author_id,
  case when c.is_anonymous then 'Anônimo' else coalesce(sp.display_name, 'Usuário') end as author_display,
  c.parent_comment_id,
  case when c.is_anonymous then false else coalesce(cm.professional_badge = 'doctor', false) end as author_verified,
  case when c.is_anonymous then null else cm.staff_role end as author_staff_role,
  case when c.is_anonymous then null else cm.professional_badge end as author_professional_badge,
  case when c.is_anonymous then null else cm.professional_registry end as author_professional_registry,
  case when c.is_anonymous then null else coalesce(cm.member_tier, 'member') end as author_member_tier,
  case when c.is_anonymous then null else coalesce(cm.reputation_points, 0) end as author_reputation
from public.post_comments c
left join public.social_profiles sp on sp.user_id = c.author_id
left join public.community_members cm on cm.user_id = c.author_id
where not c.hidden;

-- ────────────────────────────────────────────────────────────────────────────
-- 9) Bucket privado para documentos de verificação profissional
-- ────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('professional-docs', 'professional-docs', false, 10485760,
        array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

drop policy if exists "profdocs_select_owner_or_admin" on storage.objects;
create policy "profdocs_select_owner_or_admin" on storage.objects for select to authenticated
  using (bucket_id = 'professional-docs'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or public.is_admin((select auth.uid()))));
drop policy if exists "profdocs_insert_owner" on storage.objects;
create policy "profdocs_insert_owner" on storage.objects for insert to authenticated
  with check (bucket_id = 'professional-docs'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ────────────────────────────────────────────────────────────────────────────
-- 10) Cron de revalidação (90 dias). Degrada com elegância sem pg_cron.
-- ────────────────────────────────────────────────────────────────────────────
do $$
begin
  create extension if not exists pg_cron;
  begin
    perform cron.unschedule('vidalog-prof-revalidation');
  exception when others then null;
  end;
  perform cron.schedule('vidalog-prof-revalidation', '0 3 * * *',
                        'select public.expire_professional_verifications();');
exception when others then
  raise notice 'pg_cron indisponível — revalidação de CRM precisará de disparo manual.';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- BOOTSTRAP DO 1º ADMIN (rodar manualmente no SQL Editor, como dono do projeto):
--   update public.community_members set staff_role = 'admin'
--     where user_id = '<seu-uuid-de-auth>';
-- A partir daí, novos staff/VIP saem por set_staff_role()/set_member_tier().
-- ════════════════════════════════════════════════════════════════════════════
