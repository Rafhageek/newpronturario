-- ============================================================================
-- HubPatients — Migration 0033 — Workflow de privacidade da conta (P1)
--
-- Registra de forma auditável uma solicitação de exclusão. Esta migration
-- não promete nem executa purga automática: retenção legal, anonimização e
-- remoção do Auth/Storage exigem um processo administrativo server-side.
-- ============================================================================

create table if not exists public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  -- Torna-se NULL após a purga do Auth para preservar o protocolo mínimo.
  user_id      uuid unique references auth.users (id) on delete set null,
  status       text not null default 'requested'
               check (status in ('requested', 'in_review', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz,
  constraint account_deletion_completed_at_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "account_deletion_requests_select_own" on public.account_deletion_requests;
create policy "account_deletion_requests_select_own"
  on public.account_deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Sem INSERT/UPDATE/DELETE direto para authenticated: toda solicitação passa
-- pelo RPC, que fixa a identidade no auth.uid() e grava a trilha de auditoria.
revoke all on table public.account_deletion_requests from anon, authenticated;
grant select on table public.account_deletion_requests to authenticated;

create or replace function public.request_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  req public.account_deletion_requests;
begin
  if uid is null then
    raise exception 'Não autenticado.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.account_deletion_requests (
    user_id,
    status,
    requested_at,
    updated_at,
    completed_at
  )
  values (uid, 'requested', now(), now(), null)
  on conflict (user_id) do update
    set status = 'requested',
        requested_at = now(),
        updated_at = now(),
        completed_at = null
  returning * into req;

  insert into public.audit_log (
    actor_id,
    patient_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    uid,
    uid,
    'delete',
    'account_deletion_request',
    req.id,
    jsonb_build_object('status', req.status, 'workflow_version', '1')
  );

  return jsonb_build_object(
    'request_id', req.id,
    'status', req.status,
    'requested_at', req.requested_at
  );
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

comment on table public.account_deletion_requests is
  'Solicitações auditáveis; após a purga, user_id é anonimizado e o protocolo mínimo permanece.';
