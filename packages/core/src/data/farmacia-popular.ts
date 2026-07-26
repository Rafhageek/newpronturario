/**
 * Elenco GRATUITO do Programa Farmácia Popular (Ministério da Saúde).
 *
 * Desde 14/02/2025 o programa é 100% gratuito (acabou o copagamento) e o elenco
 * tem 41 itens entre medicamentos e insumos, cobrindo hipertensão, diabetes,
 * asma, rinite, dislipidemia, osteoporose, glaucoma, doença de Parkinson,
 * diabetes com doença cardiovascular, anticoncepção e incontinência.
 * A retirada exige receita válida, documento com foto e a autorização gerada no
 * Meu SUS Digital, que vale 180 dias, em farmácia credenciada.
 *
 * Fonte: https://agenciagov.ebc.com.br/noticias/202503/saiba-como-retirar-medicamentos-e-insumos-pelo-farmacia-popular
 * Checado em: 2026-07-25.
 *
 * ⚠️ REVISÃO PERIÓDICA OBRIGATÓRIA. O elenco muda por portaria do Ministério da
 * Saúde (itens entram e saem). Esta lista é uma referência informativa e NÃO é
 * garantia de disponibilidade: a lista oficial trabalha com apresentações e
 * códigos EAN específicos, então marca/apresentação podem não ser aceitas mesmo
 * quando o princípio ativo consta aqui. Reconferir no portal gov.br a cada
 * atualização do app e ajustar `FARMACIA_POPULAR_CHECKED_AT`.
 *
 * NOTA DE MODELAGEM: os 41 itens oficiais contam APRESENTAÇÕES (concentrações e
 * formas). Aqui agrupamos por PRINCÍPIO ATIVO — as apresentações do elenco ficam
 * em `note`. Alguns princípios ativos aparecem em mais de uma indicação oficial
 * (ex.: dipropionato de beclometasona em asma e rinite); nesses casos há uma só
 * entrada, com a observação no `note`.
 */

export const FARMACIA_POPULAR_SOURCE_URL =
  'https://agenciagov.ebc.com.br/noticias/202503/saiba-como-retirar-medicamentos-e-insumos-pelo-farmacia-popular';

/** Data da última conferência do elenco contra a fonte oficial (AAAA-MM-DD). */
export const FARMACIA_POPULAR_CHECKED_AT = '2026-07-25';

/** Validade, em dias, da autorização gerada no Meu SUS Digital. */
export const FARMACIA_POPULAR_AUTHORIZATION_DAYS = 180;

export type FarmaciaPopularCategory =
  | 'hipertensao'
  | 'diabetes'
  | 'diabetes-cardiovascular'
  | 'asma'
  | 'rinite'
  | 'dislipidemia'
  | 'osteoporose'
  | 'glaucoma'
  | 'parkinson'
  | 'anticoncepcao'
  | 'incontinencia';

export const FARMACIA_POPULAR_CATEGORY_LABELS: Record<FarmaciaPopularCategory, string> = {
  hipertensao: 'Hipertensão',
  diabetes: 'Diabetes',
  'diabetes-cardiovascular': 'Diabetes com doença cardiovascular',
  asma: 'Asma',
  rinite: 'Rinite',
  dislipidemia: 'Colesterol alto',
  osteoporose: 'Osteoporose',
  glaucoma: 'Glaucoma',
  parkinson: 'Doença de Parkinson',
  anticoncepcao: 'Anticoncepção',
  incontinencia: 'Incontinência',
};

export interface FarmaciaPopularItem {
  /** Slug estável (nunca reutilizar um id para outro princípio ativo). */
  id: string;
  /** Princípio ativo como consta no elenco (com o sal, quando houver). */
  activeIngredient: string;
  category: FarmaciaPopularCategory;
  /** Apresentações do elenco e observações de retirada. */
  note?: string;
  /**
   * Termos de busca já sem o sal/éster — na prática o paciente cadastra
   * "Losartana 50mg", nunca "losartana potássica". Comparados em minúsculo, sem
   * acento e ancorados no início da palavra (ver `utils/farmacia-popular.ts`).
   * Quando ausente, o próprio `activeIngredient` normalizado é usado.
   */
  terms?: readonly string[];
}

export const FARMACIA_POPULAR_ITEMS: readonly FarmaciaPopularItem[] = [
  // ── Hipertensão ─────────────────────────────────────────────────────────
  { id: 'atenolol', activeIngredient: 'Atenolol', category: 'hipertensao', note: '25 mg' },
  {
    id: 'anlodipino',
    activeIngredient: 'Besilato de anlodipino',
    category: 'hipertensao',
    note: '5 mg',
    terms: ['anlodipino', 'amlodipino'],
  },
  { id: 'captopril', activeIngredient: 'Captopril', category: 'hipertensao', note: '25 mg' },
  {
    id: 'propranolol',
    activeIngredient: 'Cloridrato de propranolol',
    category: 'hipertensao',
    note: '40 mg',
    terms: ['propranolol'],
  },
  { id: 'espironolactona', activeIngredient: 'Espironolactona', category: 'hipertensao', note: '25 mg' },
  { id: 'furosemida', activeIngredient: 'Furosemida', category: 'hipertensao', note: '40 mg' },
  { id: 'hidroclorotiazida', activeIngredient: 'Hidroclorotiazida', category: 'hipertensao', note: '25 mg' },
  {
    id: 'losartana',
    activeIngredient: 'Losartana potássica',
    category: 'hipertensao',
    note: '50 mg',
    terms: ['losartana', 'losartan'],
  },
  {
    id: 'enalapril',
    activeIngredient: 'Maleato de enalapril',
    category: 'hipertensao',
    note: '10 mg',
    terms: ['enalapril'],
  },
  {
    id: 'metoprolol',
    activeIngredient: 'Succinato de metoprolol',
    category: 'hipertensao',
    note: '25 mg',
    terms: ['metoprolol'],
  },

  // ── Diabetes ────────────────────────────────────────────────────────────
  {
    id: 'metformina',
    activeIngredient: 'Cloridrato de metformina',
    category: 'diabetes',
    note: '500 mg, 500 mg de ação prolongada e 850 mg',
    terms: ['metformina'],
  },
  { id: 'glibenclamida', activeIngredient: 'Glibenclamida', category: 'diabetes', note: '5 mg' },
  {
    id: 'insulina-humana-nph',
    activeIngredient: 'Insulina humana NPH',
    category: 'diabetes',
    // Termos com duas palavras de propósito: "insulina" sozinha traria glargina,
    // lispro e asparte, que NÃO estão no elenco.
    note: '100 UI/ml — frasco, refil e caneta descartável',
    terms: ['insulina nph', 'insulina humana nph'],
  },
  {
    id: 'insulina-humana-regular',
    activeIngredient: 'Insulina humana regular',
    category: 'diabetes',
    note: '100 UI/ml — frasco, refil e caneta descartável',
    terms: ['insulina regular', 'insulina humana regular', 'insulina humana'],
  },

  // ── Diabetes com doença cardiovascular ──────────────────────────────────
  {
    id: 'dapagliflozina',
    activeIngredient: 'Dapagliflozina',
    category: 'diabetes-cardiovascular',
    note: '10 mg — elenco com critérios clínicos específicos',
  },

  // ── Asma ────────────────────────────────────────────────────────────────
  {
    id: 'ipratropio',
    activeIngredient: 'Brometo de ipratrópio',
    category: 'asma',
    note: '0,02 mg/ml e 0,25 mg/ml — solução inalatória',
    terms: ['ipratropio'],
  },
  {
    id: 'beclometasona',
    activeIngredient: 'Dipropionato de beclometasona',
    category: 'asma',
    note: '50, 200 e 250 mcg. Também consta para rinite, no spray nasal de 50 mcg/dose',
    terms: ['beclometasona'],
  },
  {
    id: 'salbutamol',
    activeIngredient: 'Sulfato de salbutamol',
    category: 'asma',
    note: '100 mcg (aerossol) e 5 mg/ml (solução inalatória)',
    terms: ['salbutamol'],
  },

  // ── Rinite ──────────────────────────────────────────────────────────────
  {
    id: 'budesonida',
    activeIngredient: 'Budesonida',
    category: 'rinite',
    note: '32 mcg e 50 mcg — spray nasal',
  },

  // ── Colesterol alto ─────────────────────────────────────────────────────
  { id: 'sinvastatina', activeIngredient: 'Sinvastatina', category: 'dislipidemia', note: '10, 20 e 40 mg' },

  // ── Osteoporose ─────────────────────────────────────────────────────────
  {
    id: 'alendronato',
    activeIngredient: 'Alendronato de sódio',
    category: 'osteoporose',
    note: '70 mg',
    terms: ['alendronato'],
  },

  // ── Glaucoma ────────────────────────────────────────────────────────────
  {
    id: 'timolol',
    activeIngredient: 'Maleato de timolol',
    category: 'glaucoma',
    note: '2,5 mg/ml (0,25%) e 5 mg/ml (0,5%) — colírio',
    terms: ['timolol'],
  },

  // ── Doença de Parkinson ─────────────────────────────────────────────────
  {
    id: 'carbidopa-levodopa',
    activeIngredient: 'Carbidopa + levodopa',
    category: 'parkinson',
    note: '25 mg + 250 mg',
    terms: ['carbidopa'],
  },
  {
    id: 'benserazida-levodopa',
    activeIngredient: 'Cloridrato de benserazida + levodopa',
    category: 'parkinson',
    note: '25 mg + 100 mg',
    terms: ['benserazida', 'levodopa'],
  },

  // ── Anticoncepção ───────────────────────────────────────────────────────
  {
    id: 'medroxiprogesterona',
    activeIngredient: 'Acetato de medroxiprogesterona',
    category: 'anticoncepcao',
    note: '150 mg/ml — injetável trimestral',
    terms: ['medroxiprogesterona'],
  },
  {
    id: 'etinilestradiol-levonorgestrel',
    activeIngredient: 'Etinilestradiol + levonorgestrel',
    category: 'anticoncepcao',
    // Só "levonorgestrel": "etinilestradiol" sozinho apareceria em combinações
    // (gestodeno, ciproterona…) que não estão no elenco.
    note: '0,03 mg + 0,15 mg',
    terms: ['levonorgestrel'],
  },
  {
    id: 'noretisterona',
    activeIngredient: 'Noretisterona',
    category: 'anticoncepcao',
    note: '0,35 mg',
  },
  {
    id: 'estradiol-noretisterona',
    activeIngredient: 'Valerato de estradiol + enantato de noretisterona',
    category: 'anticoncepcao',
    note: '5 mg + 50 mg — injetável mensal',
    terms: ['valerato de estradiol'],
  },

  // ── Incontinência (insumo) ──────────────────────────────────────────────
  {
    id: 'fralda-geriatrica',
    activeIngredient: 'Fralda geriátrica',
    category: 'incontinencia',
    note: 'Insumo com regras próprias de idade e quantidade mensal — confirme na farmácia',
    terms: ['fralda geriatrica'],
  },
];
