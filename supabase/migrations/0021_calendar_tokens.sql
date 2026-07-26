-- ============================================================================
-- VidaLog — Migration 0021 — Sync de consultas com calendário (.ics)
--
-- Cada usuário tem um TOKEN secreto. Um feed .ics público (servido por Edge
-- Function) usa esse token para entregar as consultas ao Google/Apple Calendar.
-- Quem tem a URL vê o calendário — por isso o token é alto em entropia (uuid v4)
-- e pode ser rotacionado. Os EVENTOS contêm só LOGÍSTICA (médico, horário,
-- local) — NUNCA diagnósticos, medicações ou observações clínicas.
--
-- Em vez de service_role, o feed lê via uma RPC `security definer` estreita,
-- que só devolve as colunas logísticas e só quando calendar_enabled = true.
--
-- IDEMPOTENTE. NÃO rodar em produção sem dev primeiro.
-- ============================================================================

alter table public.profiles
  add column if not exists calendar_token            uuid not null default gen_random_uuid(),
  add column if not exists calendar_enabled          boolean not null default false,
  add column if not exists calendar_token_rotated_at timestamptz;

create unique index if not exists profiles_calendar_token_idx on public.profiles (calendar_token);

-- ----------------------------------------------------------------------------
-- Feed do calendário: só logística, só se habilitado. SECURITY DEFINER para o
-- endpoint público resolver o token sem expor a tabela inteira nem usar service_role.
-- ----------------------------------------------------------------------------
create or replace function public.calendar_feed(p_token uuid)
returns table (
  id            uuid,
  doctor_name   text,
  specialty     text,
  scheduled_at  timestamptz,
  kind          appointment_kind,
  location      text,
  meeting_link  text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.doctor_name, a.specialty, a.scheduled_at, a.kind, a.location, a.meeting_link
  from public.profiles p
  join public.appointments a on a.patient_id = p.id
  where p.calendar_token = p_token
    and p.calendar_enabled = true
    and a.status = 'scheduled'
  order by a.scheduled_at asc;
$$;

grant execute on function public.calendar_feed(uuid) to anon, authenticated;
