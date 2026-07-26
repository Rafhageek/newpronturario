-- ============================================================================
-- HubPatients — Migration 0038 — Hardening de segurança (P3)
--
-- Migração ADITIVA e IDEMPOTENTE: não cria, não remove e não altera nenhum
-- dado; só ajusta atributos de objetos que JÁ existem. Reaplicar é inofensivo.
--
-- Corrige as duas armadilhas clássicas de Postgres/Supabase que o Security
-- Advisor aponta e que, num app de saúde, viram vazamento de prontuário:
--
--   1) FUNÇÃO SEM `search_path` FIXO (`function_search_path_mutable`).
--      Sem `search_path` fixo, a função resolve nomes usando o caminho de quem
--      a chama. Um schema controlado pelo atacante à frente de `public` faz a
--      função executar o objeto DELE (ex.: uma tabela `posts` falsa, um
--      operador `=` que devolve sempre verdadeiro). Em função SECURITY DEFINER
--      isso é escalada direta de privilégio; em SECURITY INVOKER usada por
--      gatilho ou por política de RLS, é desvio de regra de negócio.
--
--      AUDITORIA DAS 0001–0037 (estado final de cada função de `public`):
--        · 60 funções SECURITY DEFINER — TODAS já declaram
--          `set search_path = public` na própria definição. Nada a corrigir.
--        · 5 funções SECURITY INVOKER seguiam sem `search_path`. São as
--          corrigidas abaixo, uma a uma, nominalmente.
--      Nenhum comando é gerado por varredura dinâmica do catálogo: cada função
--      foi lida nas migrações antes de entrar nesta lista.
--
--   2) VIEW SEM `security_invoker` (`security_definer_view`).
--      Por padrão, uma view roda com os privilégios de QUEM A CRIOU (postgres),
--      então a RLS das tabelas de base é avaliada como o dono — a view vira um
--      buraco por onde qualquer `authenticated` lê linha de terceiro. Com
--      `security_invoker = true`, a RLS é avaliada como o usuário que consulta.
--      As 4 views de `public` já foram criadas com `security_invoker = on`; o
--      `ALTER VIEW` abaixo é uma REAFIRMAÇÃO defensiva, porque o atributo pode
--      se perder se alguém recriar a view pelo SQL Editor do Supabase sem a
--      cláusula `WITH (...)` — o vetor de drift mais comum em produção.
--
-- A prova automatizada dos dois pontos está em
-- `supabase/tests/rls_isolation_test.sql` (roda no CI, job `security-rls`).
-- ============================================================================

-- ── 1) `search_path` fixo nas funções que ainda não tinham ──────────────────
-- Todas são SECURITY INVOKER e usam apenas objetos de `public` + built-ins de
-- `pg_catalog` (sempre implícito), então fixar em `public` não muda o
-- comportamento — só remove a dependência do caminho de quem chama.

-- `ALTER FUNCTION` não aceita `IF EXISTS`, e nem toda função declarada nas
-- migrações existe em todos os ambientes (o banco de produção foi construído
-- fora do controle da CLI). O laço abaixo fixa `search_path` apenas no que
-- realmente existe, tornando a migração idempotente e segura em qualquer base.
--   set_updated_at              — gatilho de updated_at (0001), quase toda tabela
--   reject_reply_on_locked_post — barra resposta em tópico trancado (0013)
--   medication_daily_doses      — doses/dia, alimenta alerta de estoque (0018)
--   medication_days_remaining   — dias restantes de estoque (0018)
--   tg_health_places_updated_at — gatilho de updated_at de health_places (0028)
do $$
declare
  alvo text;
begin
  foreach alvo in array array[
    'public.set_updated_at()',
    'public.reject_reply_on_locked_post()',
    'public.medication_daily_doses(uuid)',
    'public.medication_days_remaining(uuid)',
    'public.tg_health_places_updated_at()'
  ] loop
    if to_regprocedure(alvo) is not null then
      execute format('alter function %s set search_path = public', alvo);
    else
      raise notice 'search_path: função % não existe neste banco — ignorada.', alvo;
    end if;
  end loop;
end
$$;

-- ── 2) `security_invoker` reafirmado nas views de `public` ──────────────────
-- `IF EXISTS` mantém a migração idempotente mesmo se alguma view tiver sido
-- removida fora do controle das migrações.

-- Feed da comunidade sobre `posts` + `social_profiles` + `community_members`.
-- Migrations 0010 → 0012 → 0022 → 0023.
alter view if exists public.feed_posts
  set (security_invoker = true);

-- Comentários do feed sobre `post_comments`. Migrations 0011 → 0012 → 0022.
alter view if exists public.feed_comments
  set (security_invoker = true);

-- Contadores por categoria do fórum. Migration 0023.
alter view if exists public.forum_category_stats
  set (security_invoker = true);

-- Tags em alta nos últimos 7 dias. Migration 0023.
alter view if exists public.forum_trending_tags
  set (security_invoker = true);

-- ── 3) Verificação (somente leitura, sem DDL dinâmica) ──────────────────────
-- Não corrige nada e não falha a migração: apenas registra no log da aplicação
-- se algum objeto NOSSO (objetos de extensão são ignorados) ficou fora do
-- padrão. O bloqueio de fato é o teste pgTAP no CI.
do $$
declare
  fn_pendentes text;
  view_pendentes text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
    into fn_pendentes
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and not exists (
       select 1
         from unnest(coalesce(p.proconfig, array[]::text[])) as cfg
        where cfg like 'search_path=%'
     )
     and not exists (
       select 1
         from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
     );

  select string_agg(c.relname, ', ' order by c.relname)
    into view_pendentes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'v'
     and coalesce(
           (select o.option_value
              from pg_options_to_table(c.reloptions) o
             where o.option_name = 'security_invoker'),
           'off'
         ) not in ('on', 'true')
     and not exists (
       select 1
         from pg_depend d
        where d.classid = 'pg_class'::regclass
          and d.objid = c.oid
          and d.deptype = 'e'
     );

  if fn_pendentes is not null then
    raise notice '0038 — funções de public sem search_path fixo: %', fn_pendentes;
  else
    raise notice '0038 — todas as funções de public têm search_path fixo.';
  end if;

  if view_pendentes is not null then
    raise notice '0038 — views de public sem security_invoker: %', view_pendentes;
  else
    raise notice '0038 — todas as views de public usam security_invoker.';
  end if;
end $$;
