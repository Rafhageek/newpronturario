-- ============================================================================
-- HubPatients — Migration 0034
-- Linha do tempo clínica unificada, somente leitura e permissionada.
--
-- A RPC mantém a origem e a data de cada registro. Ela não calcula diagnóstico,
-- normalidade, gravidade ou relação causal entre eventos.
-- ============================================================================

create or replace function public.clinical_timeline(
  p_patient_id uuid,
  p_limit integer default 25,
  p_before_at timestamptz default null,
  p_before_key text default null
)
returns table (
  event_id uuid,
  event_key text,
  event_type text,
  source text,
  occurred_at timestamptz,
  title text,
  summary text,
  status text,
  date_only boolean,
  has_more boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_is_owner boolean;
  v_can_vitals boolean;
  v_can_diary boolean;
  v_can_exams boolean;
  v_can_medications boolean;
  v_can_appointments boolean;
  v_returned integer := 0;
begin
  if v_actor is null or p_patient_id is null then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  v_is_owner := v_actor = p_patient_id;
  v_can_vitals := v_is_owner
    or public.caregiver_has_permission(p_patient_id, 'ver_vitais');
  v_can_diary := v_is_owner
    or public.caregiver_has_permission(p_patient_id, 'diary')
    or public.caregiver_has_permission(p_patient_id, 'ver_vitais');
  v_can_exams := v_is_owner
    or public.caregiver_has_permission(p_patient_id, 'ver_exames');
  v_can_medications := v_is_owner
    or public.caregiver_has_permission(p_patient_id, 'medications')
    or public.caregiver_has_permission(p_patient_id, 'registrar_tomada');
  v_can_appointments := v_is_owner
    or public.caregiver_has_permission(p_patient_id, 'agendar_consulta');

  if not (
    v_can_vitals
    or v_can_diary
    or v_can_exams
    or v_can_medications
    or v_can_appointments
  ) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  if (p_before_at is null) <> (p_before_key is null) then
    raise exception 'Cursor inválido' using errcode = '22023';
  end if;

  return query
  with events as (
    select
      v.id as event_id,
      'vital:' || v.id::text as event_key,
      'vital'::text as event_type,
      'vitals'::text as source,
      v.measured_at as occurred_at,
      case v.type::text
        when 'blood_pressure' then 'Pressão arterial'
        when 'glucose' then 'Glicemia'
        when 'weight' then 'Peso'
        when 'heart_rate' then 'Frequência cardíaca'
        when 'temperature' then 'Temperatura'
        when 'oxygen_saturation' then 'Saturação de oxigênio'
        else 'Sinal vital'
      end as title,
      concat_ws(
        ' ',
        trim(trailing '.' from trim(trailing '0' from v.value_primary::text)),
        case
          when v.value_secondary is not null
            then '/ ' || trim(trailing '.' from trim(trailing '0' from v.value_secondary::text))
          else null
        end,
        v.unit
      ) as summary,
      null::text as status,
      false as date_only
    from public.vitals v
    where v.patient_id = p_patient_id and v_can_vitals

    union all

    select
      d.id,
      'diary:' || d.id::text,
      'diary',
      'diary_entries',
      (d.entry_date + time '12:00') at time zone 'UTC',
      'Registro no diário',
      coalesce(
        nullif(d.note, ''),
        nullif(array_to_string(d.symptoms, ', '), ''),
        'Humor, energia ou sintomas registrados'
      ),
      null::text,
      true
    from public.diary_entries d
    where d.patient_id = p_patient_id and v_can_diary

    union all

    select
      e.id,
      'exam:' || e.id::text,
      'exam',
      'exams',
      coalesce((e.exam_date + time '12:00') at time zone 'UTC', e.created_at),
      e.title,
      concat_ws(' · ', nullif(e.lab_name, ''), e.category::text),
      e.status::text,
      e.exam_date is not null
    from public.exams e
    where e.patient_id = p_patient_id and v_can_exams

    union all

    select
      m.id,
      'medication:' || m.id::text,
      'medication',
      'medications',
      coalesce((m.started_at + time '12:00') at time zone 'UTC', m.created_at),
      m.name,
      concat_ws(' · ', nullif(m.dosage, ''), nullif(m.unit, ''), m.frequency::text),
      case when m.active then 'active' else 'inactive' end,
      m.started_at is not null
    from public.medications m
    where m.patient_id = p_patient_id and v_can_medications

    union all

    select
      mi.id,
      'medication_intake:' || mi.id::text,
      'medication_intake',
      'medication_intakes',
      coalesce(mi.taken_at, mi.scheduled_for, mi.created_at),
      'Registro de medicamento',
      m.name,
      mi.status::text,
      false
    from public.medication_intakes mi
    join public.medications m
      on m.id = mi.medication_id and m.patient_id = mi.patient_id
    where mi.patient_id = p_patient_id and v_can_medications

    union all

    select
      a.id,
      'appointment:' || a.id::text,
      'appointment',
      'appointments',
      a.scheduled_at,
      'Consulta com ' || a.doctor_name,
      concat_ws(' · ', nullif(a.specialty, ''), a.kind::text),
      a.status::text,
      false
    from public.appointments a
    where a.patient_id = p_patient_id and v_can_appointments

    union all

    select
      c.id,
      'condition:' || c.id::text,
      'condition',
      'conditions',
      coalesce((c.diagnosed_at + time '12:00') at time zone 'UTC', c.created_at),
      c.name,
      nullif(c.cid10_code, ''),
      c.status::text,
      c.diagnosed_at is not null
    from public.conditions c
    where c.patient_id = p_patient_id and v_is_owner

    union all

    select
      a.id,
      'allergy:' || a.id::text,
      'allergy',
      'allergies',
      a.created_at,
      a.substance,
      nullif(a.reaction, ''),
      a.severity::text,
      false
    from public.allergies a
    where a.patient_id = p_patient_id and v_is_owner

    union all

    select
      s.id,
      'surgery:' || s.id::text,
      'surgery',
      'surgeries',
      coalesce((s.performed_at + time '12:00') at time zone 'UTC', s.created_at),
      s.procedure,
      nullif(s.hospital, ''),
      null::text,
      s.performed_at is not null
    from public.surgeries s
    where s.patient_id = p_patient_id and v_is_owner

    union all

    select
      va.id,
      'vaccination:' || va.id::text,
      'vaccination',
      'vaccinations',
      coalesce((va.applied_at + time '12:00') at time zone 'UTC', va.created_at),
      va.vaccine_name,
      nullif(va.dose_label, ''),
      case when va.applied_at is null then 'planned' else 'applied' end,
      va.applied_at is not null
    from public.vaccinations va
    where va.patient_id = p_patient_id and v_is_owner
  ),
  filtered as (
    select *
    from events
    where
      p_before_at is null
      or (occurred_at, event_key) < (p_before_at, p_before_key)
    order by occurred_at desc, event_key desc
    limit v_limit + 1
  )
  select
    f.event_id,
    f.event_key,
    f.event_type,
    f.source,
    f.occurred_at,
    f.title,
    nullif(f.summary, ''),
    f.status,
    f.date_only,
    (select count(*) > v_limit from filtered)
  from filtered f
  order by f.occurred_at desc, f.event_key desc
  limit v_limit;

  get diagnostics v_returned = row_count;

  insert into public.audit_log
    (actor_id, patient_id, action, resource_type, metadata)
  values
    (
      v_actor,
      p_patient_id,
      'read',
      'clinical_timeline',
      jsonb_build_object('returned_count', v_returned, 'page_limit', v_limit)
    );
end;
$$;

comment on function public.clinical_timeline(uuid, integer, timestamptz, text) is
  'PHI: timeline clínica somente leitura; acesso por titular ou cuidador conforme permissões.';

revoke all on function public.clinical_timeline(uuid, integer, timestamptz, text)
  from public, anon;
grant execute on function public.clinical_timeline(uuid, integer, timestamptz, text)
  to authenticated;
