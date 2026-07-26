/** Helpers puros de domínio — sem I/O, fáceis de testar e usar em web + mobile. */

import type { Vital, DiaryEntry, DrugInteraction } from '../types/db';

/** Percentual de adesão (0-100) a partir de tomadas registradas vs. previstas. */
export function computeAdherence(taken: number, expected: number): number | null {
  if (expected <= 0) return null;
  return Math.min(100, Math.round((taken / expected) * 100));
}

/**
 * Cruza a lista de medicamentos do usuário com a base de interações.
 * Casamento case-insensitive por substring (genérico). Retorna as interações encontradas.
 */
export function findInteractions(
  medicationNames: string[],
  base: DrugInteraction[],
): DrugInteraction[] {
  const norm = medicationNames.map((n) => n.toLowerCase());
  const has = (drug: string) => norm.some((n) => n.includes(drug.toLowerCase()));
  return base.filter((i) => has(i.drug_a) && has(i.drug_b));
}

/**
 * Procura correspondência textual entre o nome de um medicamento e as
 * substâncias das alergias registradas. É uma barreira adicional de segurança,
 * não uma validação farmacológica completa.
 */
export function findMedicationAllergyNameMatch<T extends { substance: string }>(
  medicationName: string,
  allergies: T[],
): T | undefined {
  const normalizedMedication = medicationName.trim().toLocaleLowerCase('pt-BR');
  if (!normalizedMedication) return undefined;

  return allergies.find((allergy) => {
    const substance = allergy.substance.trim().toLocaleLowerCase('pt-BR');
    return (
      substance.length > 0 &&
      (normalizedMedication.includes(substance) || substance.includes(normalizedMedication))
    );
  });
}

/**
 * Classifica a pressão arterial em faixas de REFERÊNCIA (não é diagnóstico).
 * Sempre acompanhar de disclaimer: só o médico interpreta com o contexto completo.
 * Referência geral adulto: ok < 130/85; atenção 130-139 ou 85-89; acima ≥ 140 ou ≥ 90.
 */
export type ClinicalZone = 'ok' | 'attention' | 'alert';

export function classifyBloodPressure(
  systolic: number,
  diastolic: number,
): { zone: ClinicalZone; label: string } {
  if (systolic >= 140 || diastolic >= 90) {
    return { zone: 'alert', label: 'Acima da faixa de referência' };
  }
  if (systolic >= 130 || diastolic >= 85) {
    return { zone: 'attention', label: 'Atenção' };
  }
  return { zone: 'ok', label: 'Dentro da faixa de referência' };
}

/**
 * Médias de humor e energia (1-5) dos últimos `days` dias do diário, e o
 * "bem-estar" como média das duas. Retorna null quando não há registros.
 */
export function moodEnergyAverage(
  entries: Pick<DiaryEntry, 'mood' | 'energy' | 'entry_date'>[],
  days = 7,
  now: Date = new Date(),
): { mood: number | null; energy: number | null; wellbeing: number | null } {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  const recent = entries.filter((e) => new Date(e.entry_date) >= cutoff);
  const avg = (nums: number[]) =>
    nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

  const moods = recent.map((e) => e.mood).filter((v): v is number => v != null);
  const energies = recent.map((e) => e.energy).filter((v): v is number => v != null);
  const mood = avg(moods);
  const energy = avg(energies);
  const combined = [...moods, ...energies];
  return { mood, energy, wellbeing: avg(combined) };
}

/** Idade em anos a partir da data de nascimento, relativa a `now`. */
export function calculateAge(dateOfBirth: Date | string, now: Date = new Date()): number {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  if (Number.isNaN(dob.getTime())) throw new Error('Data de nascimento inválida.');
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/** É menor de idade (< 18 anos) na data de referência? */
export function isMinor(dateOfBirth: Date | string, now: Date = new Date()): boolean {
  return calculateAge(dateOfBirth, now) < 18;
}

/**
 * Formata um sinal vital para exibição (ex.: "120/80 mmHg", "98 mg/dL").
 * Não interpreta nem classifica — apenas apresenta.
 */
export function formatVital(vital: Pick<Vital, 'type' | 'value_primary' | 'value_secondary' | 'unit'>): string {
  if (vital.type === 'blood_pressure' && vital.value_secondary != null) {
    return `${vital.value_primary}/${vital.value_secondary} ${vital.unit}`;
  }
  return `${vital.value_primary} ${vital.unit}`;
}

/** Caminho de armazenamento de exame: sempre prefixado pelo id do dono. */
export function buildExamStoragePath(ownerId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.-]/g, '_');
  return `${ownerId}/${safe}`;
}

/** Extrai o id do dono a partir do storage_path ("<ownerId>/arquivo"). */
export function ownerIdFromStoragePath(path: string): string | null {
  const first = path.split('/')[0];
  return first && first.length > 0 ? first : null;
}
