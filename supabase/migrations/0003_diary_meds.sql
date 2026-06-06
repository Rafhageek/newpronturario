-- ============================================================================
-- VidaLog — Migration 0003
-- Diário (dor) + Medicamentos (frequência/horários/prescritor) + interações
-- ============================================================================

-- ── diary_entries: dor (0-10) ───────────────────────────────────────────────
alter table public.diary_entries
  add column if not exists pain smallint check (pain between 0 and 10);

-- ── medications: frequência, horários, unidade, prescritor ──────────────────
alter table public.medications
  add column if not exists frequency medication_frequency not null default 'daily',
  add column if not exists times time[] not null default '{}',
  add column if not exists unit text,
  add column if not exists prescriber text;
comment on column public.medications.prescriber is 'PHI: care_provider';

-- ── medication_intakes: motivo de pular ─────────────────────────────────────
alter table public.medication_intakes
  add column if not exists skip_reason text;

-- ── Interações medicamentosas (dado de referência, não-PHI) ─────────────────
create type interaction_severity as enum ('minor', 'moderate', 'major');

create table public.drug_interactions (
  id          uuid primary key default gen_random_uuid(),
  drug_a      text not null,
  drug_b      text not null,
  severity    interaction_severity not null default 'moderate',
  description text not null,
  created_at  timestamptz not null default now(),
  constraint drug_interactions_pair_unique unique (drug_a, drug_b)
);
create index drug_interactions_drug_a_idx on public.drug_interactions (drug_a);
create index drug_interactions_drug_b_idx on public.drug_interactions (drug_b);

-- Referência: legível por qualquer usuário autenticado; sem escrita pelo cliente.
alter table public.drug_interactions enable row level security;
create policy "drug_interactions_read" on public.drug_interactions
  for select to authenticated using (true);

-- ── Seed curado (~12 pares comuns) — NÃO é o DDInter completo ────────────────
-- Nomes em minúsculas (genérico) para casamento case-insensitive no cliente.
insert into public.drug_interactions (drug_a, drug_b, severity, description) values
  ('varfarina', 'aspirina', 'major', 'Risco aumentado de sangramento.'),
  ('varfarina', 'amiodarona', 'major', 'Amiodarona potencializa a varfarina — risco de sangramento.'),
  ('varfarina', 'ibuprofeno', 'major', 'AINEs aumentam o risco de sangramento com varfarina.'),
  ('fluoxetina', 'tramadol', 'major', 'Risco de síndrome serotoninérgica.'),
  ('sinvastatina', 'claritromicina', 'major', 'Risco elevado de miopatia/rabdomiólise.'),
  ('clopidogrel', 'omeprazol', 'moderate', 'Omeprazol pode reduzir o efeito do clopidogrel.'),
  ('losartana', 'espironolactona', 'moderate', 'Risco de hipercalemia (potássio elevado).'),
  ('losartana', 'ibuprofeno', 'moderate', 'AINEs reduzem o efeito anti-hipertensivo e afetam os rins.'),
  ('captopril', 'espironolactona', 'moderate', 'Risco de hipercalemia.'),
  ('digoxina', 'furosemida', 'moderate', 'Hipocalemia pela furosemida aumenta toxicidade da digoxina.'),
  ('metformina', 'álcool', 'moderate', 'Álcool aumenta o risco de acidose láctica.'),
  ('aspirina', 'ibuprofeno', 'minor', 'Ibuprofeno pode reduzir o efeito cardioprotetor da aspirina.')
on conflict (drug_a, drug_b) do nothing;
