/* ==========================================================================
 * DIÁRIO ALIMENTAR — a lógica que as duas telas (web e mobile) compartilham
 *
 * Este módulo carrega três decisões de produto que não são detalhe de estilo, e
 * por isso moram aqui, testadas, e não espalhadas em JSX:
 *
 * 1. ORIGEM DO DADO. A tela não pode assinar "Tabela TACO" embaixo de um número
 *    que veio da Open Food Facts (base colaborativa, que erra) ou que a própria
 *    pessoa digitou olhando o rótulo. `fraseDeOrigem()` monta a legenda a partir
 *    do que REALMENTE está no prato do dia.
 *
 * 2. PROGRESSO SEM JULGAMENTO. Nada aqui devolve "bom", "ruim", "estourou" nem
 *    cor. Devolve fração, porcentagem e texto factual. Quem lê decide — e quem
 *    interpreta é a equipe de saúde. Ver `progressoNutriente`.
 *
 * 3. A SEMANA CONTA REGISTRO, NÃO ADERÊNCIA. "3 de 7 dias registrados" fala do
 *    diário; "3 de 7 dias dentro da meta" falaria da pessoa. Só o primeiro é
 *    prontuário; o segundo é dieta com boletim. Ver `resumoDaSemana`.
 *
 * Por que tanto cuidado: este diário é usado por gente com doença crônica e por
 * famílias com crianças. Interface de contagem de calorias tem risco documentado
 * de alimentar transtorno alimentar, e o agravante aqui é o contexto médico —
 * o que o prontuário afirma tem peso de laudo para quem lê.
 * ========================================================================== */

import type { MealType } from './meals';

/* ─────────────────────────── Origem do dado ─────────────────────────── */

/**
 * De onde veio a composição nutricional de um item.
 * `desconhecida` cobre os registros anteriores à coluna `source`: para eles a
 * tela diz "origem não registrada" em vez de chutar TACO. Chutar seria
 * exatamente o defeito que este módulo existe para impedir.
 */
export type FonteNutricional = 'taco' | 'openfoodfacts' | 'manual' | 'desconhecida';

export const FONTES_NUTRICIONAIS: FonteNutricional[] = [
  'taco',
  'openfoodfacts',
  'manual',
  'desconhecida',
];

/** Nome curto, para o item da lista. */
export const FONTE_ROTULO: Record<FonteNutricional, string> = {
  taco: 'TACO',
  openfoodfacts: 'Open Food Facts',
  manual: 'Informado por você',
  desconhecida: 'Origem não registrada',
};

/** Nome completo, para a legenda e para o relatório que vai ao médico. */
export const FONTE_ROTULO_LONGO: Record<FonteNutricional, string> = {
  taco: 'Tabela TACO (UNICAMP)',
  openfoodfacts: 'Open Food Facts (base colaborativa)',
  manual: 'valores que você informou',
  desconhecida: 'itens sem origem registrada',
};

/** Texto de uma linha explicando o quanto se pode confiar em cada origem. */
export const FONTE_CONFIANCA: Record<FonteNutricional, string> = {
  taco: 'Tabela oficial da UNICAMP para alimentos brasileiros. Valor médio, não do seu prato.',
  openfoodfacts:
    'Base colaborativa, preenchida por voluntários — pode estar desatualizada ou errada. Confira o rótulo.',
  manual: 'Você digitou estes valores. O app não conferiu nada.',
  desconhecida: 'Registrado antes de o app guardar a origem. Não dá para dizer de onde veio.',
};

/** Aceita o que vier do banco (inclusive `null` de linha antiga) sem inventar. */
export function normalizarFonte(valor: string | null | undefined): FonteNutricional {
  const v = (valor ?? '').trim().toLowerCase();
  if (v === 'taco') return 'taco';
  if (v === 'openfoodfacts' || v === 'open_food_facts' || v === 'off') return 'openfoodfacts';
  if (v === 'manual' || v === 'custom') return 'manual';
  return 'desconhecida';
}

/**
 * Legenda honesta do rodapé, montada a partir das origens que de fato estão no
 * dia. Um dia só de TACO recebe a frase curta de sempre; um dia misto nomeia
 * todas as bases. A palavra "estimados" nunca sai — é ela que impede o número
 * de ser lido como medição.
 */
export function fraseDeOrigem(fontes: readonly FonteNutricional[]): string {
  const presentes = FONTES_NUTRICIONAIS.filter((f) => fontes.includes(f));

  if (presentes.length === 0) {
    return 'Os valores nutricionais são estimados — não são uma medição do seu prato.';
  }
  if (presentes.length === 1 && presentes[0] === 'taco') {
    return 'Valores estimados pela Tabela TACO (UNICAMP) — média do alimento, não do seu prato.';
  }

  const nomes = presentes.map((f) => FONTE_ROTULO_LONGO[f]);
  const lista =
    nomes.length === 1
      ? nomes[0]
      : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
  return `Valores estimados, de origens diferentes: ${lista}. Confira com sua equipe de saúde antes de usar como referência.`;
}

/** As origens presentes num conjunto de itens, sem repetição e em ordem fixa. */
export function origensPresentes(
  itens: readonly { source?: string | null }[],
): FonteNutricional[] {
  const vistas = new Set(itens.map((i) => normalizarFonte(i.source)));
  return FONTES_NUTRICIONAIS.filter((f) => vistas.has(f));
}

/* ─────────────────────── Progresso sem julgamento ─────────────────────── */

/**
 * O estado de um número em relação à referência que a PESSOA definiu.
 * Repare no que não existe aqui: nenhum campo `ok`, `zona`, `status` ou `cor`.
 * Um mapa zona→cor é o semáforo, e semáforo em dado do corpo é diagnóstico
 * disfarçado (a mesma regra travada em `regra-cor-clinica.test.ts`).
 */
export interface ProgressoNutriente {
  /** Quanto foi registrado hoje. */
  valor: number;
  /** A referência definida pela pessoa, ou `null` se ela não definiu nenhuma. */
  meta: number | null;
  /** Parte da barra até a meta, 0–1. Passou da meta? Fica em 1. */
  fracao: number;
  /**
   * O que passou da meta, também em 0–1 da meta (0,08 = 8% acima).
   * Fica num campo separado para a tela desenhar o excedente como CONTINUAÇÃO
   * da barra — e não pintando a barra inteira de outra cor, que é o gesto de
   * reprovação que estamos evitando.
   */
  excedente: number;
  /** Porcentagem inteira da meta (pode passar de 100). `null` sem meta. */
  porcentagem: number | null;
  /** "1.250 de 2.000 kcal" — ou "1.250 kcal" quando não há meta. */
  texto: string;
}

/** Milhar com ponto, como se escreve no Brasil. Sem `Intl` (Hermes). */
export function numeroBR(valor: number, casas = 0): string {
  const fixo = Math.abs(valor).toFixed(casas);
  const [inteiro, decimal] = fixo.split('.');
  const comPonto = (inteiro ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sinal = valor < 0 ? '-' : '';
  return decimal ? `${sinal}${comPonto},${decimal}` : `${sinal}${comPonto}`;
}

/**
 * Monta o progresso de um nutriente.
 *
 * A REDAÇÃO É A PARTE IMPORTANTE. "1.250 de 2.000 kcal" é a mesma informação
 * que "750 kcal restantes", mas não é a mesma frase: "restantes" trata comida
 * como saldo a gastar, e é a gramática do aplicativo de emagrecimento, não do
 * prontuário. O número continua todo aqui — o que muda é o que a tela afirma
 * sobre ele.
 */
export function progressoNutriente(
  valor: number,
  meta: number | null | undefined,
  unidade: string,
): ProgressoNutriente {
  const v = Number.isFinite(valor) && valor > 0 ? valor : 0;
  const m = meta != null && Number.isFinite(meta) && meta > 0 ? meta : null;
  const casas = unidade === 'g' ? 0 : 0;

  if (m == null) {
    return {
      valor: v,
      meta: null,
      fracao: 0,
      excedente: 0,
      porcentagem: null,
      texto: `${numeroBR(v, casas)} ${unidade}`,
    };
  }

  const bruta = v / m;
  return {
    valor: v,
    meta: m,
    fracao: Math.min(1, bruta),
    excedente: Math.max(0, bruta - 1),
    porcentagem: Math.round(bruta * 100),
    texto: `${numeroBR(v, casas)} de ${numeroBR(m, casas)} ${unidade}`,
  };
}

/**
 * Frase de apoio embaixo do número. Descreve a POSIÇÃO, nunca o desempenho:
 * não existe "parabéns", "você excedeu", "faltam", "no caminho certo".
 */
export function descricaoProgresso(p: ProgressoNutriente): string {
  if (p.porcentagem == null) return 'Sem meta definida — o app não sugere uma.';
  if (p.excedente > 0) return `${p.porcentagem}% da meta que você definiu`;
  return `${p.porcentagem}% da meta que você definiu`;
}

/* ─────────────────────────── Escala neutra ─────────────────────────── */

/**
 * Rampa de UM matiz (o mesmo azul de `painIntensityColor` e de `chart.sequential`).
 * Existe para o progresso ter tinta sem ter veredicto: mais preenchimento é
 * mais tinta do MESMO azul, e nunca a troca verde→âmbar→vermelho que diria
 * "bem / atenção / mal" sobre o que a pessoa comeu.
 *
 * A informação de verdade está no COMPRIMENTO e no NÚMERO, que sobrevivem ao
 * daltonismo, ao sol na tela e à impressão em preto e branco (WCAG SC 1.4.1).
 */
export const ESCALA_NEUTRA = ['#e5e7eb', '#b4cfff', '#6991dc', '#31559a', '#17397b'] as const;

/**
 * As telas NÃO leem hexadecimal daqui: cada uma usa o token equivalente do seu
 * tema (`var(--primary)` e `var(--status-neutro-*)` na web, `colors.primary` e
 * `status[tema].neutro` no mobile), que são deste mesmo matiz e acompanham o
 * modo escuro. Esta constante é a referência escrita da família — e é o que o
 * teste vigia para a rampa nunca virar verde→âmbar→vermelho.
 */

/* ──────────────────────────── Macros do dia ──────────────────────────── */

export type Macro = 'protein' | 'carbs' | 'fat' | 'fiber';

export const MACROS: Macro[] = ['protein', 'carbs', 'fat', 'fiber'];

export const MACRO_ROTULO: Record<Macro, string> = {
  protein: 'Proteínas',
  carbs: 'Carboidratos',
  fat: 'Gorduras',
  fiber: 'Fibras',
};

export interface ItemAlimentar {
  meal_type: MealType;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
  source?: string | null;
}

export interface TotaisDoDia {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  itens: number;
}

export function totaisDoDia(itens: readonly ItemAlimentar[]): TotaisDoDia {
  return itens.reduce<TotaisDoDia>(
    (a, e) => ({
      kcal: a.kcal + (Number(e.kcal) || 0),
      protein: a.protein + (Number(e.protein_g) || 0),
      carbs: a.carbs + (Number(e.carbs_g) || 0),
      fat: a.fat + (Number(e.fat_g) || 0),
      fiber: a.fiber + (Number(e.fiber_g) || 0),
      itens: a.itens + 1,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, itens: 0 },
  );
}

/**
 * Metas de macro derivadas da meta de energia, quando ela existe.
 *
 * Faixas de distribuição aceitável de macronutrientes (AMDR) do Institute of
 * Medicine, adotadas pelo Guia Alimentar: 15% proteína, 55% carboidrato, 30%
 * gordura. Fibra vem da recomendação de 14 g por 1.000 kcal.
 *
 * É uma CONTA A PARTIR DO NÚMERO DA PESSOA, não uma prescrição do app — por isso
 * só existe se ela definiu a meta de energia, e por isso a tela precisa dizer de
 * onde a conta saiu. Sem meta de energia, não há meta de macro: o app não
 * inventa alvo para ninguém.
 */
export function metasDeMacro(metaKcal: number | null | undefined): Record<Macro, number> | null {
  if (metaKcal == null || !Number.isFinite(metaKcal) || metaKcal <= 0) return null;
  return {
    // 4 kcal/g em proteína e carboidrato, 9 kcal/g em gordura.
    protein: Math.round((metaKcal * 0.15) / 4),
    carbs: Math.round((metaKcal * 0.55) / 4),
    fat: Math.round((metaKcal * 0.3) / 9),
    fiber: Math.round((metaKcal / 1000) * 14),
  };
}

export const METAS_DE_MACRO_NOTA =
  'As metas de proteína, carboidrato, gordura e fibra são calculadas a partir da sua meta de energia, pelas faixas gerais do Guia Alimentar. Não são uma prescrição — quem ajusta ao seu caso é sua equipe de saúde.';

/* ───────────────────────── Refeições e semana ───────────────────────── */

export interface RefeicaoAgrupada<T extends ItemAlimentar> {
  tipo: MealType;
  itens: T[];
  kcal: number;
}

/** Agrupa por refeição mantendo TODAS as refeições, inclusive as vazias. */
export function agruparPorRefeicao<T extends ItemAlimentar>(
  itens: readonly T[],
  ordem: readonly MealType[],
): RefeicaoAgrupada<T>[] {
  return ordem.map((tipo) => {
    const doTipo = itens.filter((i) => i.meal_type === tipo);
    return {
      tipo,
      itens: doTipo,
      kcal: doTipo.reduce((s, i) => s + (Number(i.kcal) || 0), 0),
    };
  });
}

export interface ResumoSemana {
  /** Os 7 dias, em ordem, com a marca de "teve registro". */
  dias: { dia: string; registrado: boolean }[];
  registrados: number;
  /** "3 de 7 dias registrados" — conta o DIÁRIO, não a pessoa. */
  texto: string;
}

/**
 * Quantos dos 7 dias têm ao menos um item.
 *
 * Deliberadamente NÃO existe aqui: sequência, ofensiva, recorde, "melhor
 * semana", ou qualquer contagem que premie constância. Um diário que pontua
 * assiduidade vira obrigação, e obrigação em registro alimentar é justamente o
 * mecanismo que a literatura de transtorno alimentar descreve. Contar dias
 * registrados responde "tenho material para levar ao médico?" e para por aí.
 */
export function resumoDaSemana(
  diasDaSemana: readonly string[],
  diasComRegistro: readonly string[],
): ResumoSemana {
  const comRegistro = new Set(diasComRegistro);
  const dias = diasDaSemana.map((dia) => ({ dia, registrado: comRegistro.has(dia) }));
  const registrados = dias.filter((d) => d.registrado).length;
  return {
    dias,
    registrados,
    texto: `${registrados} de ${diasDaSemana.length} dias registrados`,
  };
}
