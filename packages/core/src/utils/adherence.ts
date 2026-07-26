/**
 * Adesão terapêutica — helpers PUROS, só aritmética.
 *
 * ⚠️ O que estes números são: a contagem de doses que a pessoa CONFIRMOU no app
 * (pela ação da notificação ou pelo botão na tela). NÃO é medida de ingestão
 * real: ninguém sabe se o comprimido foi engolido, e esquecer de confirmar não
 * é o mesmo que esquecer de tomar.
 *
 * Por isso nada aqui devolve juízo de valor ("adesão ruim", "você falhou").
 * Só devolve número, contagem e data. Quem escreve a frase é a UI — e a frase
 * também deve ser neutra. O app registra; quem avalia tratamento é a equipe
 * de saúde.
 */

export type DoseStatus = 'taken' | 'snoozed' | 'skipped';

/** Formato mínimo que os cálculos precisam de um evento de dose. */
export interface DoseEventLike {
  /** ISO 8601 do horário previsto da dose (não o horário do clique). */
  scheduled_for: string;
  status: DoseStatus;
}

/**
 * Percentual (0–100) de doses confirmadas como tomadas sobre o esperado.
 *
 * - `expectedDoses <= 0` → null (sem horários cadastrados, não dá para calcular).
 * - 'snoozed' NÃO conta como tomada: adiar é só empurrar o lembrete.
 * - O resultado é limitado a 100 (registro manual pode passar do previsto).
 */
export function adherenceRate(
  events: readonly DoseEventLike[],
  expectedDoses: number,
): number | null {
  if (!Number.isFinite(expectedDoses) || expectedDoses <= 0) return null;
  const taken = events.filter((e) => e.status === 'taken').length;
  return Math.min(100, Math.round((taken / expectedDoses) * 100));
}

/** Uma faixa horária com o que foi registrado nela. */
export interface AdherenceHourBucket {
  /** Hora local do horário previsto (0–23). */
  hour: number;
  taken: number;
  snoozed: number;
  skipped: number;
  /** taken + snoozed + skipped. */
  total: number;
  /** taken / total em % (0–100). null quando não houve registro na faixa. */
  rate: number | null;
}

/**
 * Agrupa os eventos pela HORA prevista da dose. Serve para a pessoa enxergar
 * o padrão dela mesma — por exemplo, que a dose das 22h quase nunca é
 * confirmada, enquanto a das 8h sempre é.
 *
 * Devolve só as horas que têm algum registro, em ordem crescente. Datas
 * inválidas são ignoradas. A hora é a LOCAL do aparelho (é assim que a pessoa
 * pensa no horário do remédio).
 */
export function adherenceByHour(events: readonly DoseEventLike[]): AdherenceHourBucket[] {
  const buckets = new Map<number, { taken: number; snoozed: number; skipped: number }>();

  for (const event of events) {
    const at = new Date(event.scheduled_for);
    const time = at.getTime();
    if (Number.isNaN(time)) continue;
    const hour = at.getHours();

    const bucket = buckets.get(hour) ?? { taken: 0, snoozed: 0, skipped: 0 };
    bucket[event.status] += 1;
    buckets.set(hour, bucket);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, counts]) => {
      const total = counts.taken + counts.snoozed + counts.skipped;
      return {
        hour,
        taken: counts.taken,
        snoozed: counts.snoozed,
        skipped: counts.skipped,
        total,
        rate: total > 0 ? Math.round((counts.taken / total) * 100) : null,
      };
    });
}

export interface StockForecastInput {
  /** Quantas unidades a pessoa disse que tem. null = não acompanha estoque. */
  stockCount: number | null | undefined;
  /** Doses por dia previstas. null/0 = sem previsão possível (uso "se precisar"). */
  dosesPerDay: number | null | undefined;
  /** Data-base do cálculo. Default: agora. Injetável para testes. */
  from?: Date;
}

export interface StockForecast {
  /** Dias inteiros até acabar. null quando não dá para prever. */
  daysRemaining: number | null;
  /** Data prevista de término, 'AAAA-MM-DD' local. null quando não dá para prever. */
  runsOutOn: string | null;
}

/** 'AAAA-MM-DD' no fuso LOCAL (toISOString devolveria UTC e erraria o dia). */
function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Previsão simples de quando o estoque acaba, assumindo o consumo cadastrado.
 * Estimativa aritmética: não conta dose pulada, sobra de caixa nem receita nova.
 */
export function stockForecast(input: StockForecastInput): StockForecast {
  const { stockCount, dosesPerDay } = input;
  const empty: StockForecast = { daysRemaining: null, runsOutOn: null };

  if (stockCount == null || !Number.isFinite(stockCount) || stockCount < 0) return empty;
  if (dosesPerDay == null || !Number.isFinite(dosesPerDay) || dosesPerDay <= 0) return empty;

  const daysRemaining = Math.floor(stockCount / dosesPerDay);
  const from = input.from ?? new Date();
  const runsOut = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  runsOut.setDate(runsOut.getDate() + daysRemaining);

  return { daysRemaining, runsOutOn: toLocalISODate(runsOut) };
}

/**
 * Contagem crua por status, para a UI montar a frase factual que quiser
 * ("12 de 30 doses confirmadas"). Não classifica nada.
 */
export interface AdherenceTally {
  taken: number;
  snoozed: number;
  skipped: number;
  /** Eventos registrados (taken + snoozed + skipped). */
  registered: number;
  /** Doses previstas no período. */
  expected: number;
  /** adherenceRate(events, expected). */
  rate: number | null;
}

export function adherenceTally(
  events: readonly DoseEventLike[],
  expectedDoses: number,
): AdherenceTally {
  let taken = 0;
  let snoozed = 0;
  let skipped = 0;
  for (const event of events) {
    if (event.status === 'taken') taken += 1;
    else if (event.status === 'snoozed') snoozed += 1;
    else skipped += 1;
  }
  return {
    taken,
    snoozed,
    skipped,
    registered: taken + snoozed + skipped,
    expected: expectedDoses,
    rate: adherenceRate(events, expectedDoses),
  };
}

/**
 * Doses previstas num intervalo de dias: nº de horários × dias.
 * Sem horários cadastrados → 0 (a UI trata como "não dá para calcular").
 */
export function expectedDosesInDays(timesPerDay: number, days: number): number {
  if (!Number.isFinite(timesPerDay) || !Number.isFinite(days)) return 0;
  if (timesPerDay <= 0 || days <= 0) return 0;
  return Math.round(timesPerDay * days);
}

/** Frase NEUTRA e factual para acompanhar o número. Não avalia o tratamento. */
export const ADHERENCE_DISCLAIMER =
  'Contagem das doses que você confirmou aqui no app. Não mede a ingestão real — e não confirmar não quer dizer que você não tomou. Converse com sua equipe de saúde sobre o tratamento.';
