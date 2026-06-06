-- ============================================================================
-- VidaLog — Migration 0004
-- Exames: Narrativa de Saúde (explicações leigas por métrica)
--
-- Estende exams/exam_metrics (criadas na 0001) e adiciona a tabela pública
-- exam_metric_explanations (conteúdo EDUCATIVO — deve ser revisado por um
-- profissional de saúde antes de uso em produção).
-- ============================================================================

create type exam_category as enum ('lab', 'imaging', 'cardio');

-- ── exams: categoria, médico, laudo textual ─────────────────────────────────
alter table public.exams
  add column if not exists category exam_category not null default 'lab',
  add column if not exists doctor_name text,
  add column if not exists doctor_crm text,
  add column if not exists raw_text text;
comment on column public.exams.doctor_name is 'PHI: care_provider';
comment on column public.exams.raw_text is 'PHI: clinical_report';

-- ── exam_metrics: código (LOINC opcional) ───────────────────────────────────
alter table public.exam_metrics
  add column if not exists metric_code text;
create index if not exists exam_metrics_metric_code_idx on public.exam_metrics (metric_code);

-- ── exam_metric_explanations: dicionário educativo (público p/ leitura) ──────
create table public.exam_metric_explanations (
  id           uuid primary key default gen_random_uuid(),
  metric_key   text not null unique,          -- chave normalizada (ex.: 'hemoglobina')
  metric_name  text not null,                 -- rótulo PT-BR (ex.: 'Hemoglobina')
  category     exam_category not null default 'lab',
  what_measures text not null,                -- o que mede
  why_matters   text not null,                -- por que importa
  low_means     text,                         -- o que significa estar baixo
  high_means    text,                         -- o que significa estar alto
  actions_low   text,                         -- o que conversar com o médico se baixo
  actions_high  text,                         -- o que conversar com o médico se alto
  created_at    timestamptz not null default now()
);
create index exam_metric_explanations_key_idx on public.exam_metric_explanations (metric_key);

-- Conteúdo educativo, não-PHI: legível por qualquer usuário autenticado.
alter table public.exam_metric_explanations enable row level security;
create policy "exam_explanations_read" on public.exam_metric_explanations
  for select to authenticated using (true);

-- ============================================================================
-- O SEED educacional fica na migration seguinte: 0005_exam_explanations_seed.sql
-- ⚠️ Conteúdo educativo. Revisar com profissional de saúde antes de produção.
-- ============================================================================
