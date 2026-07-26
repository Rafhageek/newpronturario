-- ============================================================================
-- VidaLog — Migration 0018 — Controle de Estoque de Medicação
--
-- Estoque é FUNCIONALIDADE BÁSICA (não paywall): crônico contar comprimidos é
-- necessidade. Adiciona COLUNAS à tabela medications existente (não duplica) e
-- decrementa o estoque automaticamente quando uma tomada é registrada
-- (medication_intakes.status = 'taken'), sem nunca negativar.
--
-- IDEMPOTENTE. O agendamento pg_cron degrada com elegância se indisponível.
-- NÃO rodar em produção sem dev primeiro.
-- ============================================================================

alter table public.medications
  add column if not exists stock_count               integer,
  add column if not exists stock_unit                text not null default 'comprimidos',
  add column if not exists stock_low_threshold_days  integer not null default 5,
  add column if not exists stock_last_updated_at      timestamptz,
  add column if not exists package_size              integer,
  add column if not exists last_stock_alert_at        timestamptz;

-- ----------------------------------------------------------------------------
-- Doses por dia a partir de frequency + times (qtd de horários).
-- 'as_needed' → null (não dá para prever). 'weekly' → doses/7.
-- ----------------------------------------------------------------------------
create or replace function public.medication_daily_doses(p_med uuid)
returns numeric
language sql
stable
as $$
  select case m.frequency
    when 'as_needed' then null
    when 'weekly' then greatest(1, coalesce(array_length(m.times, 1), 1)) / 7.0
    else greatest(1, coalesce(array_length(m.times, 1), 1))::numeric
  end
  from public.medications m
  where m.id = p_med;
$$;

-- Dias restantes de estoque (null se não rastreado ou sem previsão possível).
create or replace function public.medication_days_remaining(p_med uuid)
returns integer
language plpgsql
stable
as $$
declare
  v_stock integer;
  v_daily numeric;
begin
  select stock_count into v_stock from public.medications where id = p_med;
  if v_stock is null then return null; end if;
  v_daily := public.medication_daily_doses(p_med);
  if v_daily is null or v_daily <= 0 then return null; end if;
  return floor(v_stock / v_daily)::integer;
end;
$$;

-- ----------------------------------------------------------------------------
-- Trigger: ajusta o estoque conforme as tomadas cruzam o status 'taken'.
-- INSERT taken → -1 · DELETE taken → +1 · UPDATE (entra/sai de taken) → ±1.
-- Só mexe se o medicamento tem stock_count não nulo. Nunca negativa.
-- ----------------------------------------------------------------------------
create or replace function public.adjust_medication_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_med   uuid := coalesce(new.medication_id, old.medication_id);
  v_delta integer := 0;
begin
  if tg_op = 'INSERT' then
    if new.status = 'taken' then v_delta := -1; end if;
  elsif tg_op = 'DELETE' then
    if old.status = 'taken' then v_delta := 1; end if;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from 'taken' and new.status = 'taken' then v_delta := -1;
    elsif old.status = 'taken' and new.status is distinct from 'taken' then v_delta := 1;
    end if;
  end if;

  if v_delta <> 0 then
    update public.medications
    set stock_count = greatest(0, stock_count + v_delta),
        stock_last_updated_at = now()
    where id = v_med and stock_count is not null;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists medication_intakes_adjust_stock on public.medication_intakes;
create trigger medication_intakes_adjust_stock
  after insert or update or delete on public.medication_intakes
  for each row execute function public.adjust_medication_stock();

-- ----------------------------------------------------------------------------
-- Fila de notificações (mínima). A entrega real (push/e-mail/WhatsApp) entra
-- numa fase de infra; por ora a fila alimenta o histórico e o banner in-app.
-- ----------------------------------------------------------------------------
create table if not exists public.notification_queue (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  type          text not null,                 -- 'low_stock'
  title         text not null,
  body          text not null,
  channel       text not null default 'in_app',-- in_app|push|email|whatsapp
  resource_type text,
  resource_id   uuid,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  read_at       timestamptz
);
create index if not exists notification_queue_user_idx on public.notification_queue (user_id, created_at desc);
alter table public.notification_queue enable row level security;
drop policy if exists "notifications_own" on public.notification_queue;
create policy "notifications_own" on public.notification_queue
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- Enfileira alertas de estoque baixo (cron diária). Guarda de 48h por medicação.
-- ----------------------------------------------------------------------------
create or replace function public.enqueue_low_stock_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with due as (
    select m.id, m.patient_id, m.name, public.medication_days_remaining(m.id) as days
    from public.medications m
    where m.active
      and m.stock_count is not null
      and public.medication_days_remaining(m.id) is not null
      and public.medication_days_remaining(m.id) <= m.stock_low_threshold_days
      and (m.last_stock_alert_at is null or m.last_stock_alert_at < now() - interval '48 hours')
  ), ins as (
    insert into public.notification_queue (user_id, type, title, body, resource_type, resource_id)
    select d.patient_id, 'low_stock', 'Estoque acabando',
           d.name || ' deve acabar em ' || d.days || ' dia(s). Considere repor.',
           'medication', d.id
    from due d
    returning 1
  )
  select count(*) into v_count from ins;

  update public.medications m
  set last_stock_alert_at = now()
  where m.active and m.stock_count is not null
    and public.medication_days_remaining(m.id) is not null
    and public.medication_days_remaining(m.id) <= m.stock_low_threshold_days
    and (m.last_stock_alert_at is null or m.last_stock_alert_at < now() - interval '48 hours');

  return v_count;
end;
$$;

-- Agendamento diário às 9h (UTC). Degrada com elegância se pg_cron faltar.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('vidalog-low-stock');
  perform cron.schedule('vidalog-low-stock', '0 9 * * *', 'select public.enqueue_low_stock_alerts();');
exception when others then
  raise notice 'pg_cron indisponível — agendamento ignorado. O banner in-app continua funcionando.';
end $$;
