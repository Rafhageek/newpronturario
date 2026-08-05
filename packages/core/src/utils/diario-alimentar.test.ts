import { describe, it, expect } from 'vitest';
import {
  normalizarFonte,
  fraseDeOrigem,
  origensPresentes,
  progressoNutriente,
  descricaoProgresso,
  numeroBR,
  metasDeMacro,
  totaisDoDia,
  agruparPorRefeicao,
  resumoDaSemana,
  ESCALA_NEUTRA,
  FONTE_ROTULO,
  FONTES_NUTRICIONAIS,
  type ItemAlimentar,
} from './diario-alimentar';
import { MEAL_TYPES } from './meals';

const item = (over: Partial<ItemAlimentar> = {}): ItemAlimentar => ({
  meal_type: 'lunch',
  kcal: 100,
  protein_g: 5,
  carbs_g: 10,
  fat_g: 2,
  fiber_g: 1,
  source: 'taco',
  ...over,
});

describe('origem do dado — a tela não pode assinar fonte que não conferiu', () => {
  it('reconhece as origens gravadas, inclusive os apelidos', () => {
    expect(normalizarFonte('taco')).toBe('taco');
    expect(normalizarFonte('openfoodfacts')).toBe('openfoodfacts');
    expect(normalizarFonte('open_food_facts')).toBe('openfoodfacts');
    expect(normalizarFonte('OFF')).toBe('openfoodfacts');
    expect(normalizarFonte('manual')).toBe('manual');
  });

  it('linha antiga (sem coluna `source`) vira "desconhecida", NUNCA "taco"', () => {
    // Este é o teste que importa: chutar TACO gravaria procedência inventada
    // num documento que a pessoa leva ao médico.
    expect(normalizarFonte(null)).toBe('desconhecida');
    expect(normalizarFonte(undefined)).toBe('desconhecida');
    expect(normalizarFonte('')).toBe('desconhecida');
    expect(normalizarFonte('qualquer coisa')).toBe('desconhecida');
    expect(FONTE_ROTULO.desconhecida).toBe('Origem não registrada');
  });

  it('dia só de TACO recebe a frase curta, e ela nomeia a UNICAMP', () => {
    const frase = fraseDeOrigem(['taco']);
    expect(frase).toContain('Tabela TACO');
    expect(frase).toContain('UNICAMP');
    expect(frase).toContain('estimados');
  });

  it('dia misto NÃO diz apenas "Tabela TACO" — nomeia todas as bases', () => {
    const frase = fraseDeOrigem(['taco', 'openfoodfacts']);
    expect(frase).toContain('Tabela TACO');
    expect(frase).toContain('Open Food Facts');
    expect(frase).toContain('estimados');
  });

  it('valor digitado pela pessoa aparece como tal', () => {
    expect(fraseDeOrigem(['manual'])).toContain('você informou');
  });

  it('toda origem tem uma frase de confiança, e "estimados" nunca some', () => {
    for (const f of FONTES_NUTRICIONAIS) {
      expect(fraseDeOrigem([f])).toContain('estimad');
    }
  });

  it('lê as origens presentes num dia, sem repetir', () => {
    expect(
      origensPresentes([
        item({ source: 'taco' }),
        item({ source: 'taco' }),
        item({ source: 'openfoodfacts' }),
        item({ source: null }),
      ]),
    ).toEqual(['taco', 'openfoodfacts', 'desconhecida']);
  });
});

describe('progresso — número inteiro, veredicto nenhum', () => {
  it('a redação é "X de Y", não "restantes"', () => {
    const p = progressoNutriente(1250, 2000, 'kcal');
    expect(p.texto).toBe('1.250 de 2.000 kcal');
    // "restantes" trata comida como saldo a gastar: é a gramática do app de
    // emagrecimento, e este é um prontuário.
    expect(p.texto).not.toContain('restante');
    expect(p.texto).not.toContain('falta');
  });

  it('sem meta, mostra só o registrado — e diz que o app não sugere meta', () => {
    const p = progressoNutriente(1250, null, 'kcal');
    expect(p.texto).toBe('1.250 kcal');
    expect(p.porcentagem).toBeNull();
    expect(p.fracao).toBe(0);
    expect(descricaoProgresso(p)).toContain('não sugere');
  });

  it('acima da meta continua factual: sem alarme, sem reprovação', () => {
    const p = progressoNutriente(2400, 2000, 'kcal');
    expect(p.porcentagem).toBe(120);
    // A barra até a meta enche; o excedente vai num campo separado para ser
    // desenhado como CONTINUAÇÃO, e não repintando a barra inteira.
    expect(p.fracao).toBe(1);
    expect(p.excedente).toBeCloseTo(0.2, 5);

    const frase = `${p.texto} ${descricaoProgresso(p)}`.toLowerCase();
    for (const palavra of [
      'excedeu',
      'estourou',
      'ultrapassou',
      'passou do limite',
      'cuidado',
      'atenção',
      'parabéns',
      'muito bem',
      'ótimo',
      'no caminho',
    ]) {
      expect(frase, `a frase julgou o que a pessoa comeu: "${palavra}"`).not.toContain(palavra);
    }
  });

  it('a meta é sempre atribuída à pessoa, nunca ao app', () => {
    const p = progressoNutriente(1000, 2000, 'kcal');
    expect(descricaoProgresso(p)).toContain('você definiu');
  });

  it('nenhum campo do progresso é cor, zona ou nota', () => {
    const p = progressoNutriente(1250, 2000, 'kcal');
    const chaves = Object.keys(p);
    for (const proibida of ['cor', 'color', 'zona', 'zone', 'status', 'tone', 'ok', 'nota']) {
      expect(chaves, `"${proibida}" reintroduz o semáforo`).not.toContain(proibida);
    }
  });

  it('valores absurdos não quebram a barra', () => {
    expect(progressoNutriente(-5, 2000, 'kcal').valor).toBe(0);
    expect(progressoNutriente(100, 0, 'kcal').porcentagem).toBeNull();
    expect(progressoNutriente(100, -1, 'kcal').porcentagem).toBeNull();
    expect(progressoNutriente(Number.NaN, 2000, 'kcal').valor).toBe(0);
  });
});

describe('número em português, sem Intl (Hermes derruba o app)', () => {
  it('separa milhar com ponto', () => {
    expect(numeroBR(1250)).toBe('1.250');
    expect(numeroBR(2000)).toBe('2.000');
    expect(numeroBR(999)).toBe('999');
    expect(numeroBR(1234567)).toBe('1.234.567');
    expect(numeroBR(0)).toBe('0');
  });
  it('usa vírgula decimal', () => {
    expect(numeroBR(12.5, 1)).toBe('12,5');
    expect(numeroBR(1250.75, 2)).toBe('1.250,75');
  });
  it('arredonda para o inteiro quando pedem 0 casas', () => {
    expect(numeroBR(12.6)).toBe('13');
  });
});

describe('escala neutra — um matiz só', () => {
  it('é a mesma rampa azul da dor e de chart.sequential', () => {
    for (const hex of ESCALA_NEUTRA) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      // Azul sempre manda e o vermelho nunca passa o verde: é o que impede a
      // rampa de virar semáforo verde→âmbar→vermelho.
      expect(b, `${hex} deixou de ser azul`).toBeGreaterThanOrEqual(g);
      expect(g, `${hex} puxou para o quente`).toBeGreaterThanOrEqual(r);
    }
  });
});

describe('metas de macro', () => {
  it('só existem se a pessoa definiu a meta de energia', () => {
    expect(metasDeMacro(null)).toBeNull();
    expect(metasDeMacro(0)).toBeNull();
    expect(metasDeMacro(undefined)).toBeNull();
  });
  it('derivam da meta da pessoa pelas faixas do Guia Alimentar', () => {
    const m = metasDeMacro(2000);
    expect(m).not.toBeNull();
    expect(m!.protein).toBe(75); // 15% de 2000 / 4 kcal por g
    expect(m!.carbs).toBe(275); // 55% / 4
    expect(m!.fat).toBe(67); // 30% / 9
    expect(m!.fiber).toBe(28); // 14 g por 1000 kcal
  });
});

describe('totais e agrupamento', () => {
  it('soma o dia, inclusive fibra', () => {
    const t = totaisDoDia([item(), item({ kcal: 50, fiber_g: 3 })]);
    expect(t).toEqual({ kcal: 150, protein: 10, carbs: 20, fat: 4, fiber: 4, itens: 2 });
  });

  it('fibra ausente (linha anterior à 0047) conta zero, não NaN', () => {
    expect(totaisDoDia([item({ fiber_g: null })]).fiber).toBe(0);
    expect(totaisDoDia([item({ fiber_g: undefined })]).fiber).toBe(0);
  });

  it('mantém as refeições vazias — a tela precisa oferecer "+ Adicionar" nelas', () => {
    const grupos = agruparPorRefeicao([item({ meal_type: 'lunch' })], MEAL_TYPES);
    expect(grupos).toHaveLength(MEAL_TYPES.length);
    expect(grupos.find((g) => g.tipo === 'lunch')?.itens).toHaveLength(1);
    expect(grupos.find((g) => g.tipo === 'dinner')?.itens).toHaveLength(0);
  });
});

describe('visão da semana — conta registro, não aderência', () => {
  const semana = [
    '2026-08-03',
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
    '2026-08-07',
    '2026-08-08',
    '2026-08-09',
  ];

  it('diz "3 de 7 dias registrados"', () => {
    const r = resumoDaSemana(semana, ['2026-08-03', '2026-08-04', '2026-08-05']);
    expect(r.registrados).toBe(3);
    expect(r.texto).toBe('3 de 7 dias registrados');
  });

  it('a frase fala do DIÁRIO, não da pessoa', () => {
    const texto = resumoDaSemana(semana, semana).texto.toLowerCase();
    for (const palavra of [
      'sequência',
      'ofensiva',
      'seguidos',
      'recorde',
      'meta',
      'aderência',
      'parabéns',
      'perfeito',
    ]) {
      expect(texto, `"${palavra}" transforma registro em cobrança`).not.toContain(palavra);
    }
    expect(texto).toContain('registrados');
  });

  it('marca dia a dia, na ordem recebida', () => {
    const r = resumoDaSemana(semana, ['2026-08-06']);
    expect(r.dias.map((d) => d.registrado)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
  });

  it('semana vazia não vira zero disfarçado', () => {
    expect(resumoDaSemana(semana, []).texto).toBe('0 de 7 dias registrados');
  });
});
