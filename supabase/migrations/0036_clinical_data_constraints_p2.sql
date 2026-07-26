-- ============================================================================
-- HubPatients — Migration 0036 — Integridade de dados clínicos P2 (SEC-16)
--
-- Objetivos:
--   1. impedir valores fisicamente impossíveis sem classificar risco/diagnóstico;
--   2. impedir estoque negativo;
--   3. tornar a reposição de estoque atômica, autorizada e auditável.
--
-- Os limites são deliberadamente amplos. Eles são guardas de integridade contra
-- erro de unidade/digitação, não faixas de referência nem decisão clínica.
-- CHECKs em tabelas legadas são NOT VALID: passam a proteger INSERT/UPDATE sem
-- varrer ou bloquear a implantação por linhas históricas já inconsistentes.
--
-- Pré-validação recomendada (somente leitura, executar antes do deploy):
--
-- select id, patient_id, type, value_primary, value_secondary, unit
--   from public.vitals
--  where not public.is_vital_value_physically_possible(
--    type, value_primary, value_secondary, unit
--  );
--
-- select id, stock_count, package_size, stock_low_threshold_days
--   from public.medications
--  where (stock_count is not null and stock_count < 0)
--     or (package_size is not null and package_size <= 0)
--     or stock_low_threshold_days < 0;
--
-- select id, height_cm from public.profiles
--  where height_cm is not null and not (height_cm > 0 and height_cm <= 300);
--
-- select id from public.body_composition
--  where not public.is_body_composition_physically_possible(
--    weight_kg, bmi, body_fat_pct, muscle_mass_pct, visceral_fat,
--    body_water_pct, bone_mass_kg, bmr_kcal
--  );
--
-- select id from public.body_measurements
--  where not public.are_body_measurements_physically_possible(
--    waist_cm, hip_cm, arm_cm, thigh_cm, calf_cm, neck_cm, chest_cm
--  );
--
-- Depois de revisar/corrigir dados históricos em migration separada, validar:
-- alter table public.vitals validate constraint vitals_physical_possibility_ck;
-- alter table public.medications validate constraint medications_stock_nonnegative_ck;
-- alter table public.medications validate constraint medications_package_size_positive_ck;
-- alter table public.medications validate constraint medications_stock_threshold_nonnegative_ck;
-- alter table public.profiles validate constraint profiles_height_physical_possibility_ck;
-- alter table public.body_composition validate constraint body_composition_physical_possibility_ck;
-- alter table public.body_measurements validate constraint body_measurements_physical_possibility_ck;
-- ============================================================================

-- ── 1) Sinais vitais: limites físicos amplos, sensíveis à unidade ───────────
create or replace function public.is_vital_value_physically_possible(
  p_type public.vital_type,
  p_primary numeric,
  p_secondary numeric,
  p_unit text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case p_type
    when 'blood_pressure' then
      p_primary > 0 and p_primary <= 500
      and p_secondary is not null
      and p_secondary > 0 and p_secondary <= 500
    when 'oxygen_saturation' then
      p_secondary is null
      and p_primary > 0
      and (
        case
          when lower(trim(p_unit)) in ('%', 'percent', 'porcentagem')
            then p_primary <= 100
          else true
        end
      )
    when 'temperature' then
      p_secondary is null
      and (
        case
          when lower(replace(trim(p_unit), '°', '')) in ('c', 'celsius')
            then p_primary between 10 and 50
          when lower(replace(trim(p_unit), '°', '')) in ('f', 'fahrenheit')
            then p_primary between 50 and 122
          else p_primary > 0
        end
      )
    when 'glucose' then
      p_secondary is null
      and p_primary > 0
      and (
        case
          when lower(replace(trim(p_unit), ' ', '')) in ('mg/dl', 'mg/dℓ')
            then p_primary <= 5000
          when lower(replace(trim(p_unit), ' ', '')) in ('mmol/l', 'mmol/ℓ')
            then p_primary <= 300
          else true
        end
      )
    when 'weight' then
      p_secondary is null
      and p_primary > 0
      and (
        case when lower(trim(p_unit)) in ('kg', 'quilograma', 'quilogramas')
          then p_primary <= 1000 else true end
      )
    when 'heart_rate' then
      p_secondary is null
      and p_primary > 0
      and (
        case
          when lower(replace(trim(p_unit), ' ', '')) in
            ('bpm', 'batimentos/min', 'batimentos/minuto')
            then p_primary <= 500
          else true
        end
      )
    else false
  end;
$$;

revoke all on function public.is_vital_value_physically_possible(
  public.vital_type, numeric, numeric, text
) from public, anon;
grant execute on function public.is_vital_value_physically_possible(
  public.vital_type, numeric, numeric, text
) to authenticated, service_role;

alter table public.vitals
  drop constraint if exists vitals_physical_possibility_ck;
alter table public.vitals
  add constraint vitals_physical_possibility_ck
  check (public.is_vital_value_physically_possible(
    type, value_primary, value_secondary, unit
  )) not valid;

-- ── 2) Perfil e composição corporal ─────────────────────────────────────────
alter table public.profiles
  drop constraint if exists profiles_height_physical_possibility_ck;
alter table public.profiles
  add constraint profiles_height_physical_possibility_ck
  check (height_cm is null or (height_cm > 0 and height_cm <= 300)) not valid;

create or replace function public.is_body_composition_physically_possible(
  p_weight_kg numeric,
  p_bmi numeric,
  p_body_fat_pct numeric,
  p_muscle_mass_pct numeric,
  p_visceral_fat numeric,
  p_body_water_pct numeric,
  p_bone_mass_kg numeric,
  p_bmr_kcal integer
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select (p_weight_kg is null or (p_weight_kg > 0 and p_weight_kg <= 1000))
     and (p_bmi is null or (p_bmi > 0 and p_bmi <= 500))
     and (p_body_fat_pct is null or p_body_fat_pct between 0 and 100)
     and (p_muscle_mass_pct is null or p_muscle_mass_pct between 0 and 100)
     and (p_visceral_fat is null or p_visceral_fat >= 0)
     and (p_body_water_pct is null or p_body_water_pct between 0 and 100)
     and (p_bone_mass_kg is null or (p_bone_mass_kg > 0 and p_bone_mass_kg <= 100))
     and (p_bmr_kcal is null or (p_bmr_kcal > 0 and p_bmr_kcal <= 20000));
$$;

revoke all on function public.is_body_composition_physically_possible(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer
) from public, anon;
grant execute on function public.is_body_composition_physically_possible(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer
) to authenticated, service_role;

alter table public.body_composition
  drop constraint if exists body_composition_physical_possibility_ck;
alter table public.body_composition
  add constraint body_composition_physical_possibility_ck
  check (public.is_body_composition_physically_possible(
    weight_kg, bmi, body_fat_pct, muscle_mass_pct, visceral_fat,
    body_water_pct, bone_mass_kg, bmr_kcal
  )) not valid;

create or replace function public.are_body_measurements_physically_possible(
  p_waist_cm numeric,
  p_hip_cm numeric,
  p_arm_cm numeric,
  p_thigh_cm numeric,
  p_calf_cm numeric,
  p_neck_cm numeric,
  p_chest_cm numeric
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select (p_waist_cm is null or (p_waist_cm > 0 and p_waist_cm <= 500))
     and (p_hip_cm is null or (p_hip_cm > 0 and p_hip_cm <= 500))
     and (p_arm_cm is null or (p_arm_cm > 0 and p_arm_cm <= 500))
     and (p_thigh_cm is null or (p_thigh_cm > 0 and p_thigh_cm <= 500))
     and (p_calf_cm is null or (p_calf_cm > 0 and p_calf_cm <= 500))
     and (p_neck_cm is null or (p_neck_cm > 0 and p_neck_cm <= 500))
     and (p_chest_cm is null or (p_chest_cm > 0 and p_chest_cm <= 500));
$$;

revoke all on function public.are_body_measurements_physically_possible(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric
) from public, anon;
grant execute on function public.are_body_measurements_physically_possible(
  numeric, numeric, numeric, numeric, numeric, numeric, numeric
) to authenticated, service_role;

alter table public.body_measurements
  drop constraint if exists body_measurements_physical_possibility_ck;
alter table public.body_measurements
  add constraint body_measurements_physical_possibility_ck
  check (public.are_body_measurements_physically_possible(
    waist_cm, hip_cm, arm_cm, thigh_cm, calf_cm, neck_cm, chest_cm
  )) not valid;

-- ── 3) Estoque: domínio válido e refill atômico/auditado ────────────────────
alter table public.medications
  drop constraint if exists medications_stock_nonnegative_ck;
alter table public.medications
  add constraint medications_stock_nonnegative_ck
  check (stock_count is null or stock_count >= 0) not valid;

alter table public.medications
  drop constraint if exists medications_package_size_positive_ck;
alter table public.medications
  add constraint medications_package_size_positive_ck
  check (package_size is null or package_size > 0) not valid;

alter table public.medications
  drop constraint if exists medications_stock_threshold_nonnegative_ck;
alter table public.medications
  add constraint medications_stock_threshold_nonnegative_ck
  check (stock_low_threshold_days >= 0) not valid;

create or replace function public.refill_medication_stock(
  p_medication_id uuid,
  p_units integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  v_patient_id uuid;
  v_new_stock integer;
begin
  if uid is null then
    raise exception 'Não autenticado.' using errcode = 'insufficient_privilege';
  end if;

  if p_medication_id is null or p_units is null or p_units <= 0 or p_units > 100000 then
    raise exception 'Quantidade de reposição inválida.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- A soma ocorre no próprio UPDATE. O lock de linha do PostgreSQL serializa
  -- refills concorrentes e elimina o read-modify-write do cliente.
  update public.medications
     set stock_count = coalesce(stock_count, 0) + p_units,
         stock_last_updated_at = now()
   where id = p_medication_id
     and patient_id = uid
  returning patient_id, stock_count into v_patient_id, v_new_stock;

  if not found then
    raise exception 'Medicamento não encontrado para o usuário autenticado.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Fail-closed: se a auditoria falhar, a exceção reverte também o UPDATE.
  insert into public.audit_log
    (actor_id, patient_id, action, resource_type, resource_id, metadata)
  values
    (
      uid,
      v_patient_id,
      'update',
      'medication_stock_refill',
      p_medication_id,
      jsonb_build_object(
        'units_added', p_units,
        'new_stock_count', v_new_stock
      )
    );

  return v_new_stock;
end;
$$;

comment on function public.refill_medication_stock(uuid, integer) is
  'Reposição atômica de estoque pelo titular; audita na mesma transação e evita lost update.';

revoke all on function public.refill_medication_stock(uuid, integer)
  from public, anon;
grant execute on function public.refill_medication_stock(uuid, integer)
  to authenticated;
