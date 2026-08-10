-- ============================================================================
-- 0048 — Anexo de laudo (PDF) na cirurgia
-- Pedido do cliente (print de 2026-08-09): anexar relatório em PDF ao lado
-- de cada cirurgia registrada no Perfil.
--
-- O arquivo vive no bucket privado 'exams', sob "<auth.uid()>/cirurgias/…".
-- As políticas de storage da 0001 (dono = primeira pasta do caminho) já cobrem
-- esse prefixo — nenhuma política nova é necessária. O bucket já restringe
-- MIME (inclui application/pdf) e tamanho na plataforma; o limite de 10 MB
-- por arquivo é validado no app (mesma régua do upload de exames).
--
-- RLS da tabela surgeries (0002) permanece: dono CRUD, cuidador aceito SELECT.
-- Idempotente.
-- ============================================================================

alter table public.surgeries
  add column if not exists report_path text;

comment on column public.surgeries.report_path is
  'PHI: caminho do laudo em PDF no bucket privado exams (prefixo <dono>/cirurgias/). Null = sem anexo.';
