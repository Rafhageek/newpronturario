-- ============================================================================
-- VidaLog — Migration 0019 — Bula oficial Anvisa (link direto)
--
-- Credibilidade: 1 clique para a bula OFICIAL no Bulário Eletrônico da Anvisa.
-- Estratégia v1 = LINK direto (sempre atualizado, zero manutenção). Não copiamos
-- nem resumimos conteúdo da bula. Só guardamos, opcionalmente, o nº de registro
-- para um link mais específico.
--
-- IDEMPOTENTE. NÃO rodar em produção sem dev primeiro.
-- ============================================================================

alter table public.medications
  add column if not exists anvisa_registration    text,
  add column if not exists anvisa_drug_name        text,
  add column if not exists anvisa_last_checked_at  timestamptz;
