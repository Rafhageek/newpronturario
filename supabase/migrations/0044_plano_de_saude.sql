-- ============================================================================
-- HubPatients — Migration 0044 — Plano de saúde: pagamentos e requerimentos
--
-- O QUE FAZ
--   Dá ao convênio um espaço próprio, além dos 4 campos que existiam soltos no
--   Perfil (operadora, carteirinha, validade, principal):
--     · `insurance_plans` ganha nome do plano, acomodação, telefone da central
--       e o endereço do portal da operadora;
--     · `insurance_payments` — boletos e PIX, pagos ou a pagar;
--     · `insurance_claims` — requerimentos (reembolso, autorização), com
--       protocolo e situação.
--
-- POR QUE ISSO É DE SAÚDE, E NÃO SÓ FINANCEIRO
--   Um extrato de plano revela USO DE SERVIÇO DE SAÚDE — quantas consultas,
--   que exames, quando. Por isso estas tabelas nascem com o mesmo rigor do
--   resto do prontuário: RLS dono-apenas, nada de service_role no cliente.
--
-- O QUE **NÃO** GUARDAMOS, DE PROPÓSITO
--   Nada que permita movimentar dinheiro ou clonar a identidade financeira:
--   sem linha digitável completa do boleto, sem chave PIX copia-e-cola, sem
--   número de cartão. Guardamos VALOR, DATA, SITUAÇÃO e um comprovante que o
--   titular anexa. Se um dia vazar, vaza um histórico — não uma cobrança
--   executável. Minimização (LGPD art. 6º, III) aplicada ao pé da letra.
--
--   `receipt_path` aponta para o Storage, onde o arquivo já herda a mesma
--   política de acesso dos exames.
--
-- SOBRE "CONECTORES COM O PORTAL DA OPERADORA"
--   Não existe API pública de plano de saúde no Brasil — cada operadora tem
--   portal fechado. Então `portal_url` é ATALHO, não integração: guarda o
--   endereço para o titular abrir com um toque. Nada é lido automaticamente.
--   Prometer sincronização aqui seria prometer o que não se entrega.
-- ============================================================================

-- 1) Campos que faltavam no plano ---------------------------------------------
alter table public.insurance_plans
  add column if not exists plan_name text,
  add column if not exists accommodation text,
  add column if not exists support_phone text,
  add column if not exists portal_url text,
  add column if not exists ans_code text;

comment on column public.insurance_plans.portal_url is
  'Atalho para o portal/app da operadora. NÃO é integração: nada é lido de lá.';
comment on column public.insurance_plans.ans_code is
  'Registro do plano na ANS — o número que a operadora é obrigada a informar.';

-- 2) Pagamentos (boletos e PIX) ------------------------------------------------
create table if not exists public.insurance_payments (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.profiles (id) on delete cascade,
  plan_id       uuid references public.insurance_plans (id) on delete set null,
  -- Competência: o mês a que a cobrança se refere (pode diferir do vencimento).
  reference_month date,
  due_date      date not null,
  paid_at       date,
  amount_cents  bigint not null check (amount_cents > 0),
  method        text check (method in ('boleto', 'pix', 'debito', 'cartao', 'outro')),
  notes         text,
  /* Comprovante no Storage. Só o caminho — o arquivo herda a política de acesso. */
  receipt_path  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists insurance_payments_patient_idx
  on public.insurance_payments (patient_id, due_date desc);

alter table public.insurance_payments enable row level security;
drop policy if exists "insurance_payments_own" on public.insurance_payments;
create policy "insurance_payments_own" on public.insurance_payments
  for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

drop trigger if exists insurance_payments_set_updated_at on public.insurance_payments;
create trigger insurance_payments_set_updated_at
  before update on public.insurance_payments
  for each row execute function public.set_updated_at();

-- 3) Requerimentos (reembolso, autorização) ------------------------------------
create table if not exists public.insurance_claims (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.profiles (id) on delete cascade,
  plan_id       uuid references public.insurance_plans (id) on delete set null,
  kind          text not null check (kind in ('reembolso', 'autorizacao', 'outro')),
  -- O protocolo é o que dá poder ao paciente na hora de cobrar. Campo de texto
  -- porque cada operadora usa um formato próprio.
  protocol      text,
  title         text not null,
  requested_at  date not null,
  status        text not null default 'aberto'
                check (status in ('aberto', 'em_analise', 'aprovado', 'negado', 'pago')),
  status_at     date,
  amount_cents  bigint check (amount_cents is null or amount_cents > 0),
  notes         text,
  document_path text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists insurance_claims_patient_idx
  on public.insurance_claims (patient_id, requested_at desc);

alter table public.insurance_claims enable row level security;
drop policy if exists "insurance_claims_own" on public.insurance_claims;
create policy "insurance_claims_own" on public.insurance_claims
  for all to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

drop trigger if exists insurance_claims_set_updated_at on public.insurance_claims;
create trigger insurance_claims_set_updated_at
  before update on public.insurance_claims
  for each row execute function public.set_updated_at();
