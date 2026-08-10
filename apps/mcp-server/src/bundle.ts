/**
 * Formato do pacote pró-FHIR devolvido por GET /api/v1/me (RPC api_me_bundle_v2).
 * Cada seção só vem quando o token tem o escopo correspondente — ausência de
 * seção significa escopo faltando, nunca "prontuário vazio".
 */

export interface Patient {
  resourceType: 'Patient';
  name: string | null;
  birthDate: string | null;
  gender: string | null;
  bloodType: string | null;
}

export interface MedicationStatement {
  resourceType: 'MedicationStatement';
  name: string;
  dosage: string | null;
  form: string | null;
  frequency: string | null;
  status: 'active' | 'inactive';
}

export interface Observation {
  resourceType: 'Observation';
  type: string;
  value: number | null;
  valueSecondary: number | null;
  unit: string | null;
  effectiveDateTime: string;
}

export interface AllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  substance: string;
  criticality: string | null;
  reaction: string | null;
}

export interface DiagnosticReport {
  resourceType: 'DiagnosticReport';
  title: string;
  category: string | null;
  effectiveDateTime: string | null;
  status: string | null;
}

export interface MeBundle {
  resourceType: 'Bundle';
  generatedAt: string;
  patient?: Patient;
  medications?: MedicationStatement[];
  vitals?: Observation[];
  allergies?: AllergyIntolerance[];
  exams?: DiagnosticReport[];
}

export const VITAL_TYPES = [
  'blood_pressure',
  'glucose',
  'weight',
  'heart_rate',
  'temperature',
  'oxygen_saturation',
] as const;

/** Regra ética do produto: o app registra e organiza; interpretar é do médico. */
export const NOTA_INFORMATIVA =
  'Dados autorrelatados/registrados pelo titular, fornecidos apenas para consulta. ' +
  'Não interprete como diagnóstico nem sugira prescrição; oriente a conversar com o médico.';

export function mensagemEscopoFaltando(escopo: string): string {
  return (
    `O token não cobre esta seção (escopo ${escopo} ausente). ` +
    'Peça ao titular para gerar um novo token em Configurações → Acesso de IA marcando esse escopo.'
  );
}

export function filtraVitais(
  vitais: Observation[],
  opts: { tipo?: string; dias?: number; limite?: number },
): Observation[] {
  let lista = vitais;
  if (opts.tipo) lista = lista.filter((v) => v.type === opts.tipo);
  if (opts.dias && opts.dias > 0) {
    const corte = Date.now() - opts.dias * 86_400_000;
    lista = lista.filter((v) => Date.parse(v.effectiveDateTime) >= corte);
  }
  lista = [...lista].sort(
    (a, b) => Date.parse(b.effectiveDateTime) - Date.parse(a.effectiveDateTime),
  );
  return lista.slice(0, opts.limite ?? 30);
}

export function examesRecentes(exames: DiagnosticReport[], limite: number): DiagnosticReport[] {
  return [...exames]
    .sort(
      (a, b) =>
        (b.effectiveDateTime ? Date.parse(b.effectiveDateTime) : 0) -
        (a.effectiveDateTime ? Date.parse(a.effectiveDateTime) : 0),
    )
    .slice(0, limite);
}
