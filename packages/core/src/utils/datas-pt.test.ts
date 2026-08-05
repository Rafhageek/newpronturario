import { describe, it, expect } from 'vitest';
import {
  diaLocal,
  dataDoDia,
  somarDias,
  diaEMes,
  dataPorExtenso,
  rotuloDoDia,
  semanaDe,
  MESES_PT,
} from './datas-pt';

describe('datas por extenso em pt-BR, sem Intl', () => {
  it('não usa Intl em lugar nenhum (Hermes derruba o app)', async () => {
    // A trava é o próprio texto do módulo: `Intl` aqui reabre um crash que já
    // aconteceu duas vezes neste projeto.
    const fonte = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./datas-pt.ts', import.meta.url), 'utf8'),
    );
    const codigo = fonte
      .split(/\r?\n/)
      .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
      .join('\n');
    expect(codigo).not.toMatch(/\bIntl\b/);
    expect(codigo).not.toMatch(/toLocaleDateString|toLocaleString/);
  });

  it('diaLocal usa o fuso da pessoa, não UTC', () => {
    // 31/12 às 21h no Brasil ainda é 31/12 — `toISOString()` diria 01/01.
    const virada = new Date(2026, 11, 31, 21, 0, 0);
    expect(diaLocal(virada)).toBe('2026-12-31');
  });

  it('lê AAAA-MM-DD à meia-noite local', () => {
    const d = dataDoDia('2026-08-05');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(7);
    expect(d?.getDate()).toBe(5);
  });

  it('rejeita data que não existe em vez de "ajustar"', () => {
    expect(dataDoDia('2026-02-31')).toBeNull();
    expect(dataDoDia('2026-13-01')).toBeNull();
    expect(dataDoDia('05/08/2026')).toBeNull();
    expect(dataDoDia('')).toBeNull();
    // Bissexto de verdade continua válido.
    expect(dataDoDia('2024-02-29')).not.toBeNull();
    expect(dataDoDia('2026-02-29')).toBeNull();
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-08-05', 1)).toBe('2026-08-06');
    expect(somarDias('2026-08-31', 1)).toBe('2026-09-01');
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(somarDias('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('escreve o mês por extenso em português', () => {
    expect(diaEMes('2026-08-05')).toBe('5 de agosto');
    expect(diaEMes('2026-03-01')).toBe('1 de março');
    expect(dataPorExtenso('2026-08-05')).toBe('5 de agosto de 2026');
    expect(MESES_PT).toHaveLength(12);
    expect(MESES_PT[2]).toBe('março');
  });

  it('o rótulo do dia sempre traz a data junto do apelido', () => {
    // "Hoje" sozinho vira mentira se a aba passou da meia-noite aberta.
    expect(rotuloDoDia('2026-08-05', '2026-08-05')).toBe('Hoje, 5 de agosto');
    expect(rotuloDoDia('2026-08-04', '2026-08-05')).toBe('Ontem, 4 de agosto');
    expect(rotuloDoDia('2026-08-06', '2026-08-05')).toBe('Amanhã, 6 de agosto');
    expect(rotuloDoDia('2026-07-31', '2026-08-05')).toBe('Sexta-feira, 31 de julho');
  });

  it('a semana vai de segunda a domingo e contém o dia pedido', () => {
    // 2026-08-05 é uma quarta-feira.
    const semana = semanaDe('2026-08-05');
    expect(semana).toHaveLength(7);
    expect(semana[0]).toBe('2026-08-03'); // segunda
    expect(semana[6]).toBe('2026-08-09'); // domingo
    expect(semana).toContain('2026-08-05');
  });

  it('domingo pertence à semana que começou na segunda anterior', () => {
    // 2026-08-09 é domingo: não pode abrir uma semana nova.
    expect(semanaDe('2026-08-09')[0]).toBe('2026-08-03');
    // 2026-08-10 é segunda: aí sim.
    expect(semanaDe('2026-08-10')[0]).toBe('2026-08-10');
  });

  it('entrada inválida devolve vazio em vez de lixo na tela', () => {
    expect(diaEMes('nada')).toBe('');
    expect(rotuloDoDia('nada')).toBe('');
    expect(semanaDe('nada')).toEqual([]);
  });
});
