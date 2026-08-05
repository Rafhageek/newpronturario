-- 0046 — Conserta `set_patient_consent`, que nunca conseguiu gravar nada.
--
-- O DEFEITO
-- A 0032 escreveu, no insert de auditoria:
--
--   case when p_granted then 'share' else 'update' end
--
-- Os dois literais são do tipo `unknown`. Num CASE, o Postgres resolve o tipo
-- do resultado ANTES da coerção de atribuição — com todos os ramos `unknown`,
-- resolve para `text`. A atribuição à coluna então falha:
--
--   42804: column "action" is of type audit_action but expression is of type text
--
-- Um literal cru (`'share'`) funcionaria, porque aí a coerção de atribuição
-- acontece direto contra o tipo da coluna. O CASE é que muda a ordem. A 0041
-- já faz o certo no mesmo projeto (`'share'::audit_action`); este é o único
-- ponto do banco com o padrão errado.
--
-- POR QUE ISSO PASSOU 14 MIGRAÇÕES SEM NINGUÉM VER
-- O erro é incondicional: acontece em toda chamada, para todo usuário, sem
-- ramo de escape. Havia teste pgTAP cobrindo exatamente isso — mas a suíte
-- nunca chegou a executá-lo, porque o banco do CI não tinha os privilégios de
-- tabela que a plataforma Supabase dá de graça em produção, e os testes
-- morriam antes na porteira de permissão (corrigido na 0000 e no e59f088).
-- O teste achou o defeito no primeiro dia em que rodou de verdade.
--
-- O QUE ISSO SIGNIFICAVA NA PRÁTICA
-- A 0032 revoga insert/update/delete de `consents` para `authenticated`, então
-- esta RPC é o ÚNICO caminho de escrita. Com ela quebrada:
--   · o painel de consentimento nunca gravou nada;
--   · a trilha de auditoria de concessão/revogação nunca foi escrita;
--   · o processamento de exame por IA ficou inutilizável — porque o portão
--     `can_process_exam_with_ai()` exige, corretamente, um consentimento que
--     não havia como criar.
--
-- Importante para o registro: o portão estava travado FECHADO, não aberto.
-- Nenhum exame foi processado sem consentimento; nenhuma violação do art. 11
-- da LGPD por permissividade. O prejuízo foi de funcionalidade, não de
-- privacidade.
--
-- O QUE ESTA MIGRAÇÃO NÃO FAZ
-- Não muda quem pode consentir, o que é gravado, a versão do texto, nem a
-- semântica de concessão/revogação. O corpo é o da 0032, caractere por
-- caractere, com dois casts acrescentados. É a função passar a executar o que
-- ela já dizia fazer.

create or replace function public.set_patient_consent(
  p_purpose consent_purpose,
  p_granted boolean,
  p_scope jsonb default '{}'::jsonb,
  p_version text default 'v1'
)
returns public.consents
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  saved public.consents;
begin
  if uid is null then
    raise exception 'Não autenticado.' using errcode = 'insufficient_privilege';
  end if;
  if p_scope is null or jsonb_typeof(p_scope) <> 'object' then
    raise exception 'O escopo do consentimento deve ser um objeto JSON.'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_version is null or length(trim(p_version)) < 1 or length(p_version) > 40 then
    raise exception 'Versão de consentimento inválida.'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.consents
    (patient_id, purpose, scope, granted, version, granted_at, revoked_at)
  values
    (
      uid,
      p_purpose,
      p_scope,
      p_granted,
      trim(p_version),
      case when p_granted then now() else null end,
      case when p_granted then null else now() end
    )
  on conflict (patient_id, purpose)
  do update
        set scope = excluded.scope,
            granted = excluded.granted,
            version = excluded.version,
            granted_at = case
              when excluded.granted then coalesce(public.consents.granted_at, now())
              else null
            end,
            revoked_at = case when excluded.granted then null else now() end
  returning * into saved;

  insert into public.audit_log
    (actor_id, patient_id, action, resource_type, resource_id, metadata)
  values
    (
      uid,
      uid,
      -- Os casts que faltavam. Sem eles o CASE resolve para `text` e o insert
      -- inteiro falha, derrubando a transação e a gravação do consentimento
      -- junto.
      case when p_granted then 'share'::audit_action else 'update'::audit_action end,
      'consent',
      saved.id,
      jsonb_build_object(
        'purpose', p_purpose::text,
        'granted', p_granted,
        'version', trim(p_version)
      )
    );

  return saved;
end;
$$;

comment on function public.set_patient_consent(consent_purpose, boolean, jsonb, text) is
  'Grava ou revoga consentimento do próprio titular, com auditoria na mesma '
  'transação. Único caminho de escrita em `consents` — a 0032 revoga '
  'insert/update/delete de `authenticated`.';
