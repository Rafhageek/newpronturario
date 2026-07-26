-- ============================================================================
-- pgTAP — linha do tempo clínica permissionada (migration 0034).
-- Fixtures exclusivamente fictícias. A transação é revertida ao final.
-- ============================================================================

begin;
select plan(13);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'titular-timeline@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Titular Timeline"}'::jsonb, now(), now()),
  ('e2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cuidador-timeline@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Cuidador Timeline"}'::jsonb, now(), now()),
  ('e3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'terceiro-timeline@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Terceiro Timeline"}'::jsonb, now(), now());

insert into public.care_relationships
  (patient_id, caregiver_id, status, permissions)
values
  (
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000002',
    'accepted',
    '{"ver_vitais":true,"ver_exames":false,"registrar_tomada":false,"receber_alertas":true,"agendar_consulta":false}'::jsonb
  );

insert into public.vitals
  (id, patient_id, type, measured_at, value_primary, unit)
values
  ('e4100000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000001',
   'weight', '2026-07-23T12:00:00Z', 70, 'kg'),
  ('e4100000-0000-0000-0000-000000000002',
   'e1000000-0000-0000-0000-000000000001',
   'heart_rate', '2026-07-22T12:00:00Z', 72, 'bpm');

insert into public.exams
  (id, patient_id, title, exam_date, status)
values
  ('e4200000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000001',
   'Exame fictício', '2026-07-24', 'processed');

insert into public.medications
  (id, patient_id, name, started_at)
values
  ('e4300000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000001',
   'Medicamento fictício', '2026-07-21');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-0000-0000-000000000001","email":"titular-timeline@test.local","role":"authenticated"}',
  true
);

select has_function(
  'public',
  'clinical_timeline',
  array['uuid', 'integer', 'timestamp with time zone', 'text'],
  'RPC da linha do tempo existe com cursor e limite'
);

select is(
  (select count(*)::integer
     from public.clinical_timeline('e1000000-0000-0000-0000-000000000001', 25)),
  4,
  'titular recebe eventos das fontes clínicas existentes'
);

select is(
  (select source
     from public.clinical_timeline('e1000000-0000-0000-0000-000000000001', 25)
    limit 1),
  'exams',
  'eventos são ordenados pela data original, do mais recente'
);

select is(
  (select extract(hour from occurred_at at time zone 'UTC')::integer
     from public.clinical_timeline('e1000000-0000-0000-0000-000000000001', 25)
    where event_id = 'e4200000-0000-0000-0000-000000000001'),
  12,
  'DATE clínico usa meio-dia UTC e preserva o dia em fusos brasileiros'
);

select is(
  (select date_only
     from public.clinical_timeline('e1000000-0000-0000-0000-000000000001', 25)
    where event_id = 'e4200000-0000-0000-0000-000000000001'),
  true,
  'evento originado de DATE informa que não possui horário factual'
);

select is(
  (select count(*)::integer
     from public.clinical_timeline('e1000000-0000-0000-0000-000000000001', 2)),
  2,
  'limite da página é respeitado'
);

select ok(
  (select bool_and(has_more)
     from public.clinical_timeline('e1000000-0000-0000-0000-000000000001', 2)),
  'RPC informa que existe uma próxima página'
);

select is(
  (
    with first_page as (
      select *
      from public.clinical_timeline('e1000000-0000-0000-0000-000000000001', 2)
    ),
    cursor_row as (
      select occurred_at, event_key
      from first_page
      order by occurred_at asc, event_key asc
      limit 1
    )
    select count(*)::integer
    from public.clinical_timeline(
      'e1000000-0000-0000-0000-000000000001',
      2,
      (select occurred_at from cursor_row),
      (select event_key from cursor_row)
    )
  ),
  2,
  'cursor retorna a página seguinte sem OFFSET'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e2000000-0000-0000-0000-000000000002","email":"cuidador-timeline@test.local","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer
     from public.clinical_timeline('e1000000-0000-0000-0000-000000000001', 25)
    where source = 'vitals'),
  2,
  'cuidador com ver_vitais recebe sinais vitais'
);

select is(
  (select count(*)::integer
     from public.clinical_timeline('e1000000-0000-0000-0000-000000000001', 25)
    where source in ('exams', 'medications')),
  0,
  'cuidador não recebe domínios sem permissão'
);

select is(
  (select count(*)::integer
     from public.clinical_timeline('e1000000-0000-0000-0000-000000000001', 25)
    where source in ('medications', 'medication_intakes')),
  0,
  'receber_alertas não libera lista nem histórico de tomadas'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"e3000000-0000-0000-0000-000000000003","email":"terceiro-timeline@test.local","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select *
       from public.clinical_timeline(
         'e1000000-0000-0000-0000-000000000001', 25
       ) $$,
  '42501',
  'Acesso não autorizado',
  'terceiro sem vínculo recebe negação explícita'
);

reset role;
select ok(
  (select count(*) >= 8
     from public.audit_log
    where patient_id = 'e1000000-0000-0000-0000-000000000001'
      and resource_type = 'clinical_timeline'
      and action = 'read'
      and not (metadata ?| array['title', 'summary', 'patient_name'])),
  'leituras são auditadas sem conteúdo clínico nos metadados'
);

select * from finish();
rollback;
