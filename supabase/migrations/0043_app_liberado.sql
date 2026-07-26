-- ============================================================================
-- HubPatients — Migration 0043 — App LIBERADO (Plus destravado)
--
-- O QUE FAZ
--   `has_plus_access()` passa a devolver TRUE para qualquer usuário autenticado.
--   Todo recurso antes restrito ao Plus fica aberto: insight da semana, períodos
--   longos na análise, tokens de acesso para IA (0027) e o que mais consultar
--   essa função.
--
-- POR QUE ASSIM
--   Decisão de negócio do dono do projeto: liberar o app inteiro POR ENQUANTO.
--   Toda a trava do produto passava por esta única função, então mudá-la aqui:
--     · destrava web e mobile ao MESMO tempo, no servidor;
--     · vale para quem JÁ tem o app instalado, sem precisar de atualização;
--     · é revertível em um comando, sem tocar em nenhuma tela.
--
--   Nada foi apagado de propósito. `vouchers`, `voucher_redemptions`,
--   `redeem_voucher()` e as telas de plano continuam existindo e funcionando —
--   só deixam de ser exigidos. Quem já resgatou voucher não perde nada, e a
--   volta da cobrança não exige reconstruir a fundação.
--
-- COMO REVERTER (voltar a cobrar)
--   Basta restaurar o corpo original — o entitlement volta a ser "voucher
--   resgatado e não expirado", exatamente como na migração 0026:
--
--     create or replace function public.has_plus_access(uid uuid default null)
--     returns boolean language sql stable security definer set search_path = public as $BODY$
--       select exists (
--         select 1 from public.voucher_redemptions r
--         where r.user_id = coalesce(uid, (select auth.uid()))
--           and r.expires_at > now()
--       );
--     $BODY$;
--
--   Depois disso, reexibir os pontos de venda no app (o item "Plano" no menu e
--   o resgate de voucher em Configurações foram apenas OCULTADOS, não removidos).
--
-- ATENÇÃO — O QUE ISTO **NÃO** AFETA
--   Isto é entitlement de PRODUTO, não autorização de DADOS. Continua valendo
--   integralmente:
--     · RLS em todas as tabelas — cada pessoa só vê os próprios dados;
--     · o consentimento específico para IA em exame (`can_process_exam_with_ai`),
--       que depende de `consents`, não de Plus. Liberar o Plus NÃO libera
--       processar exame com IA sem o titular ter autorizado;
--     · os consentimentos por setor da migração 0042.
--   Ou seja: abriu o acesso a FEATURE, não a dado de outra pessoa.
--
--   `uid` continua sendo respeitado na assinatura por compatibilidade (0027
--   chama com argumento), mas o resultado não depende mais dele.
-- ============================================================================

create or replace function public.has_plus_access(uid uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- App liberado: qualquer sessão autenticada tem acesso completo.
  -- `uid` é ignorado de propósito (ver cabeçalho); mantido na assinatura para
  -- não quebrar as chamadas existentes.
  select (select auth.uid()) is not null or uid is not null;
$$;

comment on function public.has_plus_access(uuid) is
  'LIBERADO em 2026-07-26 (migração 0043): devolve true para usuário autenticado. '
  'O entitlement por voucher segue implementado em redeem_voucher/voucher_redemptions; '
  'para voltar a cobrar, restaurar o corpo original descrito no cabeçalho da 0043.';
