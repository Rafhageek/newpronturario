-- ============================================================================
-- VidaLog — Migration 0026 — Vouchers / cortesia do Plus
--
-- Primeira forma REAL de ativar o Plus (Stripe ainda não existe). Admin gera
-- códigos; qualquer usuário resgata uma vez. has_plus_access() passa a existir
-- e considera vouchers ativos. Também destrava o selo "Membro VIP" (0022).
--
-- Usa is_admin() (0022). IDEMPOTENTE.
-- ============================================================================

create table if not exists public.vouchers (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  kind          text not null default 'plus_trial' check (kind in ('plus_trial','plus_full')),
  duration_days integer not null check (duration_days > 0),
  max_uses      integer not null default 1 check (max_uses > 0),
  uses_count    integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null,
  expires_at    timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists vouchers_code_idx on public.vouchers (code);

create table if not exists public.voucher_redemptions (
  id          uuid primary key default gen_random_uuid(),
  voucher_id  uuid not null references public.vouchers (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  expires_at  timestamptz not null,
  unique (voucher_id, user_id)
);
create index if not exists voucher_redemptions_user_idx on public.voucher_redemptions (user_id, expires_at desc);

alter table public.vouchers enable row level security;
alter table public.voucher_redemptions enable row level security;

-- vouchers: só admin lê/gerencia (criação via RPC create_voucher).
drop policy if exists "vouchers_admin_all" on public.vouchers;
create policy "vouchers_admin_all" on public.vouchers
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- redemptions: usuário vê as próprias; admin vê todas. INSERT só via RPC.
drop policy if exists "voucher_redemptions_select_own_or_admin" on public.voucher_redemptions;
create policy "voucher_redemptions_select_own_or_admin" on public.voucher_redemptions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));

-- ────────────────────────────────────────────────────────────────────────────
-- Entitlement: o usuário tem Plus se houver voucher resgatado e não expirado.
-- (Quando o Stripe existir, somar a verificação de subscription aqui.)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.has_plus_access(uid uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.voucher_redemptions r
    where r.user_id = coalesce(uid, (select auth.uid()))
      and r.expires_at > now()
  );
$$;

-- Resgate de voucher: valida tudo e concede Plus + selo VIP. Retorna o vencimento.
create or replace function public.redeem_voucher(p_code text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v record;
  uid uuid := (select auth.uid());
  v_expires timestamptz;
begin
  if uid is null then raise exception 'Não autenticado.' using errcode = 'check_violation'; end if;
  select * into v from public.vouchers where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Código inválido.' using errcode = 'check_violation'; end if;
  if not v.active then raise exception 'Este código não está mais ativo.' using errcode = 'check_violation'; end if;
  if v.expires_at is not null and v.expires_at < now() then
    raise exception 'Este código expirou.' using errcode = 'check_violation';
  end if;
  if v.uses_count >= v.max_uses then
    raise exception 'Este código atingiu o limite de usos.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.voucher_redemptions r where r.voucher_id = v.id and r.user_id = uid) then
    raise exception 'Você já resgatou este código.' using errcode = 'check_violation';
  end if;

  v_expires := now() + make_interval(days => v.duration_days);
  insert into public.voucher_redemptions (voucher_id, user_id, expires_at) values (v.id, uid, v_expires);
  update public.vouchers set uses_count = uses_count + 1 where id = v.id;

  -- destrava o selo "Membro VIP" da comunidade (sem Stripe)
  insert into public.community_members (user_id, member_tier) values (uid, 'vip')
    on conflict (user_id) do update set member_tier = 'vip';

  insert into public.audit_log (actor_id, patient_id, action, resource_type, resource_id, metadata)
    values (uid, uid, 'update', 'voucher_redemption', v.id,
            jsonb_build_object('code', v.code, 'expires_at', v_expires));

  return v_expires;
end; $$;

-- Admin: criar voucher (gera o código).
create or replace function public.create_voucher(
  p_code text, p_kind text, p_duration_days integer, p_max_uses integer,
  p_expires_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid()); vid uuid;
begin
  if not public.is_admin(uid) then
    raise exception 'Apenas administradores.' using errcode = 'check_violation';
  end if;
  if p_kind not in ('plus_trial','plus_full') then raise exception 'Tipo inválido.'; end if;
  if p_duration_days is null or p_duration_days <= 0 then raise exception 'Duração inválida.'; end if;
  insert into public.vouchers (code, kind, duration_days, max_uses, expires_at, created_by)
  values (upper(trim(p_code)), coalesce(p_kind,'plus_trial'), p_duration_days,
          coalesce(p_max_uses, 1), p_expires_at, uid)
  returning id into vid;
  return vid;
end; $$;
