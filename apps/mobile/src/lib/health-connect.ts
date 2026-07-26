import { Platform } from 'react-native';
import {
  initialize,
  getSdkStatus,
  getGrantedPermissions,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
  type Permission,
  type ReadRecordsOptions,
} from 'react-native-health-connect';
import type { VitalType } from '@hubpatients/core';
import { logger } from '@/lib/logger';

/**
 * Camada única de acesso ao Health Connect (Android). Regras do projeto:
 *
 *  • SOMENTE LEITURA. O app nunca escreve dado de saúde de volta no Health
 *    Connect — não há `insertRecords` aqui, e não deve haver.
 *  • BLINDAGEM TOTAL. Nenhuma função abaixo propaga erro: aparelho sem Health
 *    Connect, provider desatualizado, permissão negada ou falha do SDK viram
 *    um estado ("indisponível", lista vazia), nunca uma exceção que derrube a
 *    tela. Quem consome só precisa tratar o estado.
 *  • MINIMIZAÇÃO (LGPD art. 6º, III). A permissão é pedida por TIPO, só do que
 *    o usuário escolheu importar — nunca o pacote inteiro "por precaução".
 *    Cada tipo carrega o `purpose` mostrado ao usuário antes de conceder.
 *  • O dado lido é REGISTRO, não diagnóstico: nada aqui classifica valor.
 *
 * Nomes reais confirmados em node_modules/react-native-health-connect@3.5.3
 * (lib/typescript/types/{records,results,base}.types.d.ts):
 *   Weight            → { time, weight: MassResult }        → weight.inKilograms
 *   BloodPressure     → { time, systolic/diastolic: PressureResult }
 *                                                           → inMillimetersOfMercury
 *   BloodGlucose      → { time, level }                     → level.inMilligramsPerDeciliter
 *   HeartRate         → { startTime, endTime, samples[] }   → samples[].beatsPerMinute
 *   OxygenSaturation  → { time, percentage: number }        → já em %
 *   SleepSession      → { startTime, endTime, stages? }     → duração derivada
 */

// ─────────────────────────── Tipos públicos ───────────────────────────

export type HealthMetric =
  | 'weight'
  | 'blood_pressure'
  | 'glucose'
  | 'heart_rate'
  | 'oxygen_saturation'
  | 'sleep';

type HealthRecordType =
  | 'Weight'
  | 'BloodPressure'
  | 'BloodGlucose'
  | 'HeartRate'
  | 'OxygenSaturation'
  | 'SleepSession';

export type HealthMetricMeta = {
  metric: HealthMetric;
  /** Nome REAL do record type no Health Connect. */
  recordType: HealthRecordType;
  label: string;
  unit: string;
  /** Por que pedimos este dado — mostrado ao usuário antes da permissão (LGPD). */
  purpose: string;
  /** Tipo correspondente na tabela `vitals`; null = o prontuário não guarda. */
  vitalType: VitalType | null;
};

export type HealthConnectStatus =
  /** Sem Health Connect utilizável (iOS, app não instalado, provider antigo, erro). */
  | { kind: 'unavailable'; reason: 'platform' | 'not-installed' | 'update-required' | 'error' }
  /** Health Connect presente, mas nenhum dos nossos tipos foi autorizado ainda. */
  | { kind: 'needs-permission'; granted: [] }
  /** Health Connect presente e ao menos um tipo autorizado. */
  | { kind: 'ready'; granted: HealthMetric[] };

/** Leitura já normalizada para as unidades do app (kg, mmHg, mg/dL, bpm, %, h). */
export type HealthReading = {
  metric: HealthMetric;
  /** ISO. Para intervalos (FC, sono) é o início do registro. */
  measuredAt: string;
  primary: number;
  /** Diastólica na pressão; null nos demais. */
  secondary: number | null;
  unit: string;
  /** Pacote do app que gravou o dado no Health Connect (procedência). */
  origin: string | null;
  /** >1 quando o valor resume várias amostras do mesmo registro (só FC). */
  sampleCount: number;
};

export type HealthReadResult = {
  readings: HealthReading[];
  /** Tipos que falharam ou não estão autorizados — a UI avisa sem quebrar. */
  failed: HealthMetric[];
};

// ─────────────────────────── Catálogo ───────────────────────────

export const HEALTH_METRICS: Record<HealthMetric, HealthMetricMeta> = {
  weight: {
    metric: 'weight',
    recordType: 'Weight',
    label: 'Peso',
    unit: 'kg',
    purpose: 'Acompanhar a evolução do seu peso sem redigitar o que a balança já registrou.',
    vitalType: 'weight',
  },
  blood_pressure: {
    metric: 'blood_pressure',
    recordType: 'BloodPressure',
    label: 'Pressão arterial',
    unit: 'mmHg',
    purpose: 'Guardar as medições do seu aparelho de pressão junto do resto do prontuário.',
    vitalType: 'blood_pressure',
  },
  glucose: {
    metric: 'glucose',
    recordType: 'BloodGlucose',
    label: 'Glicemia',
    unit: 'mg/dL',
    purpose: 'Reunir as medições do glicosímetro no histórico que você leva ao médico.',
    vitalType: 'glucose',
  },
  heart_rate: {
    metric: 'heart_rate',
    recordType: 'HeartRate',
    label: 'Frequência cardíaca',
    unit: 'bpm',
    purpose: 'Registrar os batimentos medidos pelo relógio ou pela pulseira.',
    vitalType: 'heart_rate',
  },
  oxygen_saturation: {
    metric: 'oxygen_saturation',
    recordType: 'OxygenSaturation',
    label: 'Saturação de oxigênio',
    unit: '%',
    purpose: 'Guardar as medições do oxímetro no seu histórico.',
    vitalType: 'oxygen_saturation',
  },
  sleep: {
    metric: 'sleep',
    recordType: 'SleepSession',
    label: 'Sono',
    unit: 'h',
    purpose: 'Mostrar quantas horas você dormiu no período (o prontuário ainda não guarda sono).',
    vitalType: null,
  },
};

/** Ordem estável para a UI. */
export const HEALTH_METRIC_ORDER: HealthMetric[] = [
  'weight',
  'blood_pressure',
  'glucose',
  'heart_rate',
  'oxygen_saturation',
  'sleep',
];

const RECORD_TO_METRIC: Record<HealthRecordType, HealthMetric> = {
  Weight: 'weight',
  BloodPressure: 'blood_pressure',
  BloodGlucose: 'glucose',
  HeartRate: 'heart_rate',
  OxygenSaturation: 'oxygen_saturation',
  SleepSession: 'sleep',
};

/**
 * Faixas de plausibilidade. NÃO classificam nada (não existe "alto"/"baixo"
 * aqui): servem só para descartar lixo de sensor — um 0 kg ou 900 bpm que
 * entraria no prontuário como se fosse medição.
 */
const PLAUSIBLE: Record<HealthMetric, { min: number; max: number }> = {
  weight: { min: 2, max: 400 },
  blood_pressure: { min: 30, max: 300 },
  glucose: { min: 10, max: 1000 },
  heart_rate: { min: 20, max: 300 },
  oxygen_saturation: { min: 50, max: 100 },
  sleep: { min: 0.1, max: 24 },
};

/** Teto por tipo numa leitura — evita puxar milhares de amostras de relógio. */
const MAX_PER_METRIC = 200;

// ─────────────────────────── Infra interna ───────────────────────────

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const round = (n: number, decimals = 0): number => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

function plausible(metric: HealthMetric, value: number): boolean {
  const range = PLAUSIBLE[metric];
  return value >= range.min && value <= range.max;
}

/**
 * Prepara o SDK. Devolve o motivo da indisponibilidade em vez de lançar.
 * iOS nem chega a tocar no módulo nativo (Health Connect é só Android).
 */
async function prepare(): Promise<
  { ok: true } | { ok: false; reason: 'platform' | 'not-installed' | 'update-required' | 'error' }
> {
  if (Platform.OS !== 'android') return { ok: false, reason: 'platform' };
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return { ok: false, reason: 'update-required' };
    }
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { ok: false, reason: 'not-installed' };
    }
    const ready = await initialize();
    return ready ? { ok: true } : { ok: false, reason: 'error' };
  } catch (e) {
    logger.warn('health-connect: falha ao preparar o SDK', {
      action: 'hc_prepare',
      error: e instanceof Error ? e.message : 'desconhecido',
    });
    return { ok: false, reason: 'error' };
  }
}

/** Converte a lista de permissões concedidas nos nossos tipos. */
function toMetrics(permissions: { accessType: string; recordType: string }[]): HealthMetric[] {
  const out: HealthMetric[] = [];
  for (const p of permissions) {
    if (p.accessType !== 'read') continue;
    const metric = RECORD_TO_METRIC[p.recordType as HealthRecordType];
    if (metric && !out.includes(metric)) out.push(metric);
  }
  return out;
}

async function grantedMetrics(): Promise<HealthMetric[]> {
  try {
    return toMetrics(await getGrantedPermissions());
  } catch (e) {
    logger.warn('health-connect: falha ao listar permissões', {
      action: 'hc_granted',
      error: e instanceof Error ? e.message : 'desconhecido',
    });
    return [];
  }
}

// ─────────────────────────── API pública ───────────────────────────

/**
 * Estado do Health Connect no aparelho: disponível (com os tipos já
 * autorizados), disponível sem nenhuma permissão, ou indisponível.
 * Nunca lança.
 */
export async function getHealthConnectStatus(): Promise<HealthConnectStatus> {
  const ready = await prepare();
  if (!ready.ok) return { kind: 'unavailable', reason: ready.reason };
  const granted = await grantedMetrics();
  return granted.length === 0 ? { kind: 'needs-permission', granted: [] } : { kind: 'ready', granted };
}

/**
 * Pede permissão de LEITURA só dos tipos informados (minimização).
 * Devolve a lista completa de tipos autorizados depois do diálogo do sistema —
 * inclusive os que já estavam, para a UI só substituir o estado.
 */
export async function requestHealthPermissions(metrics: HealthMetric[]): Promise<HealthMetric[]> {
  if (metrics.length === 0) return grantedMetrics();
  const ready = await prepare();
  if (!ready.ok) return [];
  try {
    const wanted: Permission[] = metrics.map((m) => ({
      accessType: 'read',
      recordType: HEALTH_METRICS[m].recordType,
    }));
    await requestPermission(wanted);
  } catch (e) {
    logger.warn('health-connect: falha ao pedir permissão', {
      action: 'hc_request',
      count: metrics.length,
      error: e instanceof Error ? e.message : 'desconhecido',
    });
  }
  // A resposta do diálogo pode vir incompleta em alguns provedores; a fonte
  // de verdade é sempre o que o sistema diz estar concedido agora.
  return grantedMetrics();
}

/**
 * Lê os registros recentes dos tipos pedidos e normaliza para as unidades do
 * app. Cada tipo é lido isoladamente: falha em um não impede os outros
 * (o tipo entra em `failed`). Nunca lança.
 */
export async function readRecent(options: {
  metrics: HealthMetric[];
  days: number;
}): Promise<HealthReadResult> {
  const { metrics, days } = options;
  const empty: HealthReadResult = { readings: [], failed: [] };
  if (metrics.length === 0) return empty;

  const ready = await prepare();
  if (!ready.ok) return { readings: [], failed: [...metrics] };

  const granted = await grantedMetrics();
  const range = timeRange(days);
  const readings: HealthReading[] = [];
  const failed: HealthMetric[] = [];

  for (const metric of metrics) {
    if (!granted.includes(metric)) {
      failed.push(metric);
      continue;
    }
    try {
      readings.push(...(await readMetric(metric, range)));
    } catch (e) {
      failed.push(metric);
      logger.warn('health-connect: falha ao ler registros', {
        action: 'hc_read',
        type: metric,
        error: e instanceof Error ? e.message : 'desconhecido',
      });
    }
  }

  // Mais recentes primeiro — a UI mostra o topo da lista.
  readings.sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : a.measuredAt > b.measuredAt ? -1 : 0));
  return { readings, failed };
}

function timeRange(days: number): ReadRecordsOptions['timeRangeFilter'] {
  const start = new Date();
  start.setDate(start.getDate() - Math.max(1, Math.round(days)));
  return { operator: 'between', startTime: start.toISOString(), endTime: new Date().toISOString() };
}

const readOptions = (range: ReadRecordsOptions['timeRangeFilter']): ReadRecordsOptions => ({
  timeRangeFilter: range,
  ascendingOrder: false,
  pageSize: MAX_PER_METRIC,
});

/** Origem (pacote do app que gravou). Campo opcional em qualquer record. */
const originOf = (record: { metadata?: { dataOrigin?: string } }): string | null =>
  record.metadata?.dataOrigin ?? null;

async function readMetric(
  metric: HealthMetric,
  range: ReadRecordsOptions['timeRangeFilter'],
): Promise<HealthReading[]> {
  switch (metric) {
    case 'weight':
      return readWeight(range);
    case 'blood_pressure':
      return readBloodPressure(range);
    case 'glucose':
      return readGlucose(range);
    case 'heart_rate':
      return readHeartRate(range);
    case 'oxygen_saturation':
      return readOxygen(range);
    case 'sleep':
      return readSleep(range);
  }
}

// ── Leitores por tipo (unidades conferidas nos .d.ts do pacote) ────────────

async function readWeight(range: ReadRecordsOptions['timeRangeFilter']): Promise<HealthReading[]> {
  const { records } = await readRecords('Weight', readOptions(range));
  const out: HealthReading[] = [];
  for (const r of records) {
    const kg = r.weight?.inKilograms;
    if (!isFiniteNumber(kg) || !plausible('weight', kg)) continue;
    out.push({
      metric: 'weight',
      measuredAt: r.time,
      primary: round(kg, 1),
      secondary: null,
      unit: 'kg',
      origin: originOf(r),
      sampleCount: 1,
    });
  }
  return out;
}

async function readBloodPressure(
  range: ReadRecordsOptions['timeRangeFilter'],
): Promise<HealthReading[]> {
  const { records } = await readRecords('BloodPressure', readOptions(range));
  const out: HealthReading[] = [];
  for (const r of records) {
    const sys = r.systolic?.inMillimetersOfMercury;
    const dia = r.diastolic?.inMillimetersOfMercury;
    if (!isFiniteNumber(sys) || !isFiniteNumber(dia)) continue;
    if (!plausible('blood_pressure', sys) || !plausible('blood_pressure', dia)) continue;
    out.push({
      metric: 'blood_pressure',
      measuredAt: r.time,
      primary: round(sys),
      secondary: round(dia),
      unit: 'mmHg',
      origin: originOf(r),
      sampleCount: 1,
    });
  }
  return out;
}

async function readGlucose(range: ReadRecordsOptions['timeRangeFilter']): Promise<HealthReading[]> {
  const { records } = await readRecords('BloodGlucose', readOptions(range));
  const out: HealthReading[] = [];
  for (const r of records) {
    // O app trabalha em mg/dL; o Health Connect entrega as duas unidades.
    const mgdl = r.level?.inMilligramsPerDeciliter;
    if (!isFiniteNumber(mgdl) || !plausible('glucose', mgdl)) continue;
    out.push({
      metric: 'glucose',
      measuredAt: r.time,
      primary: round(mgdl),
      secondary: null,
      unit: 'mg/dL',
      origin: originOf(r),
      sampleCount: 1,
    });
  }
  return out;
}

/**
 * FC vem em registros com N amostras (relógio grava continuamente). Importar
 * amostra por amostra encheria o prontuário de milhares de linhas, então cada
 * REGISTRO vira uma leitura com a média das suas amostras — e `sampleCount`
 * deixa isso explícito para a UI dizer ao usuário que o valor é uma média.
 */
async function readHeartRate(range: ReadRecordsOptions['timeRangeFilter']): Promise<HealthReading[]> {
  const { records } = await readRecords('HeartRate', readOptions(range));
  const out: HealthReading[] = [];
  for (const r of records) {
    let sum = 0;
    let n = 0;
    for (const sample of r.samples ?? []) {
      const bpm = sample?.beatsPerMinute;
      if (!isFiniteNumber(bpm) || !plausible('heart_rate', bpm)) continue;
      sum += bpm;
      n += 1;
    }
    if (n === 0) continue;
    out.push({
      metric: 'heart_rate',
      measuredAt: r.startTime,
      primary: round(sum / n),
      secondary: null,
      unit: 'bpm',
      origin: originOf(r),
      sampleCount: n,
    });
  }
  return out;
}

async function readOxygen(range: ReadRecordsOptions['timeRangeFilter']): Promise<HealthReading[]> {
  const { records } = await readRecords('OxygenSaturation', readOptions(range));
  const out: HealthReading[] = [];
  for (const r of records) {
    // `percentage` já é o número em % (não é objeto com unidade).
    const pct = r.percentage;
    if (!isFiniteNumber(pct) || !plausible('oxygen_saturation', pct)) continue;
    out.push({
      metric: 'oxygen_saturation',
      measuredAt: r.time,
      primary: round(pct, 1),
      secondary: null,
      unit: '%',
      origin: originOf(r),
      sampleCount: 1,
    });
  }
  return out;
}

/** Sono: duração da sessão em horas (o Health Connect não entrega "horas"). */
async function readSleep(range: ReadRecordsOptions['timeRangeFilter']): Promise<HealthReading[]> {
  const { records } = await readRecords('SleepSession', readOptions(range));
  const out: HealthReading[] = [];
  for (const r of records) {
    const start = Date.parse(r.startTime);
    const end = Date.parse(r.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const hours = (end - start) / 3_600_000;
    if (!plausible('sleep', hours)) continue;
    out.push({
      metric: 'sleep',
      measuredAt: r.startTime,
      primary: round(hours, 1),
      secondary: null,
      unit: 'h',
      origin: originOf(r),
      sampleCount: 1,
    });
  }
  return out;
}
