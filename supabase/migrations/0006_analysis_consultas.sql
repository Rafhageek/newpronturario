-- ============================================================================
-- VidaLog — Migration 0006
-- Análise (altura p/ IMC) + Consultas (CRM, link, lembretes, anexo)
-- ============================================================================

-- ── profiles: altura (para cálculo de IMC) ──────────────────────────────────
alter table public.profiles
  add column if not exists height_cm numeric(5, 1);

-- ── appointments: CRM, link de teleconsulta, lembretes, anexo de exame ──────
alter table public.appointments
  add column if not exists doctor_crm text,
  add column if not exists meeting_link text,
  -- minutos antes da consulta para lembrar (gancho p/ notificações — Fase 4)
  add column if not exists reminders smallint[] not null default '{1440,60}',
  add column if not exists exam_id uuid references public.exams (id) on delete set null;
comment on column public.appointments.doctor_crm is 'PHI: care_provider';

create index if not exists appointments_exam_idx on public.appointments (exam_id);
