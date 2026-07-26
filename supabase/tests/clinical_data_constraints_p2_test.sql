-- ============================================================================
-- pgTAP — integridade clínica conservadora e refill atômico (migration 0036).
-- Executar após `supabase db reset`: `supabase test db`.
-- Fixtures exclusivamente fictícias; toda a suíte é revertida ao final.
-- ============================================================================

begin;
select plan(19);

select has_check(
  'public', 'vitals', 'vitals_physical_possibility_ck',
  'vitals possui guarda de possibilidade física'
);
select has_check(
  'public', 'medications', 'medications_stock_nonnegative_ck',
  'estoque possui guarda não negativa'
);
select has_function(
  'public', 'refill_medication_stock', array['uuid', 'integer'],
  'RPC de refill atômico existe'
);
select is(
  (select convalidated from pg_constraint
    where conname = 'vitals_physical_possibility_ck'
      and conrelid = 'public.vitals'::regclass),
  false,
  'constraint de vitais inicia NOT VALID para proteger o legado'
);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'titular-constraints@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Titular Fictício"}'::jsonb, now(), now()),
  ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'outro-constraints@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Outro Titular Fictício"}'::jsonb, now(), now());

insert into public.medications (id, patient_id, name, stock_count, package_size)
values
  ('a3000000-0000-0000-0000-000000000003',
   'a1000000-0000-0000-0000-000000000001', 'Medicamento fictício A', 5, 20),
  ('a4000000-0000-0000-0000-000000000004',
   'a2000000-0000-0000-0000-000000000002', 'Medicamento fictício B', 5, 20);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","email":"titular-constraints@test.local","role":"authenticated"}',
  true
);

select throws_ok(
  $$ insert into public.vitals
       (patient_id, type, value_primary, value_secondary, unit)
     values
       ('a1000000-0000-0000-0000-000000000001',
        'oxygen_saturation', 101, null, '%') $$,
  '23514', null,
  'saturação percentual acima de 100 é rejeitada'
);

select throws_ok(
  $$ insert into public.vitals
       (patient_id, type, value_primary, value_secondary, unit)
     values
       ('a1000000-0000-0000-0000-000000000001',
        'blood_pressure', 120, null, 'mmHg') $$,
  '23514', null,
  'pressão arterial sem componente diastólico é rejeitada'
);

select lives_ok(
  $$ insert into public.vitals
       (patient_id, type, value_primary, value_secondary, unit)
     values
       ('a1000000-0000-0000-0000-000000000001',
        'blood_pressure', 300, 200, 'mmHg') $$,
  'valor extremo mas fisicamente possível não é classificado nem bloqueado'
);

select throws_ok(
  $$ insert into public.body_composition (user_id, weight_kg, body_fat_pct)
     values ('a1000000-0000-0000-0000-000000000001', 70, 101) $$,
  '23514', null,
  'percentual corporal impossível é rejeitado'
);

select throws_ok(
  $$ insert into public.body_measurements (user_id, waist_cm)
     values ('a1000000-0000-0000-0000-000000000001', -1) $$,
  '23514', null,
  'medida corporal negativa é rejeitada'
);

select throws_ok(
  $$ update public.profiles set height_cm = 0
      where id = 'a1000000-0000-0000-0000-000000000001' $$,
  '23514', null,
  'altura impossível é rejeitada'
);

select throws_ok(
  $$ update public.medications set stock_count = -1
      where id = 'a3000000-0000-0000-0000-000000000003' $$,
  '23514', null,
  'estoque negativo é rejeitado'
);

select throws_ok(
  $$ select public.refill_medication_stock(
       'a3000000-0000-0000-0000-000000000003', 0
     ) $$,
  '22023', null,
  'refill exige quantidade positiva'
);

select is(
  public.refill_medication_stock(
    'a3000000-0000-0000-0000-000000000003', 3
  ),
  8,
  'primeiro refill soma no banco e retorna o novo estoque'
);

select is(
  public.refill_medication_stock(
    'a3000000-0000-0000-0000-000000000003', 4
  ),
  12,
  'refills sucessivos acumulam sem read-modify-write no cliente'
);

select is(
  (select count(*)::integer from public.audit_log
    where patient_id = 'a1000000-0000-0000-0000-000000000001'
      and resource_type = 'medication_stock_refill'
      and resource_id = 'a3000000-0000-0000-0000-000000000003'),
  2,
  'cada refill concluído possui auditoria na mesma transação'
);

select is(
  (select stock_count from public.medications
    where id = 'a3000000-0000-0000-0000-000000000003'),
  12,
  'estoque final preserva todas as somas'
);

select throws_ok(
  $$ select public.refill_medication_stock(
       'a4000000-0000-0000-0000-000000000004', 5
     ) $$,
  '42501', null,
  'titular não repõe medicamento de outro paciente'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select public.refill_medication_stock(
       'a3000000-0000-0000-0000-000000000003', 5
     ) $$,
  null, null,
  'anon não executa o RPC de refill'
);

reset role;
select is(
  (select count(*)::integer from public.audit_log
    where resource_type = 'medication_stock_refill'),
  2,
  'tentativas rejeitadas não criam auditoria falsa'
);

select * from finish();
rollback;
