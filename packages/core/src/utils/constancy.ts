// Constância Gentil — mede o hábito de registrar SEM punir. Um dia perdido
// NUNCA zera o progresso: o índice é uma média móvel exponencial que sobe com
// repetição e cai suavemente. Puro e determinístico (testável). Alinhado à
// ética do produto: celebra sem infantilizar, nunca gera culpa.

export type ConstancyLevel = 0 | 1 | 2 | 3 | 4;

export interface Constancy {
  /** Índice 0-100 (média móvel ponderada dos últimos dias com registro). */
  score: number;
  level: ConstancyLevel;
  levelLabel: string;
  /** Semanas seguidas (a partir de hoje) com >= CONSTANCY_WEEKLY_TARGET dias. */
  firmWeeks: number;
  activeToday: boolean;
  /** Frase calorosa e adulta — sem pressão. */
  message: string;
}

/** Dias/semana para a semana "contar" como firme (folga embutida: 7 - alvo). */
export const CONSTANCY_WEEKLY_TARGET = 3;

const LEVEL_LABELS = ['Vamos começar', 'Começando', 'Pegando o ritmo', 'Constante', 'Dedicado'] as const;

/** Chave local 'YYYY-MM-DD' (sem UTC, evita erro de fuso). */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param activeDays chaves 'YYYY-MM-DD' dos dias com QUALQUER registro (diário, vital, tomada).
 * @param today      data de referência (default: agora).
 */
export function computeConstancy(activeDays: Iterable<string>, today: Date = new Date()): Constancy {
  const active = activeDays instanceof Set ? activeDays : new Set(activeDays);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Índice: EMA em 28 dias, meia-vida de 7 (dias recentes pesam mais).
  const factor = Math.pow(0.5, 1 / 7);
  let num = 0;
  let den = 0;
  let w = 1;
  for (let i = 0; i < 28; i += 1) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    num += (active.has(dayKey(d)) ? 1 : 0) * w;
    den += w;
    w *= factor;
  }
  const score = den > 0 ? Math.round((num / den) * 100) : 0;

  // Semanas firmes: janelas de 7 dias a partir de hoje com >= alvo dias.
  let firmWeeks = 0;
  for (let wk = 0; wk < 12; wk += 1) {
    let count = 0;
    for (let d = 0; d < 7; d += 1) {
      const dt = new Date(base);
      dt.setDate(dt.getDate() - (wk * 7 + d));
      if (active.has(dayKey(dt))) count += 1;
    }
    if (count >= CONSTANCY_WEEKLY_TARGET) firmWeeks += 1;
    else break;
  }

  const activeToday = active.has(dayKey(base));
  const level: ConstancyLevel = score >= 80 ? 4 : score >= 55 ? 3 : score >= 30 ? 2 : score > 0 ? 1 : 0;
  const levelLabel = LEVEL_LABELS[level];

  let message: string;
  if (level === 0) {
    message = 'Registre algo hoje para começar sua constância. 💙';
  } else if (activeToday) {
    message =
      firmWeeks >= 1
        ? `Mais um dia registrado — ${firmWeeks} semana${firmWeeks > 1 ? 's' : ''} firme${firmWeeks > 1 ? 's' : ''}. Seu médico agradece.`
        : 'Registrado hoje. Cada dia constrói seu histórico. 💙';
  } else {
    message = 'Um toque hoje mantém sua constância — e um dia de folga não apaga seu progresso.';
  }

  return { score, level, levelLabel, firmWeeks, activeToday, message };
}
