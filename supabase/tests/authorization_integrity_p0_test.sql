-- ============================================================================
-- pgTAP — autorização, consentimento, integridade clínica e retenção de audit.
-- Executar após `supabase db reset`: `supabase test db`.
-- Fixtures exclusivamente fictícias; toda a suíte é revertida ao final.
-- ============================================================================

begin;
select plan(26);

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'paciente-a@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Paciente A"}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cuidador-b@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Cuidador B"}'::jsonb, now(), now()),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'paciente-c@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Paciente C"}'::jsonb, now(), now()),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'conta-removida@test.local', '', now(), '{}'::jsonb,
   '{"full_name":"Conta Removida"}'::jsonb, now(), now());

update public.profiles
   set cpf = '00000000000',
       phone = '000000000',
       address = '{"city":"Cidade Fictícia"}'::jsonb,
       calendar_enabled = true,
       calendar_token = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 where id = '10000000-0000-0000-0000-000000000001';

insert into public.care_relationships
  (id, patient_id, caregiver_id, status, permissions, revoked_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002',
   'revoked',
   '{"children":true,"ver_vitais":true,"receber_alertas":true}'::jsonb,
   now());

insert into public.medications (id, patient_id, name, stock_count)
values
  ('50000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000001', 'Medicamento fictício A', 5),
  ('60000000-0000-0000-0000-000000000006',
   '30000000-0000-0000-0000-000000000003', 'Medicamento fictício C', 5);

insert into public.exams (id, patient_id, title)
values
  ('70000000-0000-0000-0000-000000000007',
   '10000000-0000-0000-0000-000000000001', 'Exame fictício A'),
  ('80000000-0000-0000-0000-000000000008',
   '30000000-0000-0000-0000-000000000003', 'Exame fictício C');

insert into public.children
  (id, parent_profile_id, full_name, birth_date, sex)
values
  ('90000000-0000-0000-0000-000000000009',
   '10000000-0000-0000-0000-000000000001',
   'Criança Fictícia', current_date - interval '5 years', 'female');

insert into public.appointments
  (id, patient_id, doctor_name, scheduled_at, kind, status, meeting_link)
values
  ('91000000-0000-0000-0000-000000000009',
   '10000000-0000-0000-0000-000000000001',
   'Profissional Fictício', now() + interval '7 days', 'telehealth', 'scheduled',
   'https://example.invalid/sala-secreta');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","email":"cuidador-b@test.local","role":"authenticated"}',
  true
);

select throws_ok(
  $$ update public.care_relationships
        set status = 'accepted', revoked_at = null
      where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  null, null,
  'cuidador não reativa vínculo revogado por UPDATE direto'
);

reset role;
select is(
  (select status::text from public.care_relationships
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'revoked',
  'vínculo permanece revogado após tentativa direta'
);

insert into public.caregiver_invites
  (inviter_id, inviter_name, invitee_email, role, permissions, token)
values
  ('10000000-0000-0000-0000-000000000001', 'Paciente A',
   'cuidador-b@test.local', 'i_am_patient',
   '{"children":true,"ver_vitais":true,"receber_alertas":true}'::jsonb,
   'token-ficticio-de-reativacao');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","email":"cuidador-b@test.local","role":"authenticated"}',
  true
);
select lives_ok(
  $$ select public.accept_caregiver_invite('token-ficticio-de-reativacao') $$,
  'novo convite válido permite reativação controlada'
);

select is(
  (select count(*)::int from public.children
    where id = '90000000-0000-0000-0000-000000000009'),
  1,
  'cuidador autorizado pode ler a criança'
);

select is(
  (with changed as (
     update public.children set full_name = 'Alteração indevida'
      where id = '90000000-0000-0000-0000-000000000009'
      returning id
   ) select count(*)::int from changed),
  0,
  'cuidador não pode alterar a criança'
);

select is(
  (with removed as (
     delete from public.children
      where id = '90000000-0000-0000-0000-000000000009'
      returning id
   ) select count(*)::int from removed),
  0,
  'cuidador não pode excluir a criança'
);

select throws_ok(
  $$ insert into public.child_growth_measurements
       (child_id, age_months_at_measurement, measured_at, weight_kg)
     values
       ('90000000-0000-0000-0000-000000000009', 60, current_date, 20) $$,
  null, null,
  'cuidador não pode criar medida pediátrica'
);

select is(
  (select count(*)::int from public.profiles
    where id = '10000000-0000-0000-0000-000000000001'),
  0,
  'cuidador não lê a linha completa de profiles'
);

select ok(
  (public.get_accessible_profile('10000000-0000-0000-0000-000000000001') ? 'full_name')
  and not (
    public.get_accessible_profile('10000000-0000-0000-0000-000000000001')
    ?| array['cpf', 'phone', 'address', 'calendar_token', 'calendar_enabled']
  ),
  'RPC do cuidador retorna identidade mínima sem PII/token'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","email":"paciente-a@test.local","role":"authenticated"}',
  true
);

select throws_ok(
  $$ insert into public.audit_log
       (actor_id, patient_id, action, resource_type)
     values
       ('10000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000003',
        'read', 'forged') $$,
  null, null,
  'authenticated não pode falsificar audit_log'
);

select throws_ok(
  $$ insert into public.consents (patient_id, purpose, granted)
     values ('10000000-0000-0000-0000-000000000001', 'research', true) $$,
  null, null,
  'escrita direta de consentimento é bloqueada'
);

select lives_ok(
  $$ select public.set_patient_consent(
       'research', true, '{"categories":["vitals"]}'::jsonb, 'v1'
     ) $$,
  'RPC atômica cria consentimento'
);

select lives_ok(
  $$ select public.set_patient_consent(
       'research', false, '{}'::jsonb, 'v1'
     ) $$,
  'RPC atômica revoga consentimento'
);

select is(
  (select count(*)::int from public.consents
    where patient_id = '10000000-0000-0000-0000-000000000001'
      and purpose = 'research'),
  1,
  'há um único consentimento vigente por paciente/finalidade'
);

select is(
  (select granted from public.consents
    where patient_id = '10000000-0000-0000-0000-000000000001'
      and purpose = 'research'),
  false,
  'revogação é o estado vigente'
);

select is(
  (select count(*)::int from public.audit_log
    where patient_id = '10000000-0000-0000-0000-000000000001'
      and resource_type = 'consent'
      and metadata ->> 'purpose' = 'research'),
  2,
  'cada alteração de consentimento foi auditada na mesma transação'
);

select is(
  public.can_process_exam_with_ai(),
  false,
  'consentimento de pesquisa não habilita processamento por IA'
);

select lives_ok(
  $$ select public.set_patient_consent(
       'ai_exam_processing', true, '{"provider":"anthropic"}'::jsonb, 'v1'
     ) $$,
  'RPC registra consentimento específico para IA'
);
select is(
  public.can_process_exam_with_ai(),
  true,
  'consentimento explícito vigente habilita o gate de IA'
);

select throws_ok(
  $$ select public.log_ai_exam_processing(
       '80000000-0000-0000-0000-000000000008'
     ) $$,
  null, null,
  'auditoria de IA rejeita exame de outro paciente'
);

select lives_ok(
  $$ select public.log_ai_exam_processing(
       '70000000-0000-0000-0000-000000000007'
     ) $$,
  'auditoria de IA aceita exame próprio com consentimento explícito'
);

select throws_ok(
  $$ insert into public.medication_intakes
       (patient_id, medication_id, status)
     values
       ('10000000-0000-0000-0000-000000000001',
        '60000000-0000-0000-0000-000000000006', 'taken') $$,
  null, null,
  'FK composta rejeita tomada cross-patient'
);

insert into public.medication_intakes (patient_id, medication_id, status)
values
  ('10000000-0000-0000-0000-000000000001',
   '50000000-0000-0000-0000-000000000005', 'taken');
select is(
  (select stock_count from public.medications
    where id = '50000000-0000-0000-0000-000000000005'),
  4,
  'tomada válida debita apenas o estoque do mesmo paciente'
);

reset role;
select ok(
  not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'calendar_feed'
       and 'meeting_link' = any(coalesce(p.proargnames, array[]::text[]))
  ),
  'assinatura anônima de calendar_feed não contém meeting_link'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(
  (select count(*)::int
     from public.calendar_feed('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  1,
  'calendar_feed anônimo continua funcional sem expor o link'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000004","email":"conta-removida@test.local","role":"authenticated"}',
  true
);
select public.log_self_security_event('account_test', '{}'::jsonb);
reset role;
delete from auth.users where id = '40000000-0000-0000-0000-000000000004';
select is(
  (select count(*)::int from public.audit_log
    where resource_id = '40000000-0000-0000-0000-000000000004'
      and actor_id is null
      and patient_id is null),
  1,
  'audit_log sobrevive à exclusão da conta com referências anuladas'
);

select * from finish();
rollback;
