-- ============================================================================
-- VidaLog — Migration 0020 — Mapa corporal de dor (no diário)
--
-- Para dor crônica (fibromialgia, artrite, lombalgia): registrar ONDE dói num
-- mapa do corpo é mais natural que escrever. Histórico visual ajuda o
-- reumatologista/ortopedista/fisioterapeuta. É REGISTRO, nunca diagnóstico.
--
-- Vincula a diary_entries (não duplica). user_id redundante para simplificar a
-- RLS. Acesso: dono (CRUD) + cuidador aceito com permissão 'diary' (somente
-- leitura). IDEMPOTENTE.
-- ============================================================================

create table if not exists public.diary_pain_points (
  id             uuid primary key default gen_random_uuid(),
  diary_entry_id uuid not null references public.diary_entries (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  body_region    text not null,
  side           text check (side is null or side in ('left', 'right', 'center')),
  intensity      smallint not null check (intensity between 0 and 10),
  type           text,  -- 'aguda'|'persistente'|'pulsante'|'queimacao' (livre)
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists pain_points_entry_idx on public.diary_pain_points (diary_entry_id);
create index if not exists pain_points_user_idx on public.diary_pain_points (user_id, created_at desc);

alter table public.diary_pain_points enable row level security;

drop policy if exists "pain_points_own" on public.diary_pain_points;
create policy "pain_points_own" on public.diary_pain_points
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Cuidador aceito com permissão 'diary' pode LER (não escrever).
drop policy if exists "pain_points_caregiver_read" on public.diary_pain_points;
create policy "pain_points_caregiver_read" on public.diary_pain_points
  for select to authenticated
  using (
    exists (
      select 1 from public.care_relationships cr
      where cr.patient_id = user_id
        and cr.caregiver_id = (select auth.uid())
        and cr.status = 'accepted'
        and coalesce((cr.permissions ->> 'diary')::boolean, false) = true
    )
  );
