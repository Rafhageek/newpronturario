import { TACO_FOODS, type TacoFood } from '../data/taco';

export { TACO_FOODS };
export type { TacoFood };

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Índice normalizado (construído sob demanda) para busca sem acento.
let INDEX: { food: TacoFood; n: string }[] | null = null;
function index() {
  if (!INDEX) INDEX = TACO_FOODS.map((food) => ({ food, n: norm(food.name) }));
  return INDEX;
}

/**
 * Busca alimentos da TACO por nome (sem acento; exige todas as palavras).
 * Prioriza quem começa com o termo. Retorna no máx. `limit`.
 */
export function searchFoods(query: string, limit = 30): TacoFood[] {
  const q = norm(query).trim();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const matches: { food: TacoFood; n: string }[] = [];
  for (const item of index()) {
    if (terms.every((t) => item.n.includes(t))) matches.push(item);
  }
  matches.sort((a, b) => {
    const sa = a.n.startsWith(q) ? 0 : 1;
    const sb = b.n.startsWith(q) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.n.length - b.n.length;
  });
  return matches.slice(0, limit).map((m) => m.food);
}

/* ────────────────────────────── Sódio ────────────────────────────── */

/**
 * O que a TACO sabe sobre o sódio de um alimento. São TRÊS estados, e não dois,
 * porque a fonte tem três:
 *
 *   `medido`    — a tabela traz o número (523 dos 597 alimentos);
 *   `traco`     — a tabela traz "Tr": analisado e abaixo do limite de
 *                 quantificação (64 alimentos). Não é zero e não é ignorância;
 *   `sem-dado`  — a tabela não traz valor (10 alimentos).
 *
 * Achatar os dois últimos em `0` seria o app afirmando "este alimento não tem
 * sódio" sobre algo que ninguém mediu — e quem lê isso aqui é gente com
 * hipertensão, para quem esse número é decisão de tratamento. É a mesma regra
 * pela qual a fibra ausente na Open Food Facts fica em branco.
 */
export type EstadoDeSodio = 'medido' | 'traco' | 'sem-dado';

export interface SodioDeAlimento {
  estado: EstadoDeSodio;
  /** Sódio em mg da porção. Só existe quando `estado === 'medido'`. */
  mg: number | null;
}

/** Como a TACO classifica o sódio deste alimento, sem escalar por porção. */
export function estadoDeSodio(food: TacoFood): EstadoDeSodio {
  if (typeof food.sodium === 'number' && Number.isFinite(food.sodium)) return 'medido';
  if (food.sodiumTraco) return 'traco';
  return 'sem-dado';
}

/** Sódio da porção, em mg — arredondado ao inteiro, que é como o rótulo escreve. */
export function sodioParaGramas(food: TacoFood, grams: number): SodioDeAlimento {
  const estado = estadoDeSodio(food);
  if (estado !== 'medido') return { estado, mg: null };
  const r = (Number.isFinite(grams) && grams > 0 ? grams : 0) / 100;
  return { estado, mg: Math.round((food.sodium as number) * r) };
}

/** Busca pelo id que fica gravado em `source_ref` quando a origem é a TACO. */
export function tacoFoodPorId(id: number | string | null | undefined): TacoFood | null {
  const n = typeof id === 'string' ? Number(id.trim()) : id;
  if (n == null || !Number.isFinite(n)) return null;
  return TACO_FOODS.find((f) => f.id === n) ?? null;
}

/**
 * REFERÊNCIA GERAL, NÃO META DO APP.
 *
 * A Organização Mundial da Saúde recomenda menos de 2 g (2.000 mg) de sódio por
 * dia para adultos — equivalente a 5 g de sal de cozinha (Guideline: sodium
 * intake for adults and children, OMS, 2012).
 *
 * Está escrito aqui com a fonte à vista, do mesmo jeito que as faixas de pressão
 * citam a diretriz que as publicou: é um número de saúde pública, para a
 * população, e NÃO um alvo que o HubPatients definiu para esta pessoa. Quem tem
 * hipertensão, doença renal ou insuficiência cardíaca costuma receber um número
 * diferente da própria equipe — e é esse que vale. O app não sugere meta de
 * sódio, não desenha alvo e não avisa quando o dia passa de nada.
 */
export const SODIO_REFERENCIA_OMS_MG = 2000;

export const SODIO_REFERENCIA_NOTA =
  'Para comparação: a OMS recomenda menos de 2.000 mg de sódio por dia para adultos em geral (Guideline: sodium intake for adults and children, 2012). É uma referência de saúde pública, não uma meta que o app definiu para você — quem define a sua é sua equipe de saúde.';

export const SODIO_SEM_SAL_ADICIONADO_NOTA =
  'Os preparados da TACO foram cozidos sem sal (protocolo da 4ª edição). O sal que você põe na panela ou no prato não entra nesta conta.';

/* ───────────────────────── Composição por porção ───────────────────────── */

export type NutritionValues = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /**
   * A TACO traz fibra nos 597 alimentos e o app descartava. É o nutriente que
   * mais importa clinicamente (constipação, diabetes, doença diverticular) e o
   * mais difícil de estimar de cabeça — não havia motivo para jogar fora.
   */
  fiber: number;
  /**
   * Sódio em mg da porção, ou `null` quando a TACO não traz número.
   * `null` NÃO significa "sem sódio": veja `sodiumEstado` para saber se foi
   * traço ou se ninguém mediu.
   */
  sodium: number | null;
  sodiumEstado: EstadoDeSodio;
};

/** Escala a composição (que na TACO é por 100 g) para `grams` gramas. */
export function nutritionForGrams(food: TacoFood, grams: number): NutritionValues {
  const r = (Number.isFinite(grams) && grams > 0 ? grams : 0) / 100;
  const uma = (v: number) => Math.round(v * r * 10) / 10;
  const sodio = sodioParaGramas(food, grams);
  return {
    kcal: Math.round(food.kcal * r),
    protein: uma(food.protein),
    carbs: uma(food.carbs),
    fat: uma(food.fat),
    fiber: uma(food.fiber),
    sodium: sodio.mg,
    sodiumEstado: sodio.estado,
  };
}

/* ────────────────────────── Sódio somado do dia ────────────────────────── */

/**
 * O mínimo que um item precisa ter para o app conseguir recuperar o sódio dele.
 * Repare que NÃO existe campo `sodium_mg`: o banco ainda não guarda sódio, e
 * inventar um não resolveria — o que dá para fazer hoje é reler a TACO pelo
 * mesmo id que já ficou gravado em `source_ref` quando o item veio de lá.
 */
export interface ItemComSodio {
  grams: number;
  source?: string | null;
  source_ref?: string | null;
}

export interface SodioDoDia {
  /** Soma, em mg, apenas do que a TACO mediu. */
  mg: number;
  /** Quantos itens entraram na soma. */
  medidos: number;
  /** Itens da TACO marcados como traço — presentes, porém não somáveis. */
  traco: number;
  /** Itens cujo sódio o app não tem como saber (outras bases, digitados, TACO sem valor). */
  semDado: number;
  /** Total de itens examinados. */
  itens: number;
}

/**
 * Sódio somado de um dia do diário.
 *
 * A soma cobre SÓ os itens que vieram da TACO com valor medido, e o resultado
 * carrega a contagem do que ficou de fora para a tela poder dizer isso em letra.
 * Um total que engolisse os itens sem dado seria um número menor apresentado
 * como se fosse o dia inteiro — a mentira mais fácil de cometer aqui, e a pior,
 * porque ela tranquiliza quem precisa de sal controlado.
 */
export function sodioDoDia(itens: readonly ItemComSodio[]): SodioDoDia {
  const total: SodioDoDia = { mg: 0, medidos: 0, traco: 0, semDado: 0, itens: itens.length };
  for (const item of itens) {
    const daTaco = (item.source ?? '').trim().toLowerCase() === 'taco';
    const food = daTaco ? tacoFoodPorId(item.source_ref) : null;
    if (!food) {
      total.semDado += 1;
      continue;
    }
    const sodio = sodioParaGramas(food, Number(item.grams));
    if (sodio.estado === 'medido' && sodio.mg != null) {
      total.mg += sodio.mg;
      total.medidos += 1;
    } else if (sodio.estado === 'traco') {
      total.traco += 1;
    } else {
      total.semDado += 1;
    }
  }
  return total;
}

/**
 * A frase de cobertura que acompanha o total — factual, sem adjetivo.
 * Nunca diz "pouco", "muito", "dentro" nem "acima": diz de quantos itens o
 * número saiu e quantos ficaram de fora, e para por aí.
 */
export function coberturaDoSodio(t: SodioDoDia): string {
  if (t.itens === 0) return 'Nenhum item registrado neste dia.';
  if (t.medidos === 0) {
    return 'Nenhum item deste dia tem sódio na Tabela TACO — o app não estima esse valor.';
  }
  const partes = [
    `somado de ${t.medidos} de ${t.itens} ${t.itens === 1 ? 'item' : 'itens'} do dia`,
  ];
  if (t.traco > 0) {
    partes.push(`${t.traco} com traço na TACO (abaixo do limite de medição)`);
  }
  if (t.semDado > 0) {
    partes.push(`${t.semDado} sem sódio informado`);
  }
  return `${partes.join('; ')}.`;
}

/**
 * Aviso do rodapé quando TUDO no dia veio da TACO.
 *
 * Para um dia com itens de origens diferentes (Open Food Facts, valores
 * digitados pela pessoa), use `fraseDeOrigem()` de `diario-alimentar.ts` — ela
 * nomeia as bases que realmente estão ali. Assinar "Tabela TACO" embaixo de um
 * número que veio de outro lugar é o app afirmando o que não conferiu.
 */
export const NUTRITION_DISCLAIMER =
  'Valores da Tabela TACO (UNICAMP), por estimativa. É um registro pessoal, não uma dieta nem recomendação — confirme metas de energia com sua equipe de saúde.';
