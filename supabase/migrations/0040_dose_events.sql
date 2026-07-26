-- ============================================================================
-- 0040 — Eventos de dose (adesão terapêutica + ações na notificação).
-- Guarda a RESPOSTA da pessoa ao lembrete: "Tomei", "Adiar 15 min" ou "Pulei",
-- vinda da própria notificação (source='notification') ou de dentro do app
-- (source='app'). É AUTORRELATO: confirma que a pessoa marcou, não que ingeriu.
-- NUNCA prescreve nem muda horário sozinho — só registra o que foi informado.
-- Owner-only (user_id = auth.uid()). Aditiva e idempotente.
-- ============================================================================

create table if not exists public.dose_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete cascade,
  schedule_id   uuid references public.medication_schedules (id) on delete set null,
  scheduled_for timestamptz not null,
  status        text not null check (status in ('taken','snoozed','skipped')),
  source        text not null default 'app' check (source in ('notification','app')),
  created_at    timestamptz not null default now()
);
comment on table public.dose_events is
  'Autorrelato de resposta ao lembrete de dose. Não é prova de ingestão.';

create index if not exists dose_events_user_idx
  on public.dose_events (user_id, scheduled_for desc);

-- Chave idempotente: uma linha por (pessoa, remédio, horário previsto). A fila
-- offline do app pode reenviar o mesmo evento quando a rede volta — o upsert
-- com on_conflict nesta chave ATUALIZA o status em vez de duplicar a dose.
create unique index if not exists dose_events_idempotent_idx
  on public.dose_events (user_id, medication_id, scheduled_for);

-- RLS owner-only ------------------------------------------------------------
alter table public.dose_events enable row level security;

drop policy if exists "dose_events_own" on public.dose_events;
create policy "dose_events_own" on public.dose_events
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
