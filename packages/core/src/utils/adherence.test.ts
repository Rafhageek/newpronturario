import { describe, it, expect } from 'vitest';
import {
  adherenceRate,
  adherenceByHour,
  adherenceTally,
  expectedDosesInDays,
  stockForecast,
  type DoseEventLike,
} from './adherence';

/** Evento no horário LOCAL informado (é assim que a pessoa pensa a dose). */
function ev(day: number, hour: number, status: DoseEventLike['status']): DoseEventLike {
  const at = new Date(2026, 6, day, hour, 0, 0, 0); // julho/2026, hora local
  return { scheduled_for: at.toISOString(), status };
}

describe('adherenceRate', () => {
  it('percentual de doses confirmadas sobre o previsto', () => {
    const events = [ev(1, 8, 'taken'), ev(2, 8, 'taken'), ev(3, 8, 'skipped')];
    expect(adherenceRate(events, 4)).toBe(50); // 2 de 4
  });

  it('adiar não conta como tomada', () => {
    expect(adherenceRate([ev(1, 22, 'snoozed'), ev(2, 22, 'snoozed')], 2)).toBe(0);
  });

  it('sem doses previstas devolve null (não dá para calcular)', () => {
    expect(adherenceRate([ev(1, 8, 'taken')], 0)).toBeNull();
    expect(adherenceRate([], -3)).toBeNull();
  });

  it('nunca passa de 100 mesmo com registro extra', () => {
    expect(adherenceRate([ev(1, 8, 'taken'), ev(1, 9, 'taken'), ev(1, 10, 'taken')], 2)).toBe(100);
  });

  it('sem eventos é 0, não null, quando há previsão', () => {
    expect(adherenceRate([], 30)).toBe(0);
  });
});

describe('adherenceByHour', () => {
  it('revela o padrão por horário (a dose da noite escapa)', () => {
    const events = [
      ev(1, 8, 'taken'),
      ev(2, 8, 'taken'),
      ev(3, 8, 'taken'),
      ev(1, 22, 'skipped'),
      ev(2, 22, 'skipped'),
      ev(3, 22, 'taken'),
    ];
    const buckets = adherenceByHour(events);
    expect(buckets.map((b) => b.hour)).toEqual([8, 22]); // ordenado, só horas com registro

    const manha = buckets[0];
    expect(manha?.taken).toBe(3);
    expect(manha?.rate).toBe(100);

    const noite = buckets[1];
    expect(noite?.total).toBe(3);
    expect(noite?.skipped).toBe(2);
    expect(noite?.rate).toBe(33); // 1 de 3
  });

  it('ignora datas inválidas sem quebrar', () => {
    const buckets = adherenceByHour([
      { scheduled_for: 'não é data', status: 'taken' },
      ev(1, 7, 'taken'),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.hour).toBe(7);
  });

  it('lista vazia devolve lista vazia', () => {
    expect(adherenceByHour([])).toEqual([]);
  });
});

describe('stockForecast', () => {
  it('dias restantes e data prevista de término', () => {
    const from = new Date(2026, 6, 25); // 25/07/2026
    const f = stockForecast({ stockCount: 20, dosesPerDay: 2, from });
    expect(f.daysRemaining).toBe(10);
    expect(f.runsOutOn).toBe('2026-08-04');
  });

  it('arredonda para baixo (dose fracionada não vira dia inteiro)', () => {
    const from = new Date(2026, 6, 25);
    expect(stockForecast({ stockCount: 7, dosesPerDay: 2, from }).daysRemaining).toBe(3);
  });

  it('dose semanal estica o estoque', () => {
    const from = new Date(2026, 6, 25);
    const f = stockForecast({ stockCount: 4, dosesPerDay: 1 / 7, from });
    expect(f.daysRemaining).toBe(28);
    expect(f.runsOutOn).toBe('2026-08-22');
  });

  it('sem estoque rastreado ou sem previsão de consumo devolve null', () => {
    expect(stockForecast({ stockCount: null, dosesPerDay: 2 }).daysRemaining).toBeNull();
    expect(stockForecast({ stockCount: 10, dosesPerDay: null }).runsOutOn).toBeNull();
    expect(stockForecast({ stockCount: 10, dosesPerDay: 0 }).daysRemaining).toBeNull();
    expect(stockForecast({ stockCount: -1, dosesPerDay: 1 }).daysRemaining).toBeNull();
  });

  it('estoque zerado acaba hoje', () => {
    const from = new Date(2026, 6, 25);
    const f = stockForecast({ stockCount: 0, dosesPerDay: 1, from });
    expect(f.daysRemaining).toBe(0);
    expect(f.runsOutOn).toBe('2026-07-25');
  });
});

describe('adherenceTally e expectedDosesInDays', () => {
  it('conta cada status separadamente', () => {
    const t = adherenceTally(
      [ev(1, 8, 'taken'), ev(2, 8, 'snoozed'), ev(3, 8, 'skipped'), ev(4, 8, 'taken')],
      8,
    );
    expect(t).toMatchObject({ taken: 2, snoozed: 1, skipped: 1, registered: 4, expected: 8, rate: 25 });
  });

  it('doses previstas = horários por dia × dias', () => {
    expect(expectedDosesInDays(2, 30)).toBe(60);
    expect(expectedDosesInDays(0, 30)).toBe(0); // sem horários cadastrados
    expect(expectedDosesInDays(1 / 7, 30)).toBe(4); // semanal, arredondado
  });
});
