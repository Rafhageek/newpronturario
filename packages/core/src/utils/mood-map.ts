// "Ano em pixels" do humor — transforma o humor que o diário já coleta (1-5)
// num calendário-mosaico onde cada dia é um pixel colorido. Puro e testável.

import { MOOD_RAMP, MOOD_VALUES } from '../data/mood-scale';

/**
 * Cor do pixel por degrau da escala (1…5) — rampa de UM matiz (azul).
 *
 * ANTES era uma escala divergente coral → âmbar → cinza → azul → VERDE. Ou
 * seja: um semáforo completo pintando humor, que é dado autorrelatado sobre a
 * própria pessoa. O mapa devolvia um ano inteiro em que os dias ruins ficavam
 * vermelhos — o app carimbando julgamento em cima do que alguém sentiu. É a
 * mesma coisa que a regra de cor clínica veda no resto do produto; aqui ela
 * simplesmente nunca tinha sido aplicada.
 *
 * Agora é a rampa de `MOOD_RAMP` (data/mood-scale), a mesma do seletor de
 * humor e irmã da rampa de dor (`painIntensityColor`). O mapa continua legível
 * porque intensidade num matiz só ainda ordena — e porque cor sozinha nunca é o
 * canal único: cada célula carrega o rótulo (`MOOD_PIXEL_LABEL`).
 */
export const MOOD_PIXEL: Record<number, string> = Object.fromEntries(
  MOOD_VALUES.map((v) => [v, MOOD_RAMP[v]]),
);

/**
 * Rótulo do degrau. Trocado para o vocabulário da própria escala ("Muito mal…
 * Muito bem" de `MOOD_LABELS`) seria melhor, mas estes textos já estão em
 * telas e em legendas; mantidos como estão para não mudar cópia sem revisão.
 */
export const MOOD_PIXEL_LABEL: Record<number, string> = {
  1: 'Muito baixo',
  2: 'Baixo',
  3: 'Neutro',
  4: 'Bom',
  5: 'Ótimo',
};

/** Cor do pixel de humor; null quando não há registro no dia. */
export function moodPixelColor(mood: number | null | undefined): string | null {
  if (mood == null) return null;
  const m = Math.round(mood);
  return MOOD_PIXEL[m] ?? null;
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Grade semanas × 7 dias (colunas = semanas, linhas = dom→sáb), terminando em
 * `endIso` e cobrindo os últimos `days` dias (alinhada ao domingo). Cada célula
 * é a chave 'YYYY-MM-DD' do dia, ou null (padding após o fim).
 */
export function buildMoodGrid(endIso: string, days = 182): (string | null)[][] {
  const end = new Date(`${endIso}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setDate(start.getDate() - start.getDay()); // recua até domingo

  const weeks: (string | null)[][] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week: (string | null)[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push(cur <= end ? dayKey(cur) : null);
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
