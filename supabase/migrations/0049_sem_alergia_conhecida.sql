-- ============================================================================
-- 0049 — "Sem alergia conhecida": a declaração ATIVA do paciente
-- Pedido do cliente (Sr. Jairo, 2026-08): "ter opção do paciente/usuário
-- colocar SEM ALERGIA".
--
-- POR QUE ISSO NÃO É UM CAMPO EM BRANCO
-- Em prontuário, "nenhuma alergia conhecida" é uma AFIRMAÇÃO de quem foi
-- perguntado, e é um fato diferente de "o campo está vazio porque ninguém
-- perguntou". Hoje o app só sabe dizer "Nenhuma alergia registrada" — ambíguo
-- exatamente onde a ambiguidade custa caro: o cartão de emergência lido pelo
-- socorrista e o relatório A4 que vai à mão de quem prescreve. É a mesma regra
-- de veracidade de packages/core/src/utils/estado-secao.ts (só resposta
-- confirmada autoriza afirmar ausência), e o mesmo defeito que em 04/08 fez o
-- QR imprimir "Alergias graves: nenhuma" quando a CONSULTA FALHAVA.
--
-- POR QUE timestamptz, E NÃO boolean
-- Um `true` não diz QUANDO a pessoa afirmou. Declaração de dois anos atrás vale
-- menos que a de hoje — e é a data que permite à tela escrever "declarado em 12
-- de agosto de 2026" e a quem lê decidir se pergunta de novo. Um booleano não
-- carrega essa informação, e prontuário sem data é anotação solta.
--   null      = nunca declarou (ausência de dado; NÃO significa "não tem")
--   preenchida= declarou naquele instante
--
-- RLS — NADA É AFROUXADO
-- A coluna entra em public.profiles e herda as políticas que já existem:
-- `profiles_select_self` (0032) e `profiles_update_self` (0001) — só o dono lê
-- e só o dono escreve. Nenhuma política nova, nenhuma política alterada.
-- A projeção de cuidador de `get_accessible_profile` (0032) ganha o campo pelo
-- mesmo motivo que já entrega `emergency_note`: quem cuida enxerga a lista de
-- alergias (policy `allergies_select`, 0002) e precisa distinguir "declarou que
-- não tem" de "ninguém preencheu" — sem isso o cuidador vê o estado ambíguo
-- justamente na tela que existe para desfazer a ambiguidade. Nenhuma coluna
-- nova de PII/token é exposta ali.
--
-- COERÊNCIA — o ponto clínico desta migration
-- "Sem alergia conhecida" NÃO pode coexistir com uma alergia registrada. Um
-- prontuário que afirma as duas coisas é pior que qualquer uma delas sozinha.
-- O app web desfaz a declaração ao cadastrar a primeira alergia, mas o app não
-- é a única porta (mobile, importação, Edge Function), então a garantia mora
-- aqui, em dois triggers que fecham os dois lados da contradição:
--   1. cadastrou alergia  → a declaração cai (a alergia SEMPRE vence);
--   2. declarou ausência com alergia na lista → o UPDATE é recusado.
-- Bloquear o INSERT da alergia seria a escolha errada: nunca se impede o
-- registro de uma alergia para preservar uma afirmação de ausência. Quem cede
-- é a afirmação.
--
-- IDEMPOTENTE. NÃO aplicada ainda — quem aplica é o Rafael, via Management API.
-- O código do app tolera a coluna ausente, então a ordem deploy × migration não
-- quebra a tela (ver apps/web/src/components/profile/allergies-section.tsx).
-- ============================================================================

alter table public.profiles
  add column if not exists sem_alergia_conhecida_em timestamptz;

comment on column public.profiles.sem_alergia_conhecida_em is
  'PHI: instante em que o paciente declarou NÃO TER alergia conhecida. Null = nunca declarou — o que não é o mesmo que "não tem".';

-- ----------------------------------------------------------------------------
-- 1) Cadastrou alergia → a declaração de ausência cai.
-- SECURITY DEFINER porque o trigger precisa valer para qualquer porta de
-- entrada (inclusive uma futura importação por service_role), e não depender de
-- quem inseriu ter UPDATE em profiles. O efeito é estreito: zera UMA coluna, do
-- perfil DONO daquela alergia, e só quando havia declaração para derrubar.
-- ----------------------------------------------------------------------------
create or replace function public.clear_no_known_allergy_declaration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set sem_alergia_conhecida_em = null
   where id = new.patient_id
     and sem_alergia_conhecida_em is not null;
  return new;
end;
$$;

revoke all on function public.clear_no_known_allergy_declaration() from public, anon, authenticated;

drop trigger if exists allergies_clear_no_known_allergy on public.allergies;
create trigger allergies_clear_no_known_allergy
  after insert on public.allergies
  for each row execute function public.clear_no_known_allergy_declaration();

-- ----------------------------------------------------------------------------
-- 2) Declarar ausência com alergia registrada → recusado.
-- O `is distinct from` faz a checagem custar zero em todo UPDATE de perfil que
-- não mexe nesta coluna (nome, telefone, endereço). SECURITY DEFINER para
-- contar TODAS as alergias do paciente, e não só as visíveis a quem escreve.
-- errcode `check_violation` (23514) chega ao PostgREST como 400 com a mensagem
-- abaixo — que é redigida para ser lida pelo paciente, não pelo log.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_no_known_allergy_coherence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sem_alergia_conhecida_em is not null
     and new.sem_alergia_conhecida_em is distinct from old.sem_alergia_conhecida_em
     and exists (select 1 from public.allergies a where a.patient_id = new.id)
  then
    raise exception 'Há alergia registrada neste prontuário: não é possível declarar "sem alergia conhecida".'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_no_known_allergy_coherence() from public, anon, authenticated;

drop trigger if exists profiles_no_known_allergy_coherence on public.profiles;
create trigger profiles_no_known_allergy_coherence
  before update on public.profiles
  for each row execute function public.enforce_no_known_allergy_coherence();

-- ----------------------------------------------------------------------------
-- 3) Projeção de cuidador — cópia FIEL da 0032, mais um campo.
-- O ramo do dono (`uid = p_profile_id`) devolve `to_jsonb(p)` e já enxerga a
-- coluna nova sem alteração nenhuma; o ramo do cuidador é uma lista explícita,
-- e por isso precisa ser reescrito. Nada mais mudou: mesmas checagens, mesma
-- ordem, mesmos campos, mesma cláusula de acesso.
-- ----------------------------------------------------------------------------
create or replace function public.get_accessible_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  result jsonb;
begin
  if uid is null then
    raise exception 'Não autenticado.' using errcode = 'insufficient_privilege';
  end if;

  if uid = p_profile_id then
    select to_jsonb(p) into result
      from public.profiles p
     where p.id = p_profile_id;
    return result;
  end if;

  if not public.is_accepted_caregiver(p_profile_id) then
    return null;
  end if;

  select jsonb_build_object(
           'id', p.id,
           'full_name', p.full_name,
           'date_of_birth', p.date_of_birth,
           'biological_sex', p.biological_sex,
           'blood_type', p.blood_type,
           'height_cm', p.height_cm,
           'guardian_id', p.guardian_id,
           'is_minor', p.is_minor,
           'emergency_note', p.emergency_note,
           'sem_alergia_conhecida_em', p.sem_alergia_conhecida_em,
           'created_at', p.created_at,
           'updated_at', p.updated_at
         )
    into result
    from public.profiles p
   where p.id = p_profile_id;

  return result;
end;
$$;

revoke all on function public.get_accessible_profile(uuid) from public, anon;
grant execute on function public.get_accessible_profile(uuid) to authenticated;
