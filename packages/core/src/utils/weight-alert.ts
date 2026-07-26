// Alerta GENTIL de peso — estimativa, NUNCA diagnóstico. Encaminha ao médico.
// - ganho rápido (retenção de líquido / descompensação de IC no cardiopata)
// - perda no último mês (fragilidade / perda não intencional no idoso)

export type WeightAlertKind = 'rapid_gain' | 'unintentional_loss' | null;

export interface WeightAlert {
  kind: WeightAlertKind;
  deltaKg: number;
  message: string;
}

const NONE: WeightAlert = { kind: null, deltaKg: 0, message: '' };

function parseDay(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function kg1(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

/** weights: cronológico `{ date:'YYYY-MM-DD', kg }`. */
export function weightAlert(weights: { date: string; kg: number }[]): WeightAlert {
  if (weights.length < 2) return NONE;
  const last = weights[weights.length - 1]!;
  const lastDate = parseDay(last.date);

  // Ganho rápido: menor peso registrado nos 4 dias anteriores.
  let minRecent = last.kg;
  for (const w of weights) {
    const d = daysBetween(parseDay(w.date), lastDate);
    if (d > 0 && d <= 4) minRecent = Math.min(minRecent, w.kg);
  }
  const gain = last.kg - minRecent;
  if (gain >= 1.5) {
    return {
      kind: 'rapid_gain',
      deltaKg: Math.round(gain * 10) / 10,
      message: `Ganho de ${kg1(gain)} kg em poucos dias. Pode ser retenção de líquido — vale comentar com seu médico.`,
    };
  }

  // Perda no último mês: referência 20–45 dias atrás (a mais recente na janela).
  let ref: { date: string; kg: number } | null = null;
  for (const w of weights) {
    const d = daysBetween(parseDay(w.date), lastDate);
    if (d >= 20 && d <= 45) ref = w;
  }
  if (ref) {
    const loss = ref.kg - last.kg;
    if (loss >= 3 || loss / ref.kg >= 0.05) {
      return {
        kind: 'unintentional_loss',
        deltaKg: Math.round(loss * 10) / 10,
        message: `Perda de ${kg1(loss)} kg no último mês. Se não foi intencional, converse com seu médico.`,
      };
    }
  }
  return NONE;
}
