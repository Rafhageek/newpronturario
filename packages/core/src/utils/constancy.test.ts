import { describe, it, expect } from 'vitest';
import { computeConstancy, CONSTANCY_WEEKLY_TARGET } from './constancy';

const TODAY = new Date(2026, 6, 13); // 2026-07-13 (mês é 0-indexado)

function key(daysAgo: number): string {
  const d = new Date(2026, 6, 13);
  d.setDate(d.getDate() - daysAgo);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

describe('computeConstancy', () => {
  it('sem registros → nível 0, score 0', () => {
    const c = computeConstancy([], TODAY);
    expect(c.score).toBe(0);
    expect(c.level).toBe(0);
    expect(c.activeToday).toBe(false);
  });

  it('registro diário em todos os 28 dias → score alto e nível máximo', () => {
    const all = Array.from({ length: 28 }, (_, i) => key(i));
    const c = computeConstancy(all, TODAY);
    expect(c.score).toBeGreaterThanOrEqual(95);
    expect(c.level).toBe(4);
    expect(c.activeToday).toBe(true);
  });

  it('um dia perdido NÃO zera o progresso (ética: sem punição)', () => {
    // registrou todos os dias menos ontem
    const days = Array.from({ length: 28 }, (_, i) => i).filter((i) => i !== 1).map(key);
    const c = computeConstancy(days, TODAY);
    expect(c.score).toBeGreaterThan(70); // continua alto
    expect(c.level).toBeGreaterThanOrEqual(3);
  });

  it('conta semanas firmes com folga embutida (alvo = 3 dias/semana)', () => {
    // 2 dias por semana nas últimas 3 semanas → nenhuma semana firme (alvo é 3)
    const sparse: string[] = [];
    for (let wk = 0; wk < 3; wk += 1) {
      sparse.push(key(wk * 7), key(wk * 7 + 1));
    }
    expect(computeConstancy(sparse, TODAY).firmWeeks).toBe(0);

    // exatamente o alvo (3 dias) em cada uma das 2 primeiras semanas
    const firm: string[] = [];
    for (let wk = 0; wk < 2; wk += 1) {
      for (let d = 0; d < CONSTANCY_WEEKLY_TARGET; d += 1) firm.push(key(wk * 7 + d));
    }
    expect(computeConstancy(firm, TODAY).firmWeeks).toBe(2);
  });

  it('mensagem muda conforme registrou hoje ou não (sem culpa)', () => {
    const semHoje = computeConstancy([key(1), key(2), key(3)], TODAY);
    expect(semHoje.activeToday).toBe(false);
    expect(semHoje.message).toMatch(/folga não apaga|mantém sua constância/i);

    const comHoje = computeConstancy([key(0), key(1), key(2)], TODAY);
    expect(comHoje.activeToday).toBe(true);
  });
});
