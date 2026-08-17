import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_KINDS,
  ACTIVITY_SYMPTOMS,
  ACTIVITY_SYMPTOM_OPTIONS,
  OMS_MINUTOS_SEMANA,
  OMS_REFERENCIA_TEXTO,
  descreverSintomas,
  formatarDuracao,
  resumoSemanaAtividade,
  somaMinutos,
} from '../constants/activity';
import { activitySessionSchema, activitySessionUpdateSchema } from './activity';

/**
 * Estes testes travam DUAS coisas diferentes:
 *
 * 1. o formulário não perde registro em silêncio (data vazia, campo opcional
 *    em branco) — a mesma classe de defeito que criou `dataOpcional` e
 *    `numeroOpcional`;
 * 2. o módulo não passa a julgar quem registrou. A segunda parte é a que
 *    costuma voltar sozinha meses depois, quando alguém acha que "só uma
 *    barrinha de progresso" ajuda.
 */

const base = { kind: 'caminhada', durationMin: 30 };

describe('activitySessionSchema — o mínimo para registrar', () => {
  it('aceita só atividade + duração: todo o resto é opcional', () => {
    const r = activitySessionSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.kind).toBe('caminhada');
      expect(r.data.durationMin).toBe(30);
      expect(r.data.effort).toBeUndefined();
      expect(r.data.feelingAfter).toBeUndefined();
      expect(r.data.performedAt).toBeUndefined();
      expect(r.data.notes).toBeUndefined();
      // Sem resposta = lista vazia. NÃO é `['nenhum']`.
      expect(r.data.symptoms).toEqual([]);
    }
  });

  it('exige a atividade e recusa palavra fora do vocabulário', () => {
    expect(activitySessionSchema.safeParse({ durationMin: 30 }).success).toBe(false);
    expect(activitySessionSchema.safeParse({ ...base, kind: 'hiit' }).success).toBe(false);
    expect(activitySessionSchema.safeParse({ ...base, kind: 'treino_a' }).success).toBe(false);
  });

  it('aceita todas as modalidades do vocabulário do público 50+', () => {
    for (const kind of ACTIVITY_KINDS) {
      const r = activitySessionSchema.safeParse({ ...base, kind });
      expect(r.success, `modalidade recusada: ${kind}`).toBe(true);
    }
  });

  it('inclui jardinagem e tarefas de casa — movimento real, não "treino"', () => {
    expect(ACTIVITY_KINDS).toContain('jardinagem');
    expect(ACTIVITY_KINDS).toContain('tarefas_de_casa');
    expect(ACTIVITY_KINDS).toContain('hidroginastica');
    expect(ACTIVITY_KINDS).toContain('fisioterapia');
  });
});

describe('duração — guarda de integridade, nunca julgamento', () => {
  it('campo em branco cai numa mensagem em português, não em "Invalid input"', () => {
    const r = activitySessionSchema.safeParse({ kind: 'caminhada', durationMin: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/minutos/i);
      expect(r.error.issues[0]?.message).not.toMatch(/invalid|expected|received/i);
    }
  });

  it('recusa zero, negativo, texto e mais de 24 horas', () => {
    for (const durationMin of [0, -10, 'abc', 1441, 99999]) {
      const r = activitySessionSchema.safeParse({ ...base, durationMin });
      expect(r.success, `deveria reprovar: ${JSON.stringify(durationMin)}`).toBe(false);
    }
  });

  it('recusa duração quebrada (o campo é em minutos inteiros)', () => {
    expect(activitySessionSchema.safeParse({ ...base, durationMin: 12.5 }).success).toBe(false);
  });

  it('NÃO tem piso clínico: 5 minutos de alongamento é registro válido', () => {
    const r = activitySessionSchema.safeParse({ kind: 'alongamento', durationMin: 5 });
    expect(r.success).toBe(true);
  });

  it('aceita minuto vindo do formulário como texto', () => {
    const r = activitySessionSchema.safeParse({ ...base, durationMin: '45' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.durationMin).toBe(45);
  });
});

describe('esforço pelo teste da fala', () => {
  it('aceita leve, moderado e intenso — e nada mais', () => {
    for (const effort of ['leve', 'moderado', 'intenso']) {
      expect(activitySessionSchema.safeParse({ ...base, effort }).success).toBe(true);
    }
    expect(activitySessionSchema.safeParse({ ...base, effort: 'muito_intenso' }).success).toBe(
      false,
    );
  });

  it('é opcional: quem não lembra da respiração ainda consegue registrar', () => {
    expect(activitySessionSchema.safeParse({ ...base, effort: undefined }).success).toBe(true);
  });
});

describe('sintomas — múltipla escolha, sem interpretação', () => {
  it('aceita vários sintomas de uma vez', () => {
    const r = activitySessionSchema.safeParse({
      ...base,
      symptoms: ['dor_no_peito', 'falta_de_ar', 'tontura'],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.symptoms).toHaveLength(3);
  });

  it('devolve sempre na mesma ordem e sem repetição', () => {
    const r = activitySessionSchema.safeParse({
      ...base,
      symptoms: ['tontura', 'dor_no_peito', 'tontura'],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.symptoms).toEqual(['dor_no_peito', 'tontura']);
  });

  it('"nenhum" sozinho vale — é a pessoa AFIRMANDO que não sentiu nada', () => {
    const r = activitySessionSchema.safeParse({ ...base, symptoms: ['nenhum'] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.symptoms).toEqual(['nenhum']);
  });

  it('"nenhum" junto com sintoma REPROVA — o registro não afirma as duas coisas', () => {
    const r = activitySessionSchema.safeParse({
      ...base,
      symptoms: ['nenhum', 'palpitacao'],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/Nenhum/);
  });

  it('lista vazia e ["nenhum"] são estados DIFERENTES', () => {
    const semResposta = activitySessionSchema.parse(base);
    const afirmouNada = activitySessionSchema.parse({ ...base, symptoms: ['nenhum'] });
    expect(semResposta.symptoms).not.toEqual(afirmouNada.symptoms);
    expect(descreverSintomas(semResposta.symptoms)).not.toBe(
      descreverSintomas(afirmouNada.symptoms),
    );
  });

  it('recusa sintoma fora da lista', () => {
    expect(activitySessionSchema.safeParse({ ...base, symptoms: ['enjoo'] }).success).toBe(false);
  });

  it('só o "Nenhum" é exclusivo', () => {
    const exclusivos = ACTIVITY_SYMPTOM_OPTIONS.filter((o) => o.exclusivo).map((o) => o.valor);
    expect(exclusivos).toEqual(['nenhum']);
  });
});

describe('como se sentiu depois — a escala do diário, não uma nova', () => {
  it('aceita 1 a 5', () => {
    for (const feelingAfter of [1, 2, 3, 4, 5]) {
      expect(activitySessionSchema.safeParse({ ...base, feelingAfter }).success).toBe(true);
    }
  });

  it('campo em branco sai como "não respondeu", nunca como 0', () => {
    const r = activitySessionSchema.safeParse({ ...base, feelingAfter: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.feelingAfter).toBeUndefined();
      expect(r.data.feelingAfter).not.toBe(0);
    }
  });

  it('recusa 0 e 6 (a escala tem cinco degraus)', () => {
    expect(activitySessionSchema.safeParse({ ...base, feelingAfter: 0 }).success).toBe(false);
    expect(activitySessionSchema.safeParse({ ...base, feelingAfter: 6 }).success).toBe(false);
  });
});

describe('data/hora — opcional de verdade, mas nunca inventada', () => {
  it('data vazia não trava o formulário (regressão do bug do <input type="date">)', () => {
    for (const performedAt of ['', '   ', null, undefined]) {
      const r = activitySessionSchema.safeParse({ ...base, performedAt });
      expect(r.success, `entrada: ${JSON.stringify(performedAt)}`).toBe(true);
      if (r.success) expect(r.data.performedAt).toBeUndefined();
    }
  });

  it('data válida vira Date', () => {
    const r = activitySessionSchema.safeParse({ ...base, performedAt: '2026-08-17T07:30' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.performedAt).toBeInstanceOf(Date);
  });

  it('data que não existe no calendário REPROVA (data errada é pior que ausente)', () => {
    expect(activitySessionSchema.safeParse({ ...base, performedAt: '2026-02-31' }).success).toBe(
      false,
    );
    expect(activitySessionSchema.safeParse({ ...base, performedAt: 'ontem' }).success).toBe(false);
  });

  /**
   * "2062" no lugar de "2026" é uma digitação plausível em teclado numérico, e o
   * calendário aceita o ano sem reclamar. O estrago é silencioso: como a lista
   * ordena da mais recente para a mais antiga, o registro fica cravado no topo
   * para sempre; e como ele não cai em nenhuma semana, o total de "esta semana"
   * não se mexe. A pessoa vê a atividade na lista e não vê a conta mudar, sem
   * nenhuma explicação.
   */
  it('data no FUTURO reprova, com mensagem em português e sem jargão', () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const r = activitySessionSchema.safeParse({
      ...base,
      performedAt: amanha.toISOString().slice(0, 10),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues[0]?.message ?? '';
      expect(msg).toMatch(/data ainda não chegou/i);
      expect(msg).not.toMatch(/invalid|expected|received/i);
    }
  });

  it('HOJE continua valendo (o corte é o fim do dia, não o instante de agora)', () => {
    // Regressão: comparar com `Date.now()` recusaria a caminhada da manhã
    // registrada à tarde — e comparar o dia UTC com o dia local recusaria o
    // registro de hoje inteiro no Brasil.
    const hoje = new Date();
    const r = activitySessionSchema.safeParse({
      ...base,
      performedAt: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(
        hoje.getDate(),
      ).padStart(2, '0')}`,
    });
    expect(r.success).toBe(true);
  });
});

describe('observações', () => {
  it('aceita texto livre e apara espaços', () => {
    const r = activitySessionSchema.safeParse({ ...base, notes: '  Parei duas vezes  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBe('Parei duas vezes');
  });

  it('recusa texto absurdamente longo, com mensagem em português', () => {
    const r = activitySessionSchema.safeParse({ ...base, notes: 'a'.repeat(2001) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/longa/i);
  });
});

describe('edição parcial', () => {
  it('aceita mandar só o campo que mudou', () => {
    const r = activitySessionUpdateSchema.safeParse({ durationMin: 40 });
    expect(r.success).toBe(true);
  });

  it('afrouxa a PRESENÇA, nunca a validação do valor', () => {
    expect(activitySessionUpdateSchema.safeParse({ durationMin: 0 }).success).toBe(false);
    expect(activitySessionUpdateSchema.safeParse({ kind: 'crossfit' }).success).toBe(false);
  });
});

describe('descreverSintomas — não confunde "não respondeu" com "não sentiu"', () => {
  it('lista vazia diz que não foi registrado', () => {
    expect(descreverSintomas([])).toBe('Sintomas não registrados');
    expect(descreverSintomas(null)).toBe('Sintomas não registrados');
    expect(descreverSintomas(undefined)).toBe('Sintomas não registrados');
  });

  it('["nenhum"] diz que a pessoa registrou não ter sentido nada', () => {
    expect(descreverSintomas(['nenhum'])).toBe('Você registrou que não sentiu nada');
  });

  it('lista os sintomas em ordem fixa, sem adjetivo de gravidade', () => {
    const texto = descreverSintomas(['tontura', 'dor_no_peito']);
    expect(texto).toBe('Dor ou aperto no peito · Tontura');
    expect(texto).not.toMatch(/grave|urgente|risco|atenção|alerta/i);
  });

  it('ignora valor desconhecido vindo do banco em vez de quebrar a tela', () => {
    expect(descreverSintomas(['xpto'])).toBe('Sintomas não registrados');
  });
});

describe('semana — conta REGISTRO, nunca aderência', () => {
  it('soma os minutos registrados', () => {
    expect(somaMinutos([{ duration_min: 30 }, { duration_min: 45 }, { duration_min: 45 }])).toBe(
      120,
    );
  });

  it('ignora minuto ausente, negativo ou não numérico — nada é inventado', () => {
    expect(
      somaMinutos([
        { duration_min: 30 },
        { duration_min: null },
        { duration_min: undefined },
        { duration_min: -5 },
        { duration_min: Number.NaN },
      ]),
    ).toBe(30);
  });

  it('escreve o total como fato: "120 minutos registrados nesta semana"', () => {
    const r = resumoSemanaAtividade([{ duration_min: 90 }, { duration_min: 30 }]);
    expect(r.minutos).toBe(120);
    expect(r.registros).toBe(2);
    expect(r.texto).toBe('120 minutos registrados nesta semana');
    expect(r.textoRegistros).toBe('2 atividades registradas');
  });

  it('semana sem registro diz zero, sem suavizar e sem cobrar', () => {
    const r = resumoSemanaAtividade([]);
    expect(r.texto).toBe('0 minutos registrados nesta semana');
    expect(r.texto).not.toMatch(/faltam|restante|meta|comece|vamos/i);
  });

  it('concorda em número no singular', () => {
    const r = resumoSemanaAtividade([{ duration_min: 1 }]);
    expect(r.texto).toBe('1 minuto registrado nesta semana');
    expect(r.textoRegistros).toBe('1 atividade registrada');
  });

  it('NÃO devolve fração, porcentagem, sequência nem nota — não há barra para encher', () => {
    const r = resumoSemanaAtividade([{ duration_min: 200 }]);
    expect(Object.keys(r).sort()).toEqual(['minutos', 'registros', 'texto', 'textoRegistros']);
    for (const proibido of [
      'fracao',
      'porcentagem',
      'meta',
      'sequencia',
      'ofensiva',
      'recorde',
      'nota',
      'cor',
      'status',
      'zona',
    ]) {
      expect(r, `campo proibido presente: ${proibido}`).not.toHaveProperty(proibido);
    }
  });

  it('acima da referência da OMS o texto continua igual — sem "excedeu", sem elogio', () => {
    const acima = resumoSemanaAtividade([{ duration_min: 400 }]);
    expect(acima.texto).toBe('400 minutos registrados nesta semana');
    expect(acima.texto).not.toMatch(
      /parabéns|ótimo|excelente|no caminho certo|excedeu|acima da meta|mandou bem/i,
    );
  });
});

describe('formatarDuracao — como se fala, não como se cronometra', () => {
  it('abaixo de uma hora mostra minutos', () => {
    expect(formatarDuracao(45)).toBe('45 min');
  });

  it('uma hora exata não vira "1 h 0 min"', () => {
    expect(formatarDuracao(60)).toBe('1 h');
  });

  it('mistura hora e minuto', () => {
    expect(formatarDuracao(90)).toBe('1 h 30 min');
  });

  it('milhar com ponto, como se escreve no Brasil', () => {
    expect(formatarDuracao(1200)).toBe('20 h');
    expect(formatarDuracao(1439)).toBe('23 h 59 min');
  });

  it('valor inválido vira zero em vez de "NaN min" na tela', () => {
    expect(formatarDuracao(Number.NaN)).toBe('0 min');
    expect(formatarDuracao(-10)).toBe('0 min');
  });
});

describe('referência da OMS — citada com fonte, nunca meta do app', () => {
  it('são 150 minutos e a fonte está escrita no texto', () => {
    expect(OMS_MINUTOS_SEMANA).toBe(150);
    expect(OMS_REFERENCIA_TEXTO).toMatch(/Organização Mundial da Saúde/);
    expect(OMS_REFERENCIA_TEXTO).toMatch(/2020/);
    expect(OMS_REFERENCIA_TEXTO).toMatch(/150 minutos/);
  });

  it('o texto diz, com todas as letras, que o app não definiu meta nenhuma', () => {
    expect(OMS_REFERENCIA_TEXTO).toMatch(/não uma meta que este app definiu para você/i);
    expect(OMS_REFERENCIA_TEXTO).toMatch(/quem ajusta ao seu caso é sua equipe de saúde/i);
  });

  it('não existe função que transforme a referência em porcentagem atingida', async () => {
    const modulo = await import('../constants/activity');
    const suspeitos = Object.keys(modulo).filter((k) =>
      /progresso|percentual|porcentagem|aderencia|meta[A-Z]|sequencia|ofensiva|streak|score/i.test(
        k,
      ),
    );
    expect(suspeitos).toEqual([]);
  });
});

describe('barril público de @hubpatients/core', () => {
  /**
   * `types/db.ts` importa os vocabulários de `constants/activity.ts` com
   * `import type` justamente para não criar dependência de runtime entre as
   * duas pastas. Este teste carrega o índice INTEIRO do pacote: se algum dia
   * esse `import type` virar `import`, o ciclo aparece aqui e não em produção.
   */
  it('exporta schema, vocabulário e contas — e carrega sem ciclo', async () => {
    const core = await import('../index');
    expect(typeof core.activitySessionSchema.safeParse).toBe('function');
    expect(core.ACTIVITY_KIND_OPTIONS.length).toBe(ACTIVITY_KINDS.length);
    expect(core.resumoSemanaAtividade([{ duration_min: 30 }]).minutos).toBe(30);
    expect(core.OMS_MINUTOS_SEMANA).toBe(OMS_MINUTOS_SEMANA);
  });
});

describe('o vocabulário não vira julgamento', () => {
  it('nenhum rótulo de sintoma carrega gravidade', async () => {
    const { ACTIVITY_SYMPTOM_LABELS } = await import('../constants/activity');
    for (const s of ACTIVITY_SYMPTOMS) {
      expect(ACTIVITY_SYMPTOM_LABELS[s]).not.toMatch(/grave|leve demais|perigo|risco|urgente/i);
    }
  });

  it('a única orientação sobre sintoma é levar o registro à consulta', async () => {
    const { ACTIVITY_SYMPTOMS_NOTA } = await import('../constants/activity');
    expect(ACTIVITY_SYMPTOMS_NOTA).toMatch(/consulta/i);
    expect(ACTIVITY_SYMPTOMS_NOTA).not.toMatch(
      /procure um médico agora|emergência|pronto-socorro|SAMU|192|pare imediatamente/i,
    );
  });

  it('o esforço é descrito pelo teste da fala, com o método escrito', async () => {
    const { ACTIVITY_EFFORT_OPTIONS, ACTIVITY_EFFORT_NOTA } = await import('../constants/activity');
    expect(ACTIVITY_EFFORT_OPTIONS.map((o) => o.descricao)).toEqual([
      'Conseguia conversar e cantar',
      'Conseguia conversar, mas não cantar',
      'Não conseguia manter conversa',
    ]);
    expect(ACTIVITY_EFFORT_NOTA).toMatch(/teste da fala/i);
    expect(ACTIVITY_EFFORT_NOTA).toMatch(/sem precisar de/i);
  });
});
