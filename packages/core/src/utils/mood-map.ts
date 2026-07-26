// "Ano em pixels" do humor — transforma o humor que o diário já coleta (1-5)
// num calendário-mosaico onde cada dia é um pixel colorido. Puro e testável.

/** Cor por nível de humor (1 = pior … 5 = melhor). Escala divergente. */
export const MOOD_PIXEL: Record<number, string> = {
  1: '#F24B59', // coral (bem para baixo)
  2: '#F59E0B', // âmbar
  3: '#94A3B8', // neutro
  4: '#38BDF8', // azul claro
  5: '#10B981', // verde (bem para cima)
};

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
