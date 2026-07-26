-- ============================================================================
-- HubPatients — Migration 0041 — Guardião de Dose
--
-- O QUE FAZ
--   Quando uma dose de um medicamento marcado como CRÍTICO vence e não há
--   nenhuma confirmação registrada dentro do prazo escolhido pelo paciente,
--   os cuidadores ACEITOS que já têm permissão de medicamentos recebem UM
--   aviso neutro na fila de notificações in-app existente (notification_queue).
--
-- BASE LEGAL / LGPD  (obrigatório ler antes de mexer aqui)
--   Avisar um terceiro de que houve falha na confirmação de uma dose é
--   COMPARTILHAR DADO PESSOAL SENSÍVEL DE SAÚDE (LGPD art. 5º, II e art. 11).
--   Por isso o recurso é desenhado assim:
--     · consentimento é do TITULAR (paciente), nunca do cuidador — quem liga
--       é o dono dos dados, em dose_guardian_settings (RLS owner-only);
--     · é GRANULAR — só vale para medicamentos que o próprio paciente marcou
--       como críticos (medications.is_critical), não para a farmácia inteira;
--     · é REVOGÁVEL A QUALQUER TEMPO e sem fricção — basta desligar o toggle
--       (art. 8º, §5º); o cuidador NÃO consegue reativar nem alterar o prazo,
--       porque a policy só aceita user_id = auth.uid();
--     · é TRANSPARENTE — o cuidador enxerga que o recurso está ativo via
--       dose_guardian_active_patients(), então não existe vigilância oculta;
--     · é MINIMIZADO (art. 6º, III) — a mensagem diz apenas que faltou a
--       CONFIRMAÇÃO, jamais "fulano não tomou o remédio". A ausência de
--       registro não é prova de não adesão, e afirmar isso a um terceiro
--       seria dado incorreto além de sensível;
--     · é AUDITÁVEL (art. 37) — todo envio grava um audit_log 'share'.
--
-- ÉTICA
--   Isto é uma rede de apoio, não um monitor de adesão. Nada de placar, nada
--   de histórico de falhas para o cuidador, nada de escalonamento automático.
--   Um aviso por dose por dia, texto neutro, e o paciente sempre no controle.
--
-- DEPENDÊNCIA (defensiva)
--   A tabela public.dose_events vem na migração 0040, escrita em paralelo.
--   check_missed_doses() detecta a ausência da tabela/colunas em tempo de
--   execução e sai sem erro, então esta migração aplica sozinha sem quebrar.
--
-- ADITIVA e IDEMPOTENTE. Não remove nem reescreve nada de migrações anteriores.
-- ============================================================================

-- ── 1) Medicamento crítico ──────────────────────────────────────────────────
-- Granularidade do consentimento: o Guardião só olha o que o paciente marcou.
alter table public.medications
  add column if not exists is_critical boolean not null default false;

comment on column public.medications.is_critical is
  'Dose crítica: habilita o Guardião de Dose para este medicamento. Marcado pelo próprio paciente (RLS medications_modify exige patient_id = auth.uid()).';

create index if not exists medications_critical_idx
  on public.medications (patient_id)
  where is_critical;

-- ── 2) Preferência do paciente (o consentimento em si) ──────────────────────
create table if not exists public.dose_guardian_settings (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  enabled       boolean not null default false,   -- opt-in explícito: nasce desligado
  delay_minutes integer not null default 90,      -- tolerância antes de avisar
  updated_at    timestamptz not null default now()
);

comment on table public.dose_guardian_settings is
  'Consentimento do TITULAR para o Guardião de Dose (LGPD art. 11). Owner-only: o cuidador nunca lê nem escreve aqui.';
comment on column public.dose_guardian_settings.delay_minutes is
  'Minutos de tolerância após o horário da dose antes de avisar (30 a 240). Prazo curto demais gera alarme falso e vira pressão sobre o paciente.';

-- Constraint separada para o caso da tabela já existir de uma execução anterior.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'dose_guardian_delay_range'
       and conrelid = 'public.dose_guardian_settings'::regclass
  ) then
    alter table public.dose_guardian_settings
      add constraint dose_guardian_delay_range check (delay_minutes between 30 and 240);
  end if;
end $$;

alter table public.dose_guardian_settings enable row level security;

-- Owner-only, sem exceção para cuidador: quem liga e desliga é o dono dos dados.
drop policy if exists "dose_guardian_settings_owner" on public.dose_guardian_settings;
create policy "dose_guardian_settings_owner" on public.dose_guardian_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop trigger if exists dose_guardian_settings_set_updated_at on public.dose_guardian_settings;
create trigger dose_guardian_settings_set_updated_at
  before update on public.dose_guardian_settings
  for each row execute function public.set_updated_at();

-- Índice que sustenta o dedupe de 24h da rotina (user_id + type + created_at).
create index if not exists notification_queue_type_user_idx
  on public.notification_queue (user_id, type, created_at desc);

-- ── 3) Quem pode receber o aviso ────────────────────────────────────────────
-- Mesma semântica de caregiver_has_permission()/0032 para medicamentos, porém
-- avaliada a partir do PACIENTE (a rotina roda no cron, sem auth.uid()).
-- Aceita as três chaves que o app já usa: 0009 ('registrar_tomada',
-- 'receber_alertas') e o conjunto legado de 0001 ('medications').
create or replace function public.dose_guardian_permission_granted(p_permissions jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce((p_permissions ->> 'registrar_tomada')::boolean, false)
      or coalesce((p_permissions ->> 'receber_alertas')::boolean, false)
      or coalesce((p_permissions ->> 'medications')::boolean, false);
$$;

revoke all on function public.dose_guardian_permission_granted(jsonb) from public, anon, authenticated;

-- Transparência para o cuidador: quais das pessoas que eu cuido têm o Guardião
-- ativo (e com que tolerância). Não expõe dose, horário nem medicamento — só o
-- fato de o recurso existir, para que não haja monitoramento oculto nem falsa
-- sensação de cobertura quando o paciente desliga.
create or replace function public.dose_guardian_active_patients()
returns table (patient_id uuid, delay_minutes integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, s.delay_minutes
    from public.dose_guardian_settings s
    join public.care_relationships cr on cr.patient_id = s.user_id
   where s.enabled = true
     and cr.caregiver_id = (select auth.uid())
     and cr.status = 'accepted'
     and public.dose_guardian_permission_granted(cr.permissions);
$$;

revoke all on function public.dose_guardian_active_patients() from public, anon;
grant execute on function public.dose_guardian_active_patients() to authenticated;

-- ── 4) A rotina ─────────────────────────────────────────────────────────────
-- Expande os horários de medicamentos críticos (hoje e ontem, para cobrir doses
-- noturnas cujo prazo vira o dia), descarta as que já têm confirmação e
-- enfileira UM aviso neutro por dose/cuidador a cada 24h.
--
-- Fuso: medication_schedules.times é `time` sem fuso e o produto é brasileiro,
-- então a expansão usa America/São Paulo. Se um dia existir fuso por perfil,
-- trocar v_tz por uma leitura de profiles.
--
-- Defensiva quanto a 0040: se public.dose_events (ou as colunas esperadas)
-- ainda não existir, a função apenas avisa e retorna 0.
create or replace function public.check_missed_doses()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tz        constant text := 'America/Sao_Paulo';
  v_owner_col text;
  v_med_col   text;
  v_sql       text;
  v_count     integer := 0;
begin
  if to_regclass('public.dose_events') is null then
    raise notice 'Guardião de Dose: public.dose_events ausente (migração 0040 não aplicada) — nada a fazer.';
    return 0;
  end if;

  -- Descobre como 0040 nomeou o dono e o medicamento, em vez de presumir.
  select c.column_name into v_owner_col
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'dose_events'
     and c.column_name in ('patient_id', 'user_id')
   order by case c.column_name when 'patient_id' then 0 else 1 end
   limit 1;

  select c.column_name into v_med_col
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'dose_events'
     and c.column_name in ('medication_id', 'med_id')
   order by case c.column_name when 'medication_id' then 0 else 1 end
   limit 1;

  if v_owner_col is null
     or v_med_col is null
     or not exists (
       select 1 from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'dose_events'
          and c.column_name = 'scheduled_for'
     ) then
    raise notice 'Guardião de Dose: public.dose_events sem as colunas esperadas (dono/medicamento/scheduled_for) — nada a fazer.';
    return 0;
  end if;

  v_sql := format($q$
    with cfg as (
      -- Só entram pacientes que ligaram o recurso. Desligou, sumiu daqui.
      select s.user_id, s.delay_minutes
        from public.dose_guardian_settings s
       where s.enabled = true
    ),
    slots as (
      select
        m.patient_id,
        m.id                       as medication_id,
        m.name                     as medication_name,
        cfg.delay_minutes,
        ((d.dia + t.hora) at time zone %1$L) as scheduled_for,
        to_char(t.hora, 'HH24:MI') as hora_label
      from cfg
      join public.medications m
        on m.patient_id = cfg.user_id
       and m.active
       and m.is_critical
      join public.medication_schedules sc
        on sc.medication_id = m.id
       and sc.patient_id = m.patient_id
      -- Hoje e ontem: uma dose das 23h com tolerância longa só vence no dia
      -- seguinte, e sem isso ela nunca seria avaliada.
      cross join (
        select ((now() at time zone %1$L)::date - g)::date as dia
          from generate_series(0, 1) as g
      ) d
      cross join lateral unnest(sc.times) as t(hora)
      where sc.reminder_enabled
        and sc.start_date <= d.dia
        and (sc.end_date is null or sc.end_date >= d.dia)
        and (
          coalesce(array_length(sc.days_of_week, 1), 0) = 0
          or extract(dow from d.dia)::smallint = any(sc.days_of_week)
        )
    ),
    vencidas as (
      -- Venceu o prazo do paciente, mas ainda dentro de uma janela curta: a
      -- rotina não ressuscita doses antigas se o cron ficar parado.
      select s.*
        from slots s
       where s.scheduled_for < now() - make_interval(mins => s.delay_minutes)
         and s.scheduled_for > now() - make_interval(mins => s.delay_minutes) - interval '6 hours'
    ),
    sem_confirmacao as (
      -- Qualquer interação conta como confirmação: taken, snoozed ou skipped.
      -- O objetivo é detectar SILÊNCIO, não julgar a escolha do paciente.
      select v.*
        from vencidas v
       where not exists (
         select 1
           from public.dose_events de
          where de.%2$I = v.patient_id
            and de.%3$I = v.medication_id
            and de.scheduled_for >= v.scheduled_for - interval '30 minutes'
            and de.scheduled_for <= v.scheduled_for + interval '30 minutes'
       )
         and not exists (
         -- Fluxo legado de tomada: se registrou por ali, também não avisa.
         select 1
           from public.medication_intakes mi
          where mi.patient_id = v.patient_id
            and mi.medication_id = v.medication_id
            and mi.status = 'taken'
            and mi.scheduled_for >= v.scheduled_for - interval '30 minutes'
            and mi.scheduled_for <= v.scheduled_for + interval '30 minutes'
       )
    ),
    avisos as (
      select
        cr.caregiver_id as recipient_id,
        sc2.patient_id,
        sc2.medication_id,
        'Sem confirmação de dose'::text as title,
        ('Não houve confirmação da dose de ' || sc2.medication_name
          || ' às ' || sc2.hora_label
          || '. Pode ser só o registro que faltou — se puder, mande uma mensagem carinhosa.')::text as body
      from sem_confirmacao sc2
      join public.care_relationships cr
        on cr.patient_id = sc2.patient_id
       and cr.status = 'accepted'
       and public.dose_guardian_permission_granted(cr.permissions)
    ),
    novos as (
      -- Dedupe: uma notificação por dose, por cuidador, por dia. O corpo já
      -- identifica medicamento + horário, então serve de chave natural sem
      -- precisar guardar mais dado de saúde do que o necessário.
      select distinct a.*
        from avisos a
       where not exists (
         select 1
           from public.notification_queue nq
          where nq.user_id = a.recipient_id
            and nq.type = 'dose_guardian'
            and nq.body = a.body
            and nq.created_at > now() - interval '24 hours'
       )
    ),
    ins as (
      insert into public.notification_queue
        (user_id, type, title, body, channel, resource_type, resource_id)
      select n.recipient_id, 'dose_guardian', n.title, n.body, 'in_app', 'medication', n.medication_id
        from novos n
      returning 1
    ),
    aud as (
      -- LGPD art. 37: todo compartilhamento com terceiro fica registrado.
      -- actor_id = paciente porque foi o consentimento dele que autorizou.
      insert into public.audit_log
        (actor_id, patient_id, action, resource_type, resource_id, metadata)
      select
        n.patient_id,
        n.patient_id,
        'share'::audit_action,
        'dose_guardian_alert',
        n.medication_id,
        jsonb_build_object(
          'recipient_id', n.recipient_id,
          'reason', 'dose_sem_confirmacao',
          'automated', true,
          'source', 'check_missed_doses'
        )
        from novos n
      returning 1
    )
    select coalesce(count(*), 0)::integer from ins
  $q$, v_tz, v_owner_col, v_med_col);

  execute v_sql into v_count;
  return coalesce(v_count, 0);
end;
$fn$;

comment on function public.check_missed_doses() is
  'Guardião de Dose: enfileira aviso NEUTRO aos cuidadores autorizados quando uma dose crítica vence sem confirmação. Só roda para pacientes com dose_guardian_settings.enabled = true.';

-- Rotina de sistema: nenhum usuário final invoca isto.
revoke all on function public.check_missed_doses() from public, anon, authenticated;
grant execute on function public.check_missed_doses() to service_role;

-- ── 5) Agendamento (a cada 15 min) ──────────────────────────────────────────
-- Mesmo padrão de 0018/0022, mas o unschedule fica em bloco próprio: na
-- primeira aplicação o job não existe e a exceção abortaria o schedule.
do $$
begin
  create extension if not exists pg_cron;

  begin
    perform cron.unschedule('hubpatients-dose-guardian');
  exception when others then
    null; -- job ainda não existia
  end;

  perform cron.schedule(
    'hubpatients-dose-guardian',
    '*/15 * * * *',
    'select public.check_missed_doses();'
  );
exception when others then
  raise notice 'pg_cron indisponível — Guardião de Dose precisa de disparo externo. Agende "select public.check_missed_doses();" a cada 15 min (Edge Function + Supabase Scheduled Function, ou cron externo com service_role).';
end $$;
