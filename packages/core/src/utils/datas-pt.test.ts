import { describe, it, expect } from 'vitest';
import {
  diaLocal,
  diaDeFormulario,
  dataDoDia,
  somarDias,
  diaEMes,
  dataPorExtenso,
  rotuloDoDia,
  semanaDe,
  MESES_PT,
  horaLocal,
  dataEHoraLocal,
  tempoRelativo,
  saudacao,
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

describe('hora e tempo relativo — sem Intl, e sem UTC', () => {
  it('horaLocal usa o relógio de quem lê, não o UTC', () => {
    // 22h30 no fuso local, seja qual for o fuso da máquina que roda o teste.
    const d = new Date(2026, 7, 5, 22, 30, 0);
    expect(horaLocal(d)).toBe('22:30');
    expect(horaLocal(d.toISOString())).toBe('22:30');
  });

  it('horaLocal preenche o zero à esquerda (09:05, não 9:5)', () => {
    expect(horaLocal(new Date(2026, 7, 5, 9, 5, 0))).toBe('09:05');
  });

  it('dataEHoraLocal não empurra a noite para o dia seguinte', () => {
    // 5 de agosto às 23h. Com `toISOString()` isto viraria dia 6 no Brasil.
    const d = new Date(2026, 7, 5, 23, 0, 0);
    expect(dataEHoraLocal(d)).toBe('5 de agosto, 23:00');
  });

  it('tempoRelativo cobre a escada inteira em PT-BR', () => {
    const agora = new Date(2026, 7, 5, 12, 0, 0);
    const atras = (ms: number) => new Date(agora.getTime() - ms);
    const s = 1000;
    const min = 60 * s;
    const h = 60 * min;
    const dia = 24 * h;

    expect(tempoRelativo(atras(10 * s), agora)).toBe('agora');
    expect(tempoRelativo(atras(2 * min), agora)).toBe('há 2 min');
    expect(tempoRelativo(atras(3 * h), agora)).toBe('há 3 h');
    expect(tempoRelativo(atras(1 * h), agora)).toBe('há 1 h');
    expect(tempoRelativo(atras(1 * dia), agora)).toBe('ontem');
    expect(tempoRelativo(atras(5 * dia), agora)).toBe('há 5 dias');
    expect(tempoRelativo(atras(60 * dia), agora)).toBe('há 2 meses');
    expect(tempoRelativo(atras(400 * dia), agora)).toBe('há 1 ano');
  });

  /**
   * Relógio de aparelho adiantado é comum, e um "há -3 h" na tela de
   * notificações é o tipo de coisa que faz a pessoa desconfiar do app inteiro.
   */
  it('tempo no FUTURO vira "em …", nunca um "há" negativo', () => {
    const agora = new Date(2026, 7, 5, 12, 0, 0);
    const adiante = (ms: number) => new Date(agora.getTime() + ms);
    expect(tempoRelativo(adiante(2 * 60 * 1000), agora)).toBe('em 2 min');
    expect(tempoRelativo(adiante(24 * 3600 * 1000), agora)).toBe('amanhã');
    expect(tempoRelativo(adiante(10 * 1000), agora)).toBe('daqui a pouco');
  });

  it('data inválida devolve vazio em vez de "Invalid Date" na tela', () => {
    expect(horaLocal('nada')).toBe('');
    expect(dataEHoraLocal('nada')).toBe('');
    expect(tempoRelativo('nada')).toBe('');
  });

  it('saudação segue o relógio local', () => {
    expect(saudacao(new Date(2026, 7, 5, 8, 0))).toBe('Bom dia');
    expect(saudacao(new Date(2026, 7, 5, 14, 0))).toBe('Boa tarde');
    expect(saudacao(new Date(2026, 7, 5, 21, 0))).toBe('Boa noite');
  });

  /**
   * A trava do incidente: `Intl` derruba o app no Hermes, e já derrubou duas
   * vezes neste projeto (`RelativeTimeFormat` e `DateTimeFormat`). Este módulo é
   * o que a web e o mobile compartilham, então é aqui que a proibição vale.
   */
  it('o módulo inteiro não toca em `Intl`', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const fonte = readFileSync(
      fileURLToPath(new URL('./datas-pt.ts', import.meta.url)),
      'utf8',
    );
    const semComentarios = fonte
      .split(/\r?\n/)
      .filter((l) => {
        const t = l.trimStart();
        return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
      })
      .join('\n');
    expect(semComentarios).not.toMatch(/\bIntl\b/);
  });
});

/*
 * ════════════════════════════════════════════════════════════════════════════
 * `diaDeFormulario` — a trava do bug de um dia a menos
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Um `<input type="date">` manda `'2026-08-17'`. O Zod coage isso com
 * `new Date('2026-08-17')`, e o motor de JS lê data sem hora como UTC — o
 * `Date` resultante é meia-noite UTC, que no Brasil é 16/08 às 21h.
 *
 * Foi assim que a primeira versão do módulo de atividade física gravou a
 * caminhada de terça como tendo acontecido na segunda, às 21h, e ainda a fez
 * cair na semana anterior no total de "esta semana". O `Date` está certo; o que
 * não pode é ler os componentes dele em horário LOCAL para recuperar o dia
 * digitado.
 *
 * Os testes rodam sob o fuso definido em `vitest.config.ts`; para não depender
 * dele, a asserção decisiva compara com o dia que o próprio `Date` carrega em
 * UTC, e o teste do deslocamento monta um `Date` a partir de componentes UTC.
 */
describe('diaDeFormulario — dia digitado volta intacto', () => {
  it('devolve o MESMO dia que a pessoa digitou no <input type="date">', () => {
    // Este é o caminho real: string do input → coerção do Zod → gravação.
    for (const digitado of ['2026-08-17', '2026-01-01', '2026-12-31', '2024-02-29']) {
      expect(diaDeFormulario(new Date(digitado)), `digitado: ${digitado}`).toBe(digitado);
    }
  });

  it('NÃO usa a leitura local, que voltaria o dia anterior a oeste de Greenwich', () => {
    // Meia-noite UTC do dia 17 é 16/08 às 21h em São Paulo.
    const meiaNoiteUtc = new Date(Date.UTC(2026, 7, 17, 0, 0, 0));
    expect(diaDeFormulario(meiaNoiteUtc)).toBe('2026-08-17');
    // E a prova de que os dois helpers NÃO são intercambiáveis: num fuso
    // negativo, `diaLocal` do mesmo instante cai no dia anterior. Onde o fuso
    // do teste for UTC ou positivo eles coincidem, e aí não há o que provar.
    const local = diaLocal(meiaNoiteUtc);
    if (meiaNoiteUtc.getTimezoneOffset() > 0) {
      expect(local).toBe('2026-08-16');
    }
  });

  it('sem data e data inválida saem como null (ausência é resposta honesta)', () => {
    expect(diaDeFormulario(undefined)).toBeNull();
    expect(diaDeFormulario(null)).toBeNull();
    expect(diaDeFormulario(new Date('abacaxi'))).toBeNull();
  });
});
