-- ============================================================================
-- 0045 — Tira TRUNCATE de `anon` e `authenticated` em todo o schema `public`.
--
-- POR QUÊ: TRUNCATE IGNORA RLS. A policy pode estar perfeita e, ainda assim,
-- quem tiver o privilégio de TRUNCATE esvazia a tabela inteira — de todos os
-- pacientes, de uma vez — sem que nenhuma política chegue a ser consultada.
-- Não existe uso legítimo disso para o papel `authenticated`: o app nunca
-- trunca tabela. É privilégio que só pode causar dano.
--
-- DE ONDE VINHA: a linha de base da plataforma Supabase concede ALL nas tabelas
-- de `public` a anon/authenticated, e ALL inclui TRUNCATE. A 0000 replica essa
-- linha de base para o CI enxergar a mesma realidade da produção — ou seja, a
-- folga já existia no banco hospedado, a 0000 só parou de escondê-la. A 0037 já
-- tinha percebido o problema e revogado TRUNCATE de `ai_invocations`; aqui a
-- mesma decisão passa a valer para o schema inteiro.
--
-- `service_role` MANTÉM TRUNCATE de propósito: é a chave de servidor, usada por
-- rotina administrativa e nunca exposta ao cliente.
-- ============================================================================

revoke truncate on all tables in schema public from anon, authenticated;

-- Para as tabelas que ainda não existem: tira TRUNCATE do default herdado da
-- 0000, para que uma migration futura não reintroduza a folga sem querer.
alter default privileges in schema public
  revoke truncate on tables from anon, authenticated;
