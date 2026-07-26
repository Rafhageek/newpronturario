/**
 * Medicamentos mais usados no Brasil — recorte para busca e autocompletar.
 *
 * Fonte: dados abertos da Anvisa (https://dados.anvisa.gov.br/dados/), arquivos
 * `DADOS_ABERTOS_MEDICAMENTOS.csv` (registros de medicamentos) e
 * `TA_RESTRICAO_MEDICAMENTO.csv` (concentração/forma/restrição de prescrição).
 * Checado em: 2026-07-25 (arquivos com Last-Modified de 24/07/2026).
 *
 * ── PROCEDÊNCIA, CAMPO A CAMPO (honestidade de dados) ────────────────────────
 *   • A SELEÇÃO dos princípios ativos é CURADORIA MANUAL, por relevância no uso
 *     ambulatorial/crônico brasileiro. Não é ranking oficial de consumo — a
 *     Anvisa publica registros, não volume de venda ao paciente.
 *   • `verified: true` significa uma coisa só e bem estreita: o princípio ativo
 *     foi ENCONTRADO com pelo menos um registro em situação "Ativo" no
 *     `DADOS_ABERTOS_MEDICAMENTOS.csv`. Foi conferido por script, item a item.
 *   • `brand` é o nome comercial de referência mais conhecido, escolhido por
 *     CURADORIA entre as marcas que aparecem no arquivo da Anvisa. Não quer
 *     dizer "melhor", nem que seja a marca que a pessoa usa: quase todos têm
 *     genérico e vários similares.
 *   • `strengths` e `forms` são as apresentações HABITUAIS no varejo brasileiro,
 *     por CURADORIA (o CSV traz milhares de apresentações por princípio ativo;
 *     resumir cabe a nós). Não é a lista completa de apresentações registradas.
 *   • `tarja` é CURADORIA a partir da RDC 344/1998 (substâncias sob controle
 *     especial), da RDC 20/2011 (antimicrobianos com retenção) e da prática
 *     brasileira. A tarja é da APRESENTAÇÃO, não do princípio ativo: a mesma
 *     substância pode ser isenta de prescrição numa dose e tarja vermelha em
 *     outra (ibuprofeno, dipirona, omeprazol…). Use como indicação, não como
 *     regra jurídica.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ Esta base NÃO prescreve, NÃO indica dose, NÃO substitui bula nem receita e
 * NÃO é a lista completa de medicamentos registrados no Brasil (o arquivo da
 * Anvisa tem milhares de registros ativos; aqui há uma fração escolhida a dedo).
 * Serve para o paciente encontrar rápido o nome do que já toma. Bula oficial:
 * Bulário Eletrônico da Anvisa (ver `utils/anvisa.ts`).
 *
 * REVISÃO PERIÓDICA: reconferir contra os arquivos da Anvisa e atualizar
 * `MEDICAMENTOS_BR_CHECKED_AT` a cada revisão relevante do app.
 */

export const MEDICAMENTOS_BR_SOURCE_URL = 'https://dados.anvisa.gov.br/dados/';

/** Data da última conferência contra os arquivos da Anvisa (AAAA-MM-DD). */
export const MEDICAMENTOS_BR_CHECKED_AT = '2026-07-25';

/**
 * Tarja / regime de venda.
 * - `sem-tarja`: isento de prescrição (MIP, "venda livre");
 * - `vermelha`: venda sob prescrição médica;
 * - `vermelha-retencao`: prescrição com retenção da receita (antimicrobianos da
 *   RDC 20/2011 e substâncias da lista C1);
 * - `preta`: sob controle especial com notificação de receita (listas A e B da
 *   RDC 344/1998 — receita amarela "A" ou azul "B").
 */
export type MedicamentoTarja = 'sem-tarja' | 'vermelha' | 'vermelha-retencao' | 'preta';

export const MEDICAMENTO_TARJA_LABELS: Record<MedicamentoTarja, string> = {
  'sem-tarja': 'Venda livre (sem tarja)',
  vermelha: 'Tarja vermelha — sob prescrição médica',
  'vermelha-retencao': 'Tarja vermelha — receita retida na farmácia',
  preta: 'Tarja preta — receita de controle especial',
};

export type MedicamentoCategory =
  | 'cardiovascular'
  | 'anticoagulante'
  | 'colesterol'
  | 'diabetes'
  | 'tireoide'
  | 'gastro'
  | 'dor'
  | 'opioide'
  | 'enxaqueca'
  | 'corticoide'
  | 'respiratorio'
  | 'alergia'
  | 'antibiotico'
  | 'antifungico'
  | 'antiviral'
  | 'antiparasitario'
  | 'saude-mental'
  | 'neurologia'
  | 'urologia'
  | 'osso-reuma'
  | 'oftalmologia'
  | 'hormonal'
  | 'suplemento';

export const MEDICAMENTO_CATEGORY_LABELS: Record<MedicamentoCategory, string> = {
  cardiovascular: 'Coração e pressão',
  anticoagulante: 'Anticoagulantes e antiagregantes',
  colesterol: 'Colesterol e triglicerídeos',
  diabetes: 'Diabetes',
  tireoide: 'Tireoide',
  gastro: 'Estômago e intestino',
  dor: 'Dor e inflamação',
  opioide: 'Dor forte (opioides)',
  enxaqueca: 'Enxaqueca e tontura',
  corticoide: 'Corticoides',
  respiratorio: 'Respiratório',
  alergia: 'Alergia',
  antibiotico: 'Antibióticos',
  antifungico: 'Antifúngicos',
  antiviral: 'Antivirais',
  antiparasitario: 'Antiparasitários',
  'saude-mental': 'Saúde mental',
  neurologia: 'Neurologia',
  urologia: 'Urologia e próstata',
  'osso-reuma': 'Ossos e reumatologia',
  oftalmologia: 'Olhos',
  hormonal: 'Hormônios e anticoncepção',
  suplemento: 'Vitaminas e suplementos',
};

export interface MedicamentoBr {
  /** Slug estável — nunca reaproveitar um id para outro princípio ativo. */
  id: string;
  /** Princípio ativo em PT-BR, como aparece na receita. */
  activeIngredient: string;
  /** Nome comercial de referência mais conhecido (curadoria). */
  brand?: string;
  /** Concentrações habituais no varejo brasileiro (curadoria). */
  strengths: string;
  /** Formas farmacêuticas habituais (curadoria). */
  forms: string;
  /** Regime de venda habitual — ver observação sobre apresentação no cabeçalho. */
  tarja: MedicamentoTarja;
  category: MedicamentoCategory;
  /** Sinônimos e grafias alternativas para a busca. */
  terms?: string[];
  /** `true` = princípio ativo com registro ATIVO na base da Anvisa (ver cabeçalho). */
  verified: boolean;
}

/** 357 itens. Todos com princípio ativo de registro ativo confirmado na Anvisa. */
export const MEDICAMENTOS_BR: readonly MedicamentoBr[] = [
  // ══ Pressão alta e coração ═════════════════════════════════════════════════
  { id: 'losartana', activeIngredient: 'Losartana potássica', brand: 'Cozaar', strengths: '25, 50 e 100 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['losartan', 'losartana'], verified: true },
  { id: 'valsartana', activeIngredient: 'Valsartana', brand: 'Diovan', strengths: '80, 160 e 320 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'olmesartana', activeIngredient: 'Olmesartana medoxomila', brand: 'Benicar', strengths: '20 e 40 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['olmesartana'], verified: true },
  { id: 'candesartana', activeIngredient: 'Candesartana cilexetila', brand: 'Atacand', strengths: '8, 16 e 32 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['candesartana'], verified: true },
  { id: 'telmisartana', activeIngredient: 'Telmisartana', brand: 'Micardis', strengths: '40 e 80 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'irbesartana', activeIngredient: 'Irbesartana', brand: 'Aprovel', strengths: '150 e 300 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'enalapril', activeIngredient: 'Maleato de enalapril', brand: 'Renitec', strengths: '5, 10 e 20 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['enalapril'], verified: true },
  { id: 'captopril', activeIngredient: 'Captopril', brand: 'Capoten', strengths: '12,5, 25 e 50 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'lisinopril', activeIngredient: 'Lisinopril', brand: 'Zestril', strengths: '5, 10 e 20 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'ramipril', activeIngredient: 'Ramipril', brand: 'Naprix', strengths: '2,5, 5 e 10 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'perindopril', activeIngredient: 'Perindopril arginina', brand: 'Coversyl', strengths: '5 e 10 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['perindopril'], verified: true },
  { id: 'anlodipino', activeIngredient: 'Besilato de anlodipino', brand: 'Norvasc', strengths: '2,5, 5 e 10 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['anlodipino', 'amlodipino'], verified: true },
  { id: 'nifedipino', activeIngredient: 'Nifedipino', brand: 'Adalat', strengths: '10, 20, 30 e 60 mg', forms: 'comprimido de liberação prolongada', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'felodipino', activeIngredient: 'Felodipino', brand: 'Splendil', strengths: '5 e 10 mg', forms: 'comprimido de liberação prolongada', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'lercanidipino', activeIngredient: 'Cloridrato de lercanidipino', brand: 'Zanidip', strengths: '10 e 20 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['lercanidipino'], verified: true },
  { id: 'manidipino', activeIngredient: 'Cloridrato de manidipino', brand: 'Manivasc', strengths: '10 e 20 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['manidipino'], verified: true },
  { id: 'verapamil', activeIngredient: 'Cloridrato de verapamil', brand: 'Dilacoron', strengths: '80, 120 e 240 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'cardiovascular', terms: ['verapamil'], verified: true },
  { id: 'diltiazem', activeIngredient: 'Cloridrato de diltiazem', brand: 'Cardizem', strengths: '30, 60, 90, 120 e 180 mg', forms: 'comprimido, cápsula de liberação prolongada', tarja: 'vermelha', category: 'cardiovascular', terms: ['diltiazem'], verified: true },
  { id: 'atenolol', activeIngredient: 'Atenolol', brand: 'Atenol', strengths: '25, 50 e 100 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'propranolol', activeIngredient: 'Cloridrato de propranolol', brand: 'Inderal', strengths: '10, 40 e 80 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['propranolol'], verified: true },
  { id: 'metoprolol', activeIngredient: 'Succinato de metoprolol', brand: 'Selozok', strengths: '25, 50 e 100 mg', forms: 'comprimido de liberação controlada', tarja: 'vermelha', category: 'cardiovascular', terms: ['metoprolol'], verified: true },
  { id: 'carvedilol', activeIngredient: 'Carvedilol', brand: 'Coreg', strengths: '3,125, 6,25, 12,5 e 25 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'bisoprolol', activeIngredient: 'Fumarato de bisoprolol', brand: 'Concor', strengths: '1,25, 2,5, 5 e 10 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['bisoprolol'], verified: true },
  { id: 'nebivolol', activeIngredient: 'Cloridrato de nebivolol', brand: 'Nebilet', strengths: '5 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['nebivolol'], verified: true },
  { id: 'hidroclorotiazida', activeIngredient: 'Hidroclorotiazida', brand: 'Clorana', strengths: '12,5, 25 e 50 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['hctz'], verified: true },
  { id: 'clortalidona', activeIngredient: 'Clortalidona', brand: 'Higroton', strengths: '12,5, 25 e 50 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'indapamida', activeIngredient: 'Indapamida', brand: 'Natrilix', strengths: '1,5 e 2,5 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'furosemida', activeIngredient: 'Furosemida', brand: 'Lasix', strengths: '40 mg', forms: 'comprimido, solução injetável', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'espironolactona', activeIngredient: 'Espironolactona', brand: 'Aldactone', strengths: '25, 50 e 100 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'clonidina', activeIngredient: 'Cloridrato de clonidina', brand: 'Atensina', strengths: '0,100, 0,150 e 0,200 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['clonidina'], verified: true },
  { id: 'metildopa', activeIngredient: 'Metildopa', brand: 'Aldomet', strengths: '250 e 500 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'hidralazina', activeIngredient: 'Cloridrato de hidralazina', brand: 'Apresolina', strengths: '25 e 50 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['hidralazina'], verified: true },
  { id: 'mononitrato-isossorbida', activeIngredient: 'Mononitrato de isossorbida', brand: 'Monocordil', strengths: '20, 40 e 60 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'cardiovascular', terms: ['isossorbida', 'monocordil'], verified: true },
  { id: 'dinitrato-isossorbida', activeIngredient: 'Dinitrato de isossorbida', brand: 'Isordil', strengths: '5 mg (sublingual) e 10 mg', forms: 'comprimido sublingual, comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['isordil'], verified: true },
  { id: 'sacubitril-valsartana', activeIngredient: 'Sacubitril + valsartana', brand: 'Entresto', strengths: '24/26, 49/51 e 97/103 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'cardiovascular', terms: ['sacubitril', 'entresto'], verified: true },
  { id: 'ivabradina', activeIngredient: 'Cloridrato de ivabradina', brand: 'Procoralan', strengths: '5 e 7,5 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['ivabradina'], verified: true },
  { id: 'digoxina', activeIngredient: 'Digoxina', brand: 'Digoxina', strengths: '0,25 mg', forms: 'comprimido, elixir', tarja: 'vermelha', category: 'cardiovascular', verified: true },
  { id: 'amiodarona', activeIngredient: 'Cloridrato de amiodarona', brand: 'Ancoron', strengths: '100 e 200 mg', forms: 'comprimido, solução injetável', tarja: 'vermelha', category: 'cardiovascular', terms: ['amiodarona'], verified: true },
  { id: 'sotalol', activeIngredient: 'Cloridrato de sotalol', brand: 'Sotacor', strengths: '120 e 160 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['sotalol'], verified: true },
  { id: 'propafenona', activeIngredient: 'Cloridrato de propafenona', brand: 'Ritmonorm', strengths: '150 e 300 mg', forms: 'comprimido', tarja: 'vermelha', category: 'cardiovascular', terms: ['propafenona'], verified: true },
  { id: 'trimetazidina', activeIngredient: 'Cloridrato de trimetazidina', brand: 'Vastarel', strengths: '35 e 80 mg', forms: 'comprimido de liberação modificada', tarja: 'vermelha', category: 'cardiovascular', terms: ['trimetazidina'], verified: true },

  // ══ Anticoagulantes e antiagregantes ══════════════════════════════════════
  { id: 'aas', activeIngredient: 'Ácido acetilsalicílico', brand: 'AAS', strengths: '81, 100, 300 e 500 mg', forms: 'comprimido, comprimido revestido', tarja: 'sem-tarja', category: 'anticoagulante', terms: ['aas', 'aspirina', 'acido acetilsalicilico'], verified: true },
  { id: 'clopidogrel', activeIngredient: 'Bissulfato de clopidogrel', brand: 'Plavix', strengths: '75 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'anticoagulante', terms: ['clopidogrel'], verified: true },
  { id: 'ticagrelor', activeIngredient: 'Ticagrelor', brand: 'Brilinta', strengths: '60 e 90 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'anticoagulante', verified: true },
  { id: 'prasugrel', activeIngredient: 'Cloridrato de prasugrel', brand: 'Effient', strengths: '5 e 10 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'anticoagulante', terms: ['prasugrel'], verified: true },
  { id: 'varfarina', activeIngredient: 'Varfarina sódica', brand: 'Marevan', strengths: '1, 2,5 e 5 mg', forms: 'comprimido', tarja: 'vermelha', category: 'anticoagulante', terms: ['varfarina', 'warfarina', 'marevan'], verified: true },
  { id: 'rivaroxabana', activeIngredient: 'Rivaroxabana', brand: 'Xarelto', strengths: '2,5, 10, 15 e 20 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'anticoagulante', verified: true },
  { id: 'apixabana', activeIngredient: 'Apixabana', brand: 'Eliquis', strengths: '2,5 e 5 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'anticoagulante', verified: true },
  { id: 'dabigatrana', activeIngredient: 'Etexilato de dabigatrana', brand: 'Pradaxa', strengths: '75, 110 e 150 mg', forms: 'cápsula', tarja: 'vermelha', category: 'anticoagulante', terms: ['dabigatrana'], verified: true },
  { id: 'edoxabana', activeIngredient: 'Edoxabana', brand: 'Lixiana', strengths: '15, 30 e 60 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'anticoagulante', verified: true },
  { id: 'enoxaparina', activeIngredient: 'Enoxaparina sódica', brand: 'Clexane', strengths: '20, 40, 60, 80 e 100 mg', forms: 'seringa preenchida (subcutânea)', tarja: 'vermelha', category: 'anticoagulante', terms: ['enoxaparina', 'clexane'], verified: true },
  { id: 'cilostazol', activeIngredient: 'Cilostazol', brand: 'Vasogard', strengths: '50 e 100 mg', forms: 'comprimido', tarja: 'vermelha', category: 'anticoagulante', verified: true },
  { id: 'pentoxifilina', activeIngredient: 'Pentoxifilina', brand: 'Trental', strengths: '400 mg', forms: 'comprimido de liberação prolongada', tarja: 'vermelha', category: 'anticoagulante', verified: true },

  // ══ Colesterol e triglicerídeos ═══════════════════════════════════════════
  { id: 'sinvastatina', activeIngredient: 'Sinvastatina', brand: 'Zocor', strengths: '10, 20, 40 e 80 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'colesterol', verified: true },
  { id: 'atorvastatina', activeIngredient: 'Atorvastatina cálcica', brand: 'Lipitor', strengths: '10, 20, 40 e 80 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'colesterol', terms: ['atorvastatina'], verified: true },
  { id: 'rosuvastatina', activeIngredient: 'Rosuvastatina cálcica', brand: 'Crestor', strengths: '5, 10, 20 e 40 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'colesterol', terms: ['rosuvastatina'], verified: true },
  { id: 'pravastatina', activeIngredient: 'Pravastatina sódica', brand: 'Pravacol', strengths: '10, 20 e 40 mg', forms: 'comprimido', tarja: 'vermelha', category: 'colesterol', terms: ['pravastatina'], verified: true },
  { id: 'pitavastatina', activeIngredient: 'Pitavastatina cálcica', brand: 'Livalo', strengths: '1, 2 e 4 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'colesterol', terms: ['pitavastatina'], verified: true },
  { id: 'ezetimiba', activeIngredient: 'Ezetimiba', brand: 'Zetia', strengths: '10 mg (isolada ou com sinvastatina/rosuvastatina)', forms: 'comprimido', tarja: 'vermelha', category: 'colesterol', verified: true },
  { id: 'fenofibrato', activeIngredient: 'Fenofibrato', brand: 'Lipidil', strengths: '160 e 200 mg', forms: 'comprimido, cápsula', tarja: 'vermelha', category: 'colesterol', verified: true },
  { id: 'ciprofibrato', activeIngredient: 'Ciprofibrato', brand: 'Lipless', strengths: '100 mg', forms: 'comprimido', tarja: 'vermelha', category: 'colesterol', verified: true },
  { id: 'bezafibrato', activeIngredient: 'Bezafibrato', brand: 'Cedur', strengths: '200 e 400 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'colesterol', verified: true },
  { id: 'genfibrozila', activeIngredient: 'Genfibrozila', brand: 'Lopid', strengths: '600 e 900 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'colesterol', terms: ['genfibrozila', 'gemfibrozila'], verified: true },

  // ══ Diabetes ══════════════════════════════════════════════════════════════
  { id: 'metformina', activeIngredient: 'Cloridrato de metformina', brand: 'Glifage', strengths: '500, 850 e 1000 mg (comum e XR)', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'diabetes', terms: ['metformina', 'glifage'], verified: true },
  { id: 'glibenclamida', activeIngredient: 'Glibenclamida', brand: 'Daonil', strengths: '5 mg', forms: 'comprimido', tarja: 'vermelha', category: 'diabetes', verified: true },
  { id: 'gliclazida', activeIngredient: 'Gliclazida', brand: 'Diamicron', strengths: '30, 60 e 80 mg', forms: 'comprimido de liberação modificada', tarja: 'vermelha', category: 'diabetes', verified: true },
  { id: 'glimepirida', activeIngredient: 'Glimepirida', brand: 'Amaryl', strengths: '1, 2, 4 e 6 mg', forms: 'comprimido', tarja: 'vermelha', category: 'diabetes', verified: true },
  { id: 'sitagliptina', activeIngredient: 'Fosfato de sitagliptina', brand: 'Januvia', strengths: '25, 50 e 100 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'diabetes', terms: ['sitagliptina', 'januvia'], verified: true },
  { id: 'vildagliptina', activeIngredient: 'Vildagliptina', brand: 'Galvus', strengths: '50 mg', forms: 'comprimido', tarja: 'vermelha', category: 'diabetes', verified: true },
  { id: 'linagliptina', activeIngredient: 'Linagliptina', brand: 'Trayenta', strengths: '5 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'diabetes', verified: true },
  { id: 'saxagliptina', activeIngredient: 'Cloridrato de saxagliptina', brand: 'Onglyza', strengths: '2,5 e 5 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'diabetes', terms: ['saxagliptina'], verified: true },
  { id: 'alogliptina', activeIngredient: 'Benzoato de alogliptina', brand: 'Nesina', strengths: '6,25, 12,5 e 25 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'diabetes', terms: ['alogliptina'], verified: true },
  { id: 'dapagliflozina', activeIngredient: 'Dapagliflozina', brand: 'Forxiga', strengths: '5 e 10 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'diabetes', terms: ['dapagliflozina', 'forxiga'], verified: true },
  { id: 'empagliflozina', activeIngredient: 'Empagliflozina', brand: 'Jardiance', strengths: '10 e 25 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'diabetes', terms: ['empagliflozina', 'jardiance'], verified: true },
  { id: 'canagliflozina', activeIngredient: 'Canagliflozina', brand: 'Invokana', strengths: '100 e 300 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'diabetes', verified: true },
  { id: 'pioglitazona', activeIngredient: 'Cloridrato de pioglitazona', brand: 'Actos', strengths: '15, 30 e 45 mg', forms: 'comprimido', tarja: 'vermelha', category: 'diabetes', terms: ['pioglitazona'], verified: true },
  { id: 'acarbose', activeIngredient: 'Acarbose', brand: 'Glucobay', strengths: '50 e 100 mg', forms: 'comprimido', tarja: 'vermelha', category: 'diabetes', verified: true },
  { id: 'liraglutida', activeIngredient: 'Liraglutida', brand: 'Victoza', strengths: '6 mg/mL (caneta 0,6 a 1,8 mg; 3,0 mg em obesidade)', forms: 'caneta preenchida (subcutânea)', tarja: 'vermelha', category: 'diabetes', terms: ['liraglutida', 'victoza', 'saxenda'], verified: true },
  { id: 'semaglutida', activeIngredient: 'Semaglutida', brand: 'Ozempic', strengths: '0,25 a 2 mg (injetável); 7 e 14 mg (oral)', forms: 'caneta preenchida (subcutânea), comprimido', tarja: 'vermelha', category: 'diabetes', terms: ['semaglutida', 'ozempic', 'wegovy', 'rybelsus'], verified: true },
  { id: 'dulaglutida', activeIngredient: 'Dulaglutida', brand: 'Trulicity', strengths: '0,75 e 1,5 mg', forms: 'caneta preenchida (subcutânea)', tarja: 'vermelha', category: 'diabetes', verified: true },
  { id: 'tirzepatida', activeIngredient: 'Tirzepatida', brand: 'Mounjaro', strengths: '2,5 a 15 mg', forms: 'caneta preenchida (subcutânea)', tarja: 'vermelha', category: 'diabetes', terms: ['tirzepatida', 'mounjaro'], verified: true },
  { id: 'insulina-humana-nph', activeIngredient: 'Insulina humana NPH', brand: 'Humulin N', strengths: '100 UI/mL', forms: 'frasco, refil, caneta descartável', tarja: 'vermelha', category: 'diabetes', terms: ['insulina nph', 'insulina humana nph'], verified: true },
  { id: 'insulina-humana-regular', activeIngredient: 'Insulina humana regular', brand: 'Humulin R', strengths: '100 UI/mL', forms: 'frasco, refil, caneta descartável', tarja: 'vermelha', category: 'diabetes', terms: ['insulina regular', 'insulina humana'], verified: true },
  { id: 'insulina-glargina', activeIngredient: 'Insulina glargina', brand: 'Lantus', strengths: '100 e 300 UI/mL', forms: 'caneta preenchida, refil', tarja: 'vermelha', category: 'diabetes', terms: ['glargina', 'lantus', 'toujeo'], verified: true },
  { id: 'insulina-degludeca', activeIngredient: 'Insulina degludeca', brand: 'Tresiba', strengths: '100 e 200 UI/mL', forms: 'caneta preenchida', tarja: 'vermelha', category: 'diabetes', terms: ['degludeca'], verified: true },
  { id: 'insulina-detemir', activeIngredient: 'Insulina detemir', brand: 'Levemir', strengths: '100 UI/mL', forms: 'caneta preenchida', tarja: 'vermelha', category: 'diabetes', terms: ['detemir'], verified: true },
  { id: 'insulina-lispro', activeIngredient: 'Insulina lispro', brand: 'Humalog', strengths: '100 UI/mL', forms: 'caneta preenchida, refil, frasco', tarja: 'vermelha', category: 'diabetes', terms: ['lispro', 'humalog'], verified: true },
  { id: 'insulina-asparte', activeIngredient: 'Insulina asparte', brand: 'NovoRapid', strengths: '100 UI/mL', forms: 'caneta preenchida, refil, frasco', tarja: 'vermelha', category: 'diabetes', terms: ['asparte', 'novorapid', 'fiasp'], verified: true },
  { id: 'insulina-glulisina', activeIngredient: 'Insulina glulisina', brand: 'Apidra', strengths: '100 UI/mL', forms: 'caneta preenchida, refil', tarja: 'vermelha', category: 'diabetes', terms: ['glulisina'], verified: true },

  // ══ Tireoide ══════════════════════════════════════════════════════════════
  { id: 'levotiroxina', activeIngredient: 'Levotiroxina sódica', brand: 'Puran T4', strengths: '25, 50, 75, 88, 100, 112, 125, 150 e 200 mcg', forms: 'comprimido', tarja: 'vermelha', category: 'tireoide', terms: ['levotiroxina', 'puran', 'synthroid', 'euthyrox'], verified: true },
  { id: 'tiamazol', activeIngredient: 'Tiamazol (metimazol)', brand: 'Tapazol', strengths: '5 e 10 mg', forms: 'comprimido', tarja: 'vermelha', category: 'tireoide', terms: ['tiamazol', 'metimazol', 'tapazol'], verified: true },
  { id: 'propiltiouracila', activeIngredient: 'Propiltiouracila', brand: 'Propilracil', strengths: '100 mg', forms: 'comprimido', tarja: 'vermelha', category: 'tireoide', verified: true },

  // ══ Estômago e intestino ══════════════════════════════════════════════════
  { id: 'omeprazol', activeIngredient: 'Omeprazol', brand: 'Losec', strengths: '10, 20 e 40 mg', forms: 'cápsula de liberação retardada', tarja: 'sem-tarja', category: 'gastro', verified: true },
  { id: 'pantoprazol', activeIngredient: 'Pantoprazol sódico', brand: 'Pantozol', strengths: '20 e 40 mg', forms: 'comprimido de liberação retardada', tarja: 'sem-tarja', category: 'gastro', terms: ['pantoprazol'], verified: true },
  { id: 'esomeprazol', activeIngredient: 'Esomeprazol magnésico', brand: 'Nexium', strengths: '20 e 40 mg', forms: 'comprimido, cápsula', tarja: 'sem-tarja', category: 'gastro', terms: ['esomeprazol', 'nexium'], verified: true },
  { id: 'lansoprazol', activeIngredient: 'Lansoprazol', brand: 'Prazol', strengths: '15 e 30 mg', forms: 'cápsula', tarja: 'sem-tarja', category: 'gastro', verified: true },
  { id: 'rabeprazol', activeIngredient: 'Rabeprazol sódico', brand: 'Pariet', strengths: '10 e 20 mg', forms: 'comprimido revestido', tarja: 'sem-tarja', category: 'gastro', terms: ['rabeprazol'], verified: true },
  { id: 'ranitidina', activeIngredient: 'Cloridrato de ranitidina', brand: 'Antak', strengths: '150 e 300 mg', forms: 'comprimido, solução oral', tarja: 'sem-tarja', category: 'gastro', terms: ['ranitidina'], verified: true },
  { id: 'famotidina', activeIngredient: 'Famotidina', brand: 'Famox', strengths: '20 e 40 mg', forms: 'comprimido revestido', tarja: 'sem-tarja', category: 'gastro', verified: true },
  { id: 'domperidona', activeIngredient: 'Domperidona', brand: 'Motilium', strengths: '10 mg; 1 mg/mL (suspensão)', forms: 'comprimido, suspensão oral', tarja: 'vermelha', category: 'gastro', verified: true },
  { id: 'bromoprida', activeIngredient: 'Bromoprida', brand: 'Digesan', strengths: '4 mg/mL (gotas), 10 mg', forms: 'cápsula, solução oral, injetável', tarja: 'vermelha', category: 'gastro', verified: true },
  { id: 'metoclopramida', activeIngredient: 'Cloridrato de metoclopramida', brand: 'Plasil', strengths: '4 mg/mL (gotas), 10 mg', forms: 'comprimido, solução oral, injetável', tarja: 'vermelha', category: 'gastro', terms: ['metoclopramida', 'plasil'], verified: true },
  { id: 'ondansetrona', activeIngredient: 'Cloridrato de ondansetrona', brand: 'Zofran', strengths: '4 e 8 mg', forms: 'comprimido, comprimido orodispersível, injetável', tarja: 'vermelha', category: 'gastro', terms: ['ondansetrona'], verified: true },
  { id: 'dimenidrinato', activeIngredient: 'Dimenidrinato (com piridoxina)', brand: 'Dramin B6', strengths: '25, 50 e 100 mg', forms: 'comprimido, cápsula, solução, injetável', tarja: 'sem-tarja', category: 'gastro', terms: ['dimenidrinato', 'dramin'], verified: true },
  { id: 'escopolamina', activeIngredient: 'Butilbrometo de escopolamina', brand: 'Buscopan', strengths: '10 mg; 6,67 mg/mL (gotas)', forms: 'comprimido revestido, solução oral, injetável', tarja: 'sem-tarja', category: 'gastro', terms: ['escopolamina', 'buscopan', 'hioscina'], verified: true },
  { id: 'simeticona', activeIngredient: 'Simeticona', brand: 'Luftal', strengths: '40 e 125 mg; 75 mg/mL (gotas)', forms: 'comprimido, cápsula, gotas', tarja: 'sem-tarja', category: 'gastro', terms: ['simeticona', 'luftal'], verified: true },
  { id: 'dimeticona', activeIngredient: 'Dimeticona', brand: 'Simeco Plus', strengths: '40 e 125 mg', forms: 'comprimido, suspensão', tarja: 'sem-tarja', category: 'gastro', verified: true },
  { id: 'mesalazina', activeIngredient: 'Mesalazina', brand: 'Mesacol', strengths: '400, 500, 800 e 1200 mg', forms: 'comprimido de liberação modificada, supositório, enema', tarja: 'vermelha', category: 'gastro', verified: true },
  { id: 'sulfassalazina', activeIngredient: 'Sulfassalazina', brand: 'Azulfin', strengths: '500 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'gastro', verified: true },
  { id: 'lactulose', activeIngredient: 'Lactulose', brand: 'Duphalac', strengths: '667 mg/mL', forms: 'xarope', tarja: 'sem-tarja', category: 'gastro', verified: true },
  { id: 'bisacodil', activeIngredient: 'Bisacodil', brand: 'Dulcolax', strengths: '5 mg', forms: 'drágea, supositório', tarja: 'sem-tarja', category: 'gastro', verified: true },
  { id: 'macrogol', activeIngredient: 'Macrogol (polietilenoglicol 3350)', brand: 'Muvinlax', strengths: 'sachê de 13,8 g', forms: 'pó para solução oral', tarja: 'sem-tarja', category: 'gastro', terms: ['macrogol', 'polietilenoglicol', 'peg 3350'], verified: true },
  { id: 'picossulfato', activeIngredient: 'Picossulfato de sódio', brand: 'Guttalax', strengths: '7,5 mg/mL', forms: 'gotas', tarja: 'sem-tarja', category: 'gastro', terms: ['picossulfato', 'guttalax'], verified: true },
  { id: 'loperamida', activeIngredient: 'Cloridrato de loperamida', brand: 'Imosec', strengths: '2 mg', forms: 'comprimido, cápsula', tarja: 'sem-tarja', category: 'gastro', terms: ['loperamida'], verified: true },
  { id: 'racecadotrila', activeIngredient: 'Racecadotrila', brand: 'Tiorfan', strengths: '10, 30 e 100 mg', forms: 'cápsula, sachê', tarja: 'vermelha', category: 'gastro', verified: true },
  { id: 'ursodesoxicolico', activeIngredient: 'Ácido ursodesoxicólico', brand: 'Ursacol', strengths: '50, 150 e 300 mg', forms: 'comprimido', tarja: 'vermelha', category: 'gastro', terms: ['ursodesoxicolico', 'ursacol'], verified: true },
  { id: 'trimebutina', activeIngredient: 'Maleato de trimebutina', brand: 'Debridat', strengths: '100 e 200 mg; 4,8 mg/mL', forms: 'comprimido, suspensão oral', tarja: 'vermelha', category: 'gastro', terms: ['trimebutina'], verified: true },

  // ══ Dor e inflamação ══════════════════════════════════════════════════════
  { id: 'dipirona', activeIngredient: 'Dipirona sódica', brand: 'Novalgina', strengths: '500 e 1000 mg; 500 mg/mL (gotas)', forms: 'comprimido, solução oral, injetável, supositório', tarja: 'sem-tarja', category: 'dor', terms: ['dipirona', 'novalgina', 'metamizol'], verified: true },
  { id: 'paracetamol', activeIngredient: 'Paracetamol', brand: 'Tylenol', strengths: '500, 750 e 850 mg; 200 mg/mL (gotas)', forms: 'comprimido, solução oral', tarja: 'sem-tarja', category: 'dor', terms: ['paracetamol', 'tylenol', 'acetaminofeno'], verified: true },
  { id: 'ibuprofeno', activeIngredient: 'Ibuprofeno', brand: 'Advil', strengths: '200, 400 e 600 mg; 50 e 100 mg/mL (gotas)', forms: 'comprimido, cápsula, suspensão oral', tarja: 'sem-tarja', category: 'dor', terms: ['ibuprofeno', 'advil', 'alivium'], verified: true },
  { id: 'naproxeno', activeIngredient: 'Naproxeno sódico', brand: 'Flanax', strengths: '220, 275, 500 e 550 mg', forms: 'comprimido revestido', tarja: 'sem-tarja', category: 'dor', terms: ['naproxeno', 'flanax'], verified: true },
  { id: 'diclofenaco', activeIngredient: 'Diclofenaco (sódico ou potássico)', brand: 'Cataflam / Voltaren', strengths: '50 e 75 mg; gel 10 mg/g', forms: 'comprimido, injetável, gel, supositório', tarja: 'vermelha', category: 'dor', terms: ['diclofenaco', 'cataflam', 'voltaren'], verified: true },
  { id: 'cetoprofeno', activeIngredient: 'Cetoprofeno', brand: 'Profenid', strengths: '50, 100, 150 e 200 mg', forms: 'comprimido, cápsula, injetável, gel', tarja: 'vermelha', category: 'dor', terms: ['cetoprofeno', 'profenid'], verified: true },
  { id: 'nimesulida', activeIngredient: 'Nimesulida', brand: 'Nisulid', strengths: '100 mg; 50 mg/mL (gotas)', forms: 'comprimido, granulado, solução oral', tarja: 'vermelha', category: 'dor', terms: ['nimesulida', 'nisulid'], verified: true },
  { id: 'meloxicam', activeIngredient: 'Meloxicam', brand: 'Movatec', strengths: '7,5 e 15 mg', forms: 'comprimido, injetável', tarja: 'vermelha', category: 'dor', verified: true },
  { id: 'celecoxibe', activeIngredient: 'Celecoxibe', brand: 'Celebra', strengths: '100 e 200 mg', forms: 'cápsula', tarja: 'vermelha', category: 'dor', terms: ['celecoxibe', 'celebra'], verified: true },
  { id: 'etoricoxibe', activeIngredient: 'Etoricoxibe', brand: 'Arcoxia', strengths: '30, 60, 90 e 120 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'dor', terms: ['etoricoxibe', 'arcoxia'], verified: true },
  { id: 'piroxicam', activeIngredient: 'Piroxicam', brand: 'Feldene', strengths: '10 e 20 mg', forms: 'comprimido, cápsula, injetável', tarja: 'vermelha', category: 'dor', verified: true },
  { id: 'indometacina', activeIngredient: 'Indometacina', brand: 'Indocid', strengths: '25 e 50 mg', forms: 'cápsula', tarja: 'vermelha', category: 'dor', verified: true },
  { id: 'cetorolaco', activeIngredient: 'Trometamol cetorolaco', brand: 'Toragesic', strengths: '10 e 20 mg (sublingual); 30 mg/mL (injetável)', forms: 'comprimido sublingual, injetável', tarja: 'vermelha', category: 'dor', terms: ['cetorolaco', 'toragesic'], verified: true },
  { id: 'ciclobenzaprina', activeIngredient: 'Cloridrato de ciclobenzaprina', brand: 'Miosan', strengths: '5 e 10 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'dor', terms: ['ciclobenzaprina', 'miosan'], verified: true },
  { id: 'orfenadrina', activeIngredient: 'Citrato de orfenadrina (com dipirona e cafeína)', brand: 'Dorflex', strengths: '35 mg + 300 mg + 50 mg', forms: 'comprimido', tarja: 'sem-tarja', category: 'dor', terms: ['orfenadrina', 'dorflex'], verified: true },
  { id: 'carisoprodol', activeIngredient: 'Carisoprodol (com diclofenaco, paracetamol e cafeína)', brand: 'Tandrilax', strengths: '125 mg + 50 mg + 300 mg + 30 mg', forms: 'comprimido', tarja: 'vermelha', category: 'dor', terms: ['carisoprodol', 'tandrilax', 'mioflex'], verified: true },
  { id: 'tizanidina', activeIngredient: 'Cloridrato de tizanidina', brand: 'Sirdalud', strengths: '2 e 4 mg', forms: 'comprimido', tarja: 'vermelha', category: 'dor', terms: ['tizanidina'], verified: true },
  { id: 'baclofeno', activeIngredient: 'Baclofeno', brand: 'Lioresal', strengths: '10 mg', forms: 'comprimido', tarja: 'vermelha', category: 'dor', verified: true },
  { id: 'tiocolchicosideo', activeIngredient: 'Tiocolchicosídeo', brand: 'Coltrax', strengths: '4 e 8 mg', forms: 'comprimido, injetável', tarja: 'vermelha', category: 'dor', terms: ['tiocolchicosideo', 'coltrax'], verified: true },

  // ══ Dor forte (opioides) ══════════════════════════════════════════════════
  { id: 'codeina', activeIngredient: 'Fosfato de codeína (isolada ou com paracetamol)', brand: 'Tylex', strengths: '7,5, 30 e 60 mg (com 500 mg de paracetamol)', forms: 'comprimido, solução oral', tarja: 'preta', category: 'opioide', terms: ['codeina', 'tylex'], verified: true },
  { id: 'tramadol', activeIngredient: 'Cloridrato de tramadol', brand: 'Tramal', strengths: '50, 100 mg; 100 mg/mL (gotas)', forms: 'cápsula, comprimido de liberação prolongada, gotas, injetável', tarja: 'preta', category: 'opioide', terms: ['tramadol', 'tramal'], verified: true },
  { id: 'morfina', activeIngredient: 'Sulfato de morfina', brand: 'Dimorf', strengths: '10, 30, 60 e 100 mg; 10 mg/mL (solução)', forms: 'comprimido, comprimido de liberação prolongada, solução oral, injetável', tarja: 'preta', category: 'opioide', terms: ['morfina', 'dimorf'], verified: true },
  { id: 'oxicodona', activeIngredient: 'Cloridrato de oxicodona', brand: 'Oxycontin', strengths: '10, 20 e 40 mg', forms: 'comprimido de liberação controlada', tarja: 'preta', category: 'opioide', terms: ['oxicodona'], verified: true },
  { id: 'metadona', activeIngredient: 'Cloridrato de metadona', brand: 'Mytedom', strengths: '5 e 10 mg', forms: 'comprimido, injetável', tarja: 'preta', category: 'opioide', terms: ['metadona'], verified: true },
  { id: 'fentanila', activeIngredient: 'Citrato de fentanila', brand: 'Durogesic', strengths: 'adesivo de 12, 25, 50, 75 e 100 mcg/h', forms: 'adesivo transdérmico, injetável', tarja: 'preta', category: 'opioide', terms: ['fentanila', 'fentanil', 'durogesic'], verified: true },
  { id: 'tapentadol', activeIngredient: 'Cloridrato de tapentadol', brand: 'Palexis', strengths: '50, 100, 150, 200 e 250 mg', forms: 'comprimido de liberação prolongada', tarja: 'preta', category: 'opioide', terms: ['tapentadol'], verified: true },
  { id: 'nalbufina', activeIngredient: 'Cloridrato de nalbufina', brand: 'Nubain', strengths: '10 mg/mL', forms: 'solução injetável', tarja: 'vermelha', category: 'opioide', terms: ['nalbufina'], verified: true },
  { id: 'naltrexona', activeIngredient: 'Cloridrato de naltrexona', brand: 'Revia', strengths: '50 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'opioide', terms: ['naltrexona'], verified: true },

  // ══ Enxaqueca e tontura ═══════════════════════════════════════════════════
  { id: 'sumatriptana', activeIngredient: 'Succinato de sumatriptana', brand: 'Sumax', strengths: '50 e 100 mg', forms: 'comprimido revestido, injetável, spray nasal', tarja: 'vermelha', category: 'enxaqueca', terms: ['sumatriptana', 'sumax'], verified: true },
  { id: 'naratriptana', activeIngredient: 'Cloridrato de naratriptana', brand: 'Naramig', strengths: '2,5 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'enxaqueca', terms: ['naratriptana'], verified: true },
  { id: 'rizatriptana', activeIngredient: 'Benzoato de rizatriptana', brand: 'Maxalt', strengths: '5 e 10 mg', forms: 'comprimido, comprimido orodispersível', tarja: 'vermelha', category: 'enxaqueca', terms: ['rizatriptana', 'maxalt'], verified: true },
  { id: 'zolmitriptana', activeIngredient: 'Zolmitriptana', brand: 'Zomig', strengths: '2,5 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'enxaqueca', verified: true },
  { id: 'flunarizina', activeIngredient: 'Cloridrato de flunarizina', brand: 'Vertix', strengths: '5 e 10 mg', forms: 'comprimido', tarja: 'vermelha', category: 'enxaqueca', terms: ['flunarizina'], verified: true },
  { id: 'betaistina', activeIngredient: 'Dicloridrato de betaistina', brand: 'Labirin', strengths: '8, 16 e 24 mg', forms: 'comprimido', tarja: 'vermelha', category: 'enxaqueca', terms: ['betaistina', 'betahistina'], verified: true },
  { id: 'cinarizina', activeIngredient: 'Cinarizina', brand: 'Stugeron', strengths: '25 e 75 mg', forms: 'comprimido', tarja: 'vermelha', category: 'enxaqueca', verified: true },

  // ══ Corticoides ═══════════════════════════════════════════════════════════
  { id: 'prednisona', activeIngredient: 'Prednisona', brand: 'Meticorten', strengths: '5, 20 e 40 mg', forms: 'comprimido', tarja: 'vermelha', category: 'corticoide', terms: ['prednisona', 'meticorten'], verified: true },
  { id: 'prednisolona', activeIngredient: 'Fosfato sódico de prednisolona', brand: 'Predsim', strengths: '1 e 3 mg/mL (solução); 5, 20 e 40 mg', forms: 'solução oral, comprimido', tarja: 'vermelha', category: 'corticoide', terms: ['prednisolona', 'predsim'], verified: true },
  { id: 'dexametasona', activeIngredient: 'Dexametasona', brand: 'Decadron', strengths: '0,5, 0,75 e 4 mg; creme 1 mg/g', forms: 'comprimido, elixir, injetável, creme', tarja: 'vermelha', category: 'corticoide', terms: ['dexametasona', 'decadron'], verified: true },
  { id: 'betametasona', activeIngredient: 'Betametasona (valerato ou dipropionato)', brand: 'Diprosone / Celestone', strengths: 'creme 0,5 e 1 mg/g; injetável', forms: 'creme, pomada, injetável, elixir', tarja: 'vermelha', category: 'corticoide', terms: ['betametasona', 'diprosone', 'celestone'], verified: true },
  { id: 'hidrocortisona', activeIngredient: 'Hidrocortisona (acetato ou succinato)', brand: 'Solu-Cortef', strengths: '10 e 20 mg; 100 e 500 mg (injetável); creme 10 mg/g', forms: 'comprimido, injetável, creme', tarja: 'vermelha', category: 'corticoide', terms: ['hidrocortisona'], verified: true },
  { id: 'metilprednisolona', activeIngredient: 'Metilprednisolona', brand: 'Depo-Medrol', strengths: '4, 16, 40, 125 e 500 mg', forms: 'comprimido, injetável', tarja: 'vermelha', category: 'corticoide', terms: ['metilprednisolona'], verified: true },
  { id: 'deflazacorte', activeIngredient: 'Deflazacorte', brand: 'Calcort', strengths: '6, 7,5 e 30 mg', forms: 'comprimido, suspensão oral', tarja: 'vermelha', category: 'corticoide', verified: true },

  // ══ Respiratório ══════════════════════════════════════════════════════════
  { id: 'salbutamol', activeIngredient: 'Sulfato de salbutamol', brand: 'Aerolin', strengths: '100 mcg/dose (aerossol); 5 mg/mL (solução para inalação)', forms: 'aerossol, solução inalatória, xarope', tarja: 'vermelha', category: 'respiratorio', terms: ['salbutamol', 'aerolin', 'albuterol'], verified: true },
  { id: 'fenoterol', activeIngredient: 'Bromidrato de fenoterol', brand: 'Berotec', strengths: '5 mg/mL (gotas para inalação)', forms: 'solução inalatória, aerossol', tarja: 'vermelha', category: 'respiratorio', terms: ['fenoterol', 'berotec'], verified: true },
  { id: 'formoterol', activeIngredient: 'Fumarato de formoterol', brand: 'Foradil', strengths: '6 e 12 mcg (isolado ou com budesonida)', forms: 'cápsula para inalação, aerossol', tarja: 'vermelha', category: 'respiratorio', terms: ['formoterol'], verified: true },
  { id: 'salmeterol', activeIngredient: 'Xinafoato de salmeterol', brand: 'Seretide', strengths: '25 e 50 mcg (com fluticasona)', forms: 'aerossol, pó para inalação', tarja: 'vermelha', category: 'respiratorio', terms: ['salmeterol', 'seretide'], verified: true },
  { id: 'indacaterol', activeIngredient: 'Maleato de indacaterol', brand: 'Onbrize', strengths: '150 e 300 mcg', forms: 'cápsula para inalação', tarja: 'vermelha', category: 'respiratorio', terms: ['indacaterol'], verified: true },
  { id: 'vilanterol', activeIngredient: 'Trifenatato de vilanterol', brand: 'Relvar Ellipta', strengths: '22 mcg (com fluticasona ou umeclidínio)', forms: 'pó para inalação', tarja: 'vermelha', category: 'respiratorio', terms: ['vilanterol', 'ellipta'], verified: true },
  { id: 'beclometasona', activeIngredient: 'Dipropionato de beclometasona', brand: 'Clenil', strengths: '50, 200 e 250 mcg; spray nasal 50 mcg/dose', forms: 'aerossol, spray nasal, suspensão para inalação', tarja: 'vermelha', category: 'respiratorio', terms: ['beclometasona', 'clenil', 'beclosol'], verified: true },
  { id: 'budesonida', activeIngredient: 'Budesonida', brand: 'Busonid', strengths: '32, 50, 64 mcg (nasal); 200 e 400 mcg (inalação)', forms: 'spray nasal, pó para inalação, suspensão', tarja: 'vermelha', category: 'respiratorio', terms: ['budesonida', 'busonid'], verified: true },
  { id: 'fluticasona', activeIngredient: 'Fluticasona (propionato ou furoato)', brand: 'Flixonase', strengths: '50 mcg/dose (nasal); 50, 125 e 250 mcg (inalação)', forms: 'spray nasal, aerossol, pó para inalação', tarja: 'vermelha', category: 'respiratorio', terms: ['fluticasona', 'flixonase'], verified: true },
  { id: 'mometasona', activeIngredient: 'Furoato de mometasona', brand: 'Nasonex', strengths: '50 mcg/dose (nasal); creme 1 mg/g', forms: 'spray nasal, creme, pó para inalação', tarja: 'vermelha', category: 'respiratorio', terms: ['mometasona', 'nasonex'], verified: true },
  { id: 'ipratropio', activeIngredient: 'Brometo de ipratrópio', brand: 'Atrovent', strengths: '0,25 e 0,02 mg/mL', forms: 'solução inalatória, aerossol', tarja: 'vermelha', category: 'respiratorio', terms: ['ipratropio', 'atrovent'], verified: true },
  { id: 'tiotropio', activeIngredient: 'Brometo de tiotrópio', brand: 'Spiriva', strengths: '2,5 e 18 mcg', forms: 'cápsula para inalação, Respimat', tarja: 'vermelha', category: 'respiratorio', terms: ['tiotropio', 'spiriva'], verified: true },
  { id: 'umeclidinio', activeIngredient: 'Brometo de umeclidínio', brand: 'Incruse Ellipta', strengths: '62,5 mcg', forms: 'pó para inalação', tarja: 'vermelha', category: 'respiratorio', terms: ['umeclidinio'], verified: true },
  { id: 'montelucaste', activeIngredient: 'Montelucaste de sódio', brand: 'Singulair', strengths: '4, 5 e 10 mg', forms: 'comprimido, comprimido mastigável, sachê', tarja: 'vermelha', category: 'respiratorio', terms: ['montelucaste', 'singulair'], verified: true },
  { id: 'teofilina', activeIngredient: 'Teofilina', brand: 'Teolong', strengths: '100, 200 e 300 mg', forms: 'cápsula de liberação prolongada', tarja: 'vermelha', category: 'respiratorio', verified: true },
  { id: 'acetilcisteina', activeIngredient: 'Acetilcisteína', brand: 'Fluimucil', strengths: '20 e 40 mg/mL (xarope); 600 mg (efervescente)', forms: 'xarope, granulado, comprimido efervescente', tarja: 'sem-tarja', category: 'respiratorio', terms: ['acetilcisteina', 'fluimucil'], verified: true },
  { id: 'ambroxol', activeIngredient: 'Cloridrato de ambroxol', brand: 'Mucosolvan', strengths: '15 e 30 mg/5 mL', forms: 'xarope, solução oral', tarja: 'sem-tarja', category: 'respiratorio', terms: ['ambroxol', 'mucosolvan'], verified: true },
  { id: 'carbocisteina', activeIngredient: 'Carbocisteína', brand: 'Mucofan', strengths: '20, 25 e 50 mg/mL', forms: 'xarope', tarja: 'sem-tarja', category: 'respiratorio', terms: ['carbocisteina'], verified: true },
  { id: 'bromexina', activeIngredient: 'Cloridrato de bromexina', brand: 'Bisolvon', strengths: '4 e 8 mg/5 mL', forms: 'xarope, solução oral', tarja: 'sem-tarja', category: 'respiratorio', terms: ['bromexina', 'bisolvon'], verified: true },
  { id: 'dropropizina', activeIngredient: 'Dropropizina / levodropropizina', brand: 'Notuss', strengths: '1,5 e 3 mg/mL', forms: 'xarope, solução oral', tarja: 'sem-tarja', category: 'respiratorio', terms: ['dropropizina', 'levodropropizina', 'vibral'], verified: true },
  { id: 'guaifenesina', activeIngredient: 'Guaifenesina', brand: 'Transpulmin', strengths: '20, 26,7 e 100 mg/mL', forms: 'xarope', tarja: 'sem-tarja', category: 'respiratorio', terms: ['guaifenesina'], verified: true },

  // ══ Alergia ═══════════════════════════════════════════════════════════════
  { id: 'loratadina', activeIngredient: 'Loratadina', brand: 'Claritin', strengths: '10 mg; 1 mg/mL (xarope)', forms: 'comprimido, xarope', tarja: 'sem-tarja', category: 'alergia', terms: ['loratadina', 'claritin'], verified: true },
  { id: 'desloratadina', activeIngredient: 'Desloratadina', brand: 'Desalex', strengths: '5 mg; 0,5 mg/mL (xarope)', forms: 'comprimido, xarope', tarja: 'sem-tarja', category: 'alergia', terms: ['desloratadina', 'desalex'], verified: true },
  { id: 'cetirizina', activeIngredient: 'Dicloridrato de cetirizina', brand: 'Zyrtec', strengths: '10 mg; 1 mg/mL (gotas)', forms: 'comprimido, solução oral', tarja: 'sem-tarja', category: 'alergia', terms: ['cetirizina', 'zyrtec'], verified: true },
  { id: 'levocetirizina', activeIngredient: 'Dicloridrato de levocetirizina', brand: 'Zyxem', strengths: '5 mg; 0,5 mg/mL', forms: 'comprimido, solução oral', tarja: 'sem-tarja', category: 'alergia', terms: ['levocetirizina'], verified: true },
  { id: 'fexofenadina', activeIngredient: 'Cloridrato de fexofenadina', brand: 'Allegra', strengths: '30, 60, 120 e 180 mg', forms: 'comprimido revestido, suspensão oral', tarja: 'sem-tarja', category: 'alergia', terms: ['fexofenadina', 'allegra'], verified: true },
  { id: 'ebastina', activeIngredient: 'Ebastina', brand: 'Ebastel', strengths: '10 e 20 mg', forms: 'comprimido', tarja: 'sem-tarja', category: 'alergia', verified: true },
  { id: 'bilastina', activeIngredient: 'Bilastina', brand: 'Alektos', strengths: '20 mg', forms: 'comprimido', tarja: 'sem-tarja', category: 'alergia', verified: true },
  { id: 'rupatadina', activeIngredient: 'Fumarato de rupatadina', brand: 'Rupafin', strengths: '10 mg', forms: 'comprimido', tarja: 'sem-tarja', category: 'alergia', terms: ['rupatadina'], verified: true },
  { id: 'hidroxizina', activeIngredient: 'Cloridrato de hidroxizina', brand: 'Hixizine', strengths: '25 mg; 2 mg/mL (xarope)', forms: 'comprimido, xarope', tarja: 'vermelha', category: 'alergia', terms: ['hidroxizina'], verified: true },
  { id: 'dexclorfeniramina', activeIngredient: 'Maleato de dexclorfeniramina', brand: 'Polaramine', strengths: '2 mg; 0,4 mg/mL (xarope)', forms: 'comprimido, xarope, creme', tarja: 'sem-tarja', category: 'alergia', terms: ['dexclorfeniramina', 'polaramine'], verified: true },
  { id: 'prometazina', activeIngredient: 'Cloridrato de prometazina', brand: 'Fenergan', strengths: '25 mg; 25 mg/mL (injetável)', forms: 'comprimido, injetável, creme', tarja: 'vermelha', category: 'alergia', terms: ['prometazina', 'fenergan'], verified: true },

  // ══ Antibióticos ══════════════════════════════════════════════════════════
  { id: 'amoxicilina', activeIngredient: 'Amoxicilina', brand: 'Amoxil', strengths: '500 e 875 mg; 250 e 400 mg/5 mL', forms: 'cápsula, comprimido, suspensão oral', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['amoxicilina', 'amoxil'], verified: true },
  { id: 'amoxicilina-clavulanato', activeIngredient: 'Amoxicilina + clavulanato de potássio', brand: 'Clavulin', strengths: '500/125 e 875/125 mg', forms: 'comprimido revestido, suspensão oral', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['clavulanato', 'clavulin', 'amoxicilina com clavulanato'], verified: true },
  { id: 'ampicilina', activeIngredient: 'Ampicilina', brand: 'Binotal', strengths: '500 mg; 250 mg/5 mL', forms: 'cápsula, suspensão oral, injetável', tarja: 'vermelha-retencao', category: 'antibiotico', verified: true },
  { id: 'benzilpenicilina-benzatina', activeIngredient: 'Benzilpenicilina benzatina', brand: 'Benzetacil', strengths: '600.000 e 1.200.000 UI', forms: 'suspensão injetável (intramuscular)', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['penicilina benzatina', 'benzetacil'], verified: true },
  { id: 'cefalexina', activeIngredient: 'Cefalexina', brand: 'Keflex', strengths: '500 mg; 250 mg/5 mL', forms: 'cápsula, comprimido, suspensão oral', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['cefalexina', 'keflex'], verified: true },
  { id: 'cefuroxima', activeIngredient: 'Cefuroxima axetila', brand: 'Zinnat', strengths: '250 e 500 mg', forms: 'comprimido revestido, suspensão oral', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['cefuroxima'], verified: true },
  { id: 'cefadroxila', activeIngredient: 'Cefadroxila', brand: 'Cedrox', strengths: '500 mg e 1 g; 250 e 500 mg/5 mL', forms: 'cápsula, comprimido, suspensão oral', tarja: 'vermelha-retencao', category: 'antibiotico', verified: true },
  { id: 'ceftriaxona', activeIngredient: 'Ceftriaxona sódica', brand: 'Rocefin', strengths: '250 mg, 500 mg e 1 g', forms: 'pó para solução injetável', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['ceftriaxona', 'rocefin'], verified: true },
  { id: 'azitromicina', activeIngredient: 'Azitromicina', brand: 'Zitromax', strengths: '500 mg; 200 mg/5 mL', forms: 'comprimido revestido, suspensão oral', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['azitromicina', 'zitromax'], verified: true },
  { id: 'claritromicina', activeIngredient: 'Claritromicina', brand: 'Klaricid', strengths: '250 e 500 mg', forms: 'comprimido revestido, suspensão oral', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['claritromicina', 'klaricid'], verified: true },
  { id: 'eritromicina', activeIngredient: 'Estearato de eritromicina', brand: 'Ilosone', strengths: '250 e 500 mg', forms: 'comprimido, suspensão oral', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['eritromicina'], verified: true },
  { id: 'ciprofloxacino', activeIngredient: 'Cloridrato de ciprofloxacino', brand: 'Cipro', strengths: '250, 500 e 750 mg', forms: 'comprimido revestido, injetável, colírio', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['ciprofloxacino', 'cipro'], verified: true },
  { id: 'levofloxacino', activeIngredient: 'Levofloxacino hemi-hidratado', brand: 'Levaquin', strengths: '250, 500 e 750 mg', forms: 'comprimido revestido, injetável', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['levofloxacino'], verified: true },
  { id: 'moxifloxacino', activeIngredient: 'Cloridrato de moxifloxacino', brand: 'Avalox', strengths: '400 mg', forms: 'comprimido revestido, injetável', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['moxifloxacino'], verified: true },
  { id: 'norfloxacino', activeIngredient: 'Norfloxacino', brand: 'Floxacin', strengths: '400 mg', forms: 'comprimido revestido', tarja: 'vermelha-retencao', category: 'antibiotico', verified: true },
  { id: 'sulfametoxazol-trimetoprima', activeIngredient: 'Sulfametoxazol + trimetoprima', brand: 'Bactrim', strengths: '400/80 e 800/160 mg', forms: 'comprimido, suspensão oral', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['bactrim', 'sulfametoxazol', 'trimetoprima'], verified: true },
  { id: 'doxiciclina', activeIngredient: 'Cloridrato de doxiciclina', brand: 'Vibramicina', strengths: '100 mg', forms: 'comprimido revestido, cápsula', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['doxiciclina'], verified: true },
  { id: 'tetraciclina', activeIngredient: 'Cloridrato de tetraciclina', brand: 'Tetraciclina', strengths: '500 mg', forms: 'cápsula, pomada', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['tetraciclina'], verified: true },
  { id: 'clindamicina', activeIngredient: 'Cloridrato de clindamicina', brand: 'Dalacin C', strengths: '150 e 300 mg', forms: 'cápsula, injetável, gel', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['clindamicina', 'dalacin'], verified: true },
  { id: 'metronidazol', activeIngredient: 'Metronidazol', brand: 'Flagyl', strengths: '250 e 400 mg; creme vaginal 100 mg/g', forms: 'comprimido, suspensão, creme vaginal, gel', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['metronidazol', 'flagyl'], verified: true },
  { id: 'nitrofurantoina', activeIngredient: 'Nitrofurantoína', brand: 'Macrodantina', strengths: '100 mg', forms: 'cápsula', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['nitrofurantoina', 'macrodantina'], verified: true },
  { id: 'fosfomicina', activeIngredient: 'Fosfomicina trometamol', brand: 'Monuril', strengths: '3 g (sachê)', forms: 'granulado para solução oral', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['fosfomicina', 'monuril'], verified: true },
  { id: 'gentamicina', activeIngredient: 'Sulfato de gentamicina', brand: 'Garamicina', strengths: '20, 40 e 80 mg (injetável); creme 1 mg/g', forms: 'injetável, creme, colírio', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['gentamicina'], verified: true },
  { id: 'rifampicina', activeIngredient: 'Rifampicina', brand: 'Rifaldin', strengths: '300 mg; 20 mg/mL (suspensão)', forms: 'cápsula, suspensão oral', tarja: 'vermelha-retencao', category: 'antibiotico', verified: true },
  { id: 'isoniazida', activeIngredient: 'Isoniazida', brand: 'Isoniazida', strengths: '100 e 300 mg', forms: 'comprimido', tarja: 'vermelha-retencao', category: 'antibiotico', terms: ['isoniazida', 'tuberculose'], verified: true },

  // ══ Antifúngicos ══════════════════════════════════════════════════════════
  { id: 'fluconazol', activeIngredient: 'Fluconazol', brand: 'Zoltec', strengths: '100 e 150 mg', forms: 'cápsula, injetável', tarja: 'vermelha', category: 'antifungico', terms: ['fluconazol', 'zoltec'], verified: true },
  { id: 'itraconazol', activeIngredient: 'Itraconazol', brand: 'Sporanox', strengths: '100 mg', forms: 'cápsula', tarja: 'vermelha', category: 'antifungico', terms: ['itraconazol', 'sporanox'], verified: true },
  { id: 'cetoconazol', activeIngredient: 'Cetoconazol', brand: 'Nizoral', strengths: '200 mg; xampu 20 mg/g; creme 20 mg/g', forms: 'comprimido, xampu, creme', tarja: 'vermelha', category: 'antifungico', terms: ['cetoconazol', 'nizoral'], verified: true },
  { id: 'terbinafina', activeIngredient: 'Cloridrato de terbinafina', brand: 'Lamisil', strengths: '250 mg; creme 10 mg/g', forms: 'comprimido, creme, spray', tarja: 'vermelha', category: 'antifungico', terms: ['terbinafina', 'lamisil'], verified: true },
  { id: 'nistatina', activeIngredient: 'Nistatina', brand: 'Micostatin', strengths: '100.000 UI/mL; creme vaginal 25.000 UI/g', forms: 'suspensão oral, creme vaginal, pomada', tarja: 'vermelha', category: 'antifungico', terms: ['nistatina', 'micostatin'], verified: true },
  { id: 'miconazol', activeIngredient: 'Nitrato de miconazol', brand: 'Vodol', strengths: 'creme 20 mg/g; creme vaginal 20 mg/g', forms: 'creme, creme vaginal, pó', tarja: 'sem-tarja', category: 'antifungico', terms: ['miconazol', 'vodol'], verified: true },
  { id: 'clotrimazol', activeIngredient: 'Clotrimazol', brand: 'Canesten', strengths: 'creme 10 mg/g; creme vaginal 20 mg/g', forms: 'creme, creme vaginal, óvulo', tarja: 'sem-tarja', category: 'antifungico', terms: ['clotrimazol', 'canesten'], verified: true },

  // ══ Antivirais ════════════════════════════════════════════════════════════
  { id: 'aciclovir', activeIngredient: 'Aciclovir', brand: 'Zovirax', strengths: '200, 400 e 800 mg; creme 50 mg/g', forms: 'comprimido, creme, injetável', tarja: 'vermelha', category: 'antiviral', terms: ['aciclovir', 'zovirax'], verified: true },
  { id: 'valaciclovir', activeIngredient: 'Cloridrato de valaciclovir', brand: 'Valtrex', strengths: '500 mg e 1 g', forms: 'comprimido revestido', tarja: 'vermelha', category: 'antiviral', terms: ['valaciclovir', 'valtrex'], verified: true },
  { id: 'oseltamivir', activeIngredient: 'Fosfato de oseltamivir', brand: 'Tamiflu', strengths: '30, 45 e 75 mg', forms: 'cápsula, suspensão oral', tarja: 'vermelha', category: 'antiviral', terms: ['oseltamivir', 'tamiflu', 'gripe'], verified: true },

  // ══ Antiparasitários ══════════════════════════════════════════════════════
  { id: 'albendazol', activeIngredient: 'Albendazol', brand: 'Zentel', strengths: '400 mg; 40 mg/mL (suspensão)', forms: 'comprimido mastigável, suspensão oral', tarja: 'vermelha', category: 'antiparasitario', terms: ['albendazol', 'zentel'], verified: true },
  { id: 'mebendazol', activeIngredient: 'Mebendazol', brand: 'Pantelmin', strengths: '100 e 500 mg; 20 mg/mL', forms: 'comprimido, suspensão oral', tarja: 'vermelha', category: 'antiparasitario', terms: ['mebendazol', 'pantelmin'], verified: true },
  { id: 'ivermectina', activeIngredient: 'Ivermectina', brand: 'Revectina', strengths: '6 mg', forms: 'comprimido', tarja: 'vermelha', category: 'antiparasitario', terms: ['ivermectina', 'revectina'], verified: true },
  { id: 'praziquantel', activeIngredient: 'Praziquantel', brand: 'Cisticid', strengths: '150 e 600 mg', forms: 'comprimido', tarja: 'vermelha', category: 'antiparasitario', verified: true },
  { id: 'nitazoxanida', activeIngredient: 'Nitazoxanida', brand: 'Annita', strengths: '500 mg; 20 mg/mL', forms: 'comprimido revestido, suspensão oral', tarja: 'vermelha', category: 'antiparasitario', terms: ['nitazoxanida', 'annita'], verified: true },
  { id: 'secnidazol', activeIngredient: 'Secnidazol', brand: 'Secnidal', strengths: '1000 mg', forms: 'comprimido', tarja: 'vermelha', category: 'antiparasitario', verified: true },
  { id: 'tinidazol', activeIngredient: 'Tinidazol', brand: 'Pletil', strengths: '500 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'antiparasitario', verified: true },
  { id: 'hidroxicloroquina', activeIngredient: 'Sulfato de hidroxicloroquina', brand: 'Reuquinol', strengths: '400 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'osso-reuma', terms: ['hidroxicloroquina', 'reuquinol'], verified: true },

  // ══ Saúde mental ══════════════════════════════════════════════════════════
  { id: 'fluoxetina', activeIngredient: 'Cloridrato de fluoxetina', brand: 'Prozac', strengths: '10 e 20 mg', forms: 'cápsula, comprimido, solução oral', tarja: 'vermelha', category: 'saude-mental', terms: ['fluoxetina', 'prozac'], verified: true },
  { id: 'sertralina', activeIngredient: 'Cloridrato de sertralina', brand: 'Zoloft', strengths: '25, 50 e 100 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'saude-mental', terms: ['sertralina', 'zoloft'], verified: true },
  { id: 'escitalopram', activeIngredient: 'Oxalato de escitalopram', brand: 'Lexapro', strengths: '10, 15 e 20 mg', forms: 'comprimido revestido, gotas', tarja: 'vermelha', category: 'saude-mental', terms: ['escitalopram', 'lexapro'], verified: true },
  { id: 'citalopram', activeIngredient: 'Bromidrato de citalopram', brand: 'Cipramil', strengths: '20 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'saude-mental', terms: ['citalopram'], verified: true },
  { id: 'paroxetina', activeIngredient: 'Cloridrato de paroxetina', brand: 'Aropax', strengths: '10, 20 e 25 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'saude-mental', terms: ['paroxetina', 'pondera'], verified: true },
  { id: 'fluvoxamina', activeIngredient: 'Maleato de fluvoxamina', brand: 'Luvox', strengths: '50 e 100 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'saude-mental', terms: ['fluvoxamina', 'luvox'], verified: true },
  { id: 'venlafaxina', activeIngredient: 'Cloridrato de venlafaxina', brand: 'Efexor', strengths: '37,5, 75 e 150 mg', forms: 'cápsula de liberação prolongada', tarja: 'vermelha', category: 'saude-mental', terms: ['venlafaxina', 'efexor'], verified: true },
  { id: 'desvenlafaxina', activeIngredient: 'Succinato de desvenlafaxina', brand: 'Pristiq', strengths: '50 e 100 mg', forms: 'comprimido de liberação prolongada', tarja: 'vermelha', category: 'saude-mental', terms: ['desvenlafaxina', 'pristiq'], verified: true },
  { id: 'duloxetina', activeIngredient: 'Cloridrato de duloxetina', brand: 'Cymbalta', strengths: '30 e 60 mg', forms: 'cápsula de liberação retardada', tarja: 'vermelha', category: 'saude-mental', terms: ['duloxetina', 'cymbalta'], verified: true },
  { id: 'bupropiona', activeIngredient: 'Cloridrato de bupropiona', brand: 'Wellbutrin', strengths: '150 e 300 mg', forms: 'comprimido de liberação prolongada', tarja: 'vermelha', category: 'saude-mental', terms: ['bupropiona', 'wellbutrin', 'zyban'], verified: true },
  { id: 'mirtazapina', activeIngredient: 'Mirtazapina', brand: 'Remeron', strengths: '15, 30 e 45 mg', forms: 'comprimido revestido, orodispersível', tarja: 'vermelha', category: 'saude-mental', terms: ['mirtazapina', 'remeron'], verified: true },
  { id: 'trazodona', activeIngredient: 'Cloridrato de trazodona', brand: 'Donaren', strengths: '50, 100 e 150 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'saude-mental', terms: ['trazodona', 'donaren'], verified: true },
  { id: 'vortioxetina', activeIngredient: 'Bromidrato de vortioxetina', brand: 'Brintellix', strengths: '5, 10, 15 e 20 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'saude-mental', terms: ['vortioxetina', 'brintellix'], verified: true },
  { id: 'agomelatina', activeIngredient: 'Agomelatina', brand: 'Valdoxan', strengths: '25 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'saude-mental', terms: ['agomelatina', 'valdoxan'], verified: true },
  { id: 'amitriptilina', activeIngredient: 'Cloridrato de amitriptilina', brand: 'Amytril', strengths: '25 e 75 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'saude-mental', terms: ['amitriptilina', 'amytril'], verified: true },
  { id: 'nortriptilina', activeIngredient: 'Cloridrato de nortriptilina', brand: 'Pamelor', strengths: '10, 25, 50 e 75 mg', forms: 'cápsula, solução oral', tarja: 'vermelha', category: 'saude-mental', terms: ['nortriptilina', 'pamelor'], verified: true },
  { id: 'imipramina', activeIngredient: 'Cloridrato de imipramina', brand: 'Tofranil', strengths: '10, 25 e 75 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'saude-mental', terms: ['imipramina', 'tofranil'], verified: true },
  { id: 'clomipramina', activeIngredient: 'Cloridrato de clomipramina', brand: 'Anafranil', strengths: '10, 25 e 75 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'saude-mental', terms: ['clomipramina', 'anafranil'], verified: true },
  { id: 'litio', activeIngredient: 'Carbonato de lítio', brand: 'Carbolitium', strengths: '300 e 450 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'saude-mental', terms: ['litio', 'carbolitium'], verified: true },
  { id: 'quetiapina', activeIngredient: 'Hemifumarato de quetiapina', brand: 'Seroquel', strengths: '25, 50, 100, 200, 300 e 400 mg', forms: 'comprimido revestido, liberação prolongada', tarja: 'vermelha', category: 'saude-mental', terms: ['quetiapina', 'seroquel'], verified: true },
  { id: 'olanzapina', activeIngredient: 'Olanzapina', brand: 'Zyprexa', strengths: '2,5, 5 e 10 mg', forms: 'comprimido revestido, orodispersível', tarja: 'vermelha', category: 'saude-mental', terms: ['olanzapina', 'zyprexa'], verified: true },
  { id: 'risperidona', activeIngredient: 'Risperidona', brand: 'Risperdal', strengths: '1, 2 e 3 mg; 1 mg/mL (solução)', forms: 'comprimido revestido, solução oral, injetável de depósito', tarja: 'vermelha', category: 'saude-mental', terms: ['risperidona', 'risperdal'], verified: true },
  { id: 'aripiprazol', activeIngredient: 'Aripiprazol', brand: 'Abilify', strengths: '10, 15, 20 e 30 mg', forms: 'comprimido, injetável de depósito', tarja: 'vermelha', category: 'saude-mental', terms: ['aripiprazol', 'abilify', 'aristab'], verified: true },
  { id: 'ziprasidona', activeIngredient: 'Cloridrato de ziprasidona', brand: 'Geodon', strengths: '40 e 80 mg', forms: 'cápsula', tarja: 'vermelha', category: 'saude-mental', terms: ['ziprasidona', 'geodon'], verified: true },
  { id: 'haloperidol', activeIngredient: 'Haloperidol', brand: 'Haldol', strengths: '1 e 5 mg; 2 mg/mL (gotas); decanoato injetável', forms: 'comprimido, gotas, injetável', tarja: 'vermelha', category: 'saude-mental', terms: ['haloperidol', 'haldol'], verified: true },
  { id: 'clorpromazina', activeIngredient: 'Cloridrato de clorpromazina', brand: 'Amplictil', strengths: '25 e 100 mg; 40 mg/mL (gotas)', forms: 'comprimido, gotas, injetável', tarja: 'vermelha', category: 'saude-mental', terms: ['clorpromazina', 'amplictil'], verified: true },
  { id: 'levomepromazina', activeIngredient: 'Maleato de levomepromazina', brand: 'Neozine', strengths: '25 e 100 mg; 40 mg/mL (gotas)', forms: 'comprimido, gotas', tarja: 'vermelha', category: 'saude-mental', terms: ['levomepromazina', 'neozine'], verified: true },
  { id: 'periciazina', activeIngredient: 'Periciazina', brand: 'Neuleptil', strengths: '10 e 40 mg; 40 mg/mL (gotas)', forms: 'cápsula, solução oral', tarja: 'vermelha', category: 'saude-mental', terms: ['periciazina', 'neuleptil'], verified: true },
  { id: 'clozapina', activeIngredient: 'Clozapina', brand: 'Leponex', strengths: '25 e 100 mg', forms: 'comprimido', tarja: 'vermelha', category: 'saude-mental', terms: ['clozapina', 'leponex'], verified: true },
  { id: 'lurasidona', activeIngredient: 'Cloridrato de lurasidona', brand: 'Latuda', strengths: '20, 40 e 80 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'saude-mental', terms: ['lurasidona', 'latuda'], verified: true },
  { id: 'paliperidona', activeIngredient: 'Paliperidona', brand: 'Invega', strengths: '3, 6 e 9 mg; injetável de depósito', forms: 'comprimido de liberação prolongada, injetável', tarja: 'vermelha', category: 'saude-mental', terms: ['paliperidona', 'invega'], verified: true },
  { id: 'clonazepam', activeIngredient: 'Clonazepam', brand: 'Rivotril', strengths: '0,5, 2 mg; 2,5 mg/mL (gotas)', forms: 'comprimido, gotas', tarja: 'preta', category: 'saude-mental', terms: ['clonazepam', 'rivotril'], verified: true },
  { id: 'alprazolam', activeIngredient: 'Alprazolam', brand: 'Frontal', strengths: '0,25, 0,5, 1 e 2 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'preta', category: 'saude-mental', terms: ['alprazolam', 'frontal'], verified: true },
  { id: 'diazepam', activeIngredient: 'Diazepam', brand: 'Valium', strengths: '5 e 10 mg', forms: 'comprimido, injetável', tarja: 'preta', category: 'saude-mental', terms: ['diazepam', 'valium'], verified: true },
  { id: 'lorazepam', activeIngredient: 'Lorazepam', brand: 'Lorax', strengths: '1 e 2 mg', forms: 'comprimido', tarja: 'preta', category: 'saude-mental', terms: ['lorazepam', 'lorax'], verified: true },
  { id: 'bromazepam', activeIngredient: 'Bromazepam', brand: 'Lexotan', strengths: '3 e 6 mg', forms: 'comprimido', tarja: 'preta', category: 'saude-mental', terms: ['bromazepam', 'lexotan'], verified: true },
  { id: 'midazolam', activeIngredient: 'Midazolam', brand: 'Dormonid', strengths: '7,5 e 15 mg; injetável', forms: 'comprimido revestido, injetável', tarja: 'preta', category: 'saude-mental', terms: ['midazolam', 'dormonid'], verified: true },
  { id: 'clobazam', activeIngredient: 'Clobazam', brand: 'Frisium', strengths: '10 e 20 mg', forms: 'comprimido', tarja: 'preta', category: 'saude-mental', terms: ['clobazam', 'frisium'], verified: true },
  { id: 'zolpidem', activeIngredient: 'Hemitartarato de zolpidem', brand: 'Stilnox', strengths: '5, 6,25, 10 e 12,5 mg', forms: 'comprimido revestido, sublingual, liberação controlada', tarja: 'preta', category: 'saude-mental', terms: ['zolpidem', 'stilnox'], verified: true },
  { id: 'zopiclona', activeIngredient: 'Zopiclona', brand: 'Imovane', strengths: '7,5 mg', forms: 'comprimido revestido', tarja: 'preta', category: 'saude-mental', terms: ['zopiclona', 'imovane'], verified: true },
  { id: 'buspirona', activeIngredient: 'Cloridrato de buspirona', brand: 'Ansitec', strengths: '5 e 10 mg', forms: 'comprimido', tarja: 'vermelha', category: 'saude-mental', terms: ['buspirona', 'ansitec'], verified: true },
  { id: 'metilfenidato', activeIngredient: 'Cloridrato de metilfenidato', brand: 'Ritalina', strengths: '10 mg; LA 20, 30 e 40 mg; Concerta 18, 36 e 54 mg', forms: 'comprimido, cápsula de liberação prolongada', tarja: 'preta', category: 'saude-mental', terms: ['metilfenidato', 'ritalina', 'concerta', 'tdah'], verified: true },
  { id: 'lisdexanfetamina', activeIngredient: 'Dimesilato de lisdexanfetamina', brand: 'Venvanse', strengths: '30, 50 e 70 mg', forms: 'cápsula', tarja: 'preta', category: 'saude-mental', terms: ['lisdexanfetamina', 'venvanse', 'tdah'], verified: true },
  { id: 'atomoxetina', activeIngredient: 'Cloridrato de atomoxetina', brand: 'Strattera', strengths: '10, 18, 25, 40, 60 e 80 mg', forms: 'cápsula', tarja: 'vermelha', category: 'saude-mental', terms: ['atomoxetina', 'strattera'], verified: true },
  { id: 'vareniclina', activeIngredient: 'Tartarato de vareniclina', brand: 'Champix', strengths: '0,5 e 1 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'saude-mental', terms: ['vareniclina', 'champix', 'parar de fumar'], verified: true },

  // ══ Neurologia ════════════════════════════════════════════════════════════
  { id: 'lamotrigina', activeIngredient: 'Lamotrigina', brand: 'Lamictal', strengths: '25, 50, 100 e 200 mg', forms: 'comprimido, comprimido dispersível', tarja: 'vermelha', category: 'neurologia', terms: ['lamotrigina', 'lamictal'], verified: true },
  { id: 'divalproato', activeIngredient: 'Divalproato de sódio', brand: 'Depakote', strengths: '125, 250, 500 mg (ER 250 e 500 mg)', forms: 'comprimido revestido, liberação prolongada', tarja: 'vermelha', category: 'neurologia', terms: ['divalproato', 'depakote'], verified: true },
  { id: 'valproato', activeIngredient: 'Valproato de sódio / ácido valproico', brand: 'Depakene', strengths: '250 e 500 mg; 50 mg/mL (xarope)', forms: 'cápsula, xarope, solução oral', tarja: 'vermelha', category: 'neurologia', terms: ['valproato', 'acido valproico', 'depakene'], verified: true },
  { id: 'carbamazepina', activeIngredient: 'Carbamazepina', brand: 'Tegretol', strengths: '200 e 400 mg; 20 mg/mL (suspensão)', forms: 'comprimido, comprimido CR, suspensão oral', tarja: 'vermelha', category: 'neurologia', terms: ['carbamazepina', 'tegretol'], verified: true },
  { id: 'oxcarbazepina', activeIngredient: 'Oxcarbazepina', brand: 'Trileptal', strengths: '300 e 600 mg; 60 mg/mL (suspensão)', forms: 'comprimido revestido, suspensão oral', tarja: 'vermelha', category: 'neurologia', terms: ['oxcarbazepina', 'trileptal'], verified: true },
  { id: 'levetiracetam', activeIngredient: 'Levetiracetam', brand: 'Keppra', strengths: '250, 500, 750 e 1000 mg; 100 mg/mL', forms: 'comprimido revestido, solução oral, injetável', tarja: 'vermelha', category: 'neurologia', terms: ['levetiracetam', 'keppra'], verified: true },
  { id: 'topiramato', activeIngredient: 'Topiramato', brand: 'Topamax', strengths: '25, 50 e 100 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'neurologia', terms: ['topiramato', 'topamax'], verified: true },
  { id: 'fenitoina', activeIngredient: 'Fenitoína sódica', brand: 'Hidantal', strengths: '100 mg', forms: 'comprimido, injetável', tarja: 'vermelha', category: 'neurologia', terms: ['fenitoina', 'hidantal'], verified: true },
  { id: 'fenobarbital', activeIngredient: 'Fenobarbital', brand: 'Gardenal', strengths: '50 e 100 mg; 40 mg/mL (gotas)', forms: 'comprimido, solução oral, injetável', tarja: 'preta', category: 'neurologia', terms: ['fenobarbital', 'gardenal'], verified: true },
  { id: 'gabapentina', activeIngredient: 'Gabapentina', brand: 'Neurontin', strengths: '300, 400 e 600 mg', forms: 'cápsula, comprimido revestido', tarja: 'vermelha', category: 'neurologia', terms: ['gabapentina', 'neurontin'], verified: true },
  { id: 'pregabalina', activeIngredient: 'Pregabalina', brand: 'Lyrica', strengths: '25, 50, 75, 100 e 150 mg', forms: 'cápsula', tarja: 'vermelha', category: 'neurologia', terms: ['pregabalina', 'lyrica'], verified: true },
  { id: 'vigabatrina', activeIngredient: 'Vigabatrina', brand: 'Sabril', strengths: '500 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'neurologia', terms: ['vigabatrina', 'sabril'], verified: true },
  { id: 'levodopa-carbidopa', activeIngredient: 'Levodopa + carbidopa', brand: 'Sinemet', strengths: '250/25 e 200/50 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'neurologia', terms: ['levodopa', 'carbidopa', 'sinemet', 'parkinson'], verified: true },
  { id: 'levodopa-benserazida', activeIngredient: 'Levodopa + cloridrato de benserazida', brand: 'Prolopa', strengths: '100/25 e 200/50 mg', forms: 'comprimido, cápsula, comprimido dispersível', tarja: 'vermelha', category: 'neurologia', terms: ['benserazida', 'prolopa', 'parkinson'], verified: true },
  { id: 'pramipexol', activeIngredient: 'Dicloridrato de pramipexol', brand: 'Sifrol', strengths: '0,125, 0,25 e 1 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'neurologia', terms: ['pramipexol', 'sifrol'], verified: true },
  { id: 'rasagilina', activeIngredient: 'Mesilato de rasagilina', brand: 'Azilect', strengths: '1 mg', forms: 'comprimido', tarja: 'vermelha', category: 'neurologia', terms: ['rasagilina', 'azilect'], verified: true },
  { id: 'entacapona', activeIngredient: 'Entacapona', brand: 'Comtan', strengths: '200 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'neurologia', terms: ['entacapona', 'comtan'], verified: true },
  { id: 'biperideno', activeIngredient: 'Cloridrato de biperideno', brand: 'Akineton', strengths: '2 e 4 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'neurologia', terms: ['biperideno', 'akineton'], verified: true },
  { id: 'amantadina', activeIngredient: 'Cloridrato de amantadina', brand: 'Mantidan', strengths: '100 mg', forms: 'comprimido', tarja: 'vermelha', category: 'neurologia', terms: ['amantadina', 'mantidan'], verified: true },
  { id: 'donepezila', activeIngredient: 'Cloridrato de donepezila', brand: 'Eranz', strengths: '5 e 10 mg', forms: 'comprimido revestido, orodispersível', tarja: 'vermelha', category: 'neurologia', terms: ['donepezila', 'eranz', 'alzheimer'], verified: true },
  { id: 'rivastigmina', activeIngredient: 'Hidrogenotartarato de rivastigmina', brand: 'Exelon', strengths: '1,5, 3, 4,5 e 6 mg; adesivo de 4,6, 9,5 e 13,3 mg/24 h', forms: 'cápsula, adesivo transdérmico, solução oral', tarja: 'vermelha', category: 'neurologia', terms: ['rivastigmina', 'exelon', 'alzheimer'], verified: true },
  { id: 'galantamina', activeIngredient: 'Bromidrato de galantamina', brand: 'Reminyl', strengths: '8, 16 e 24 mg', forms: 'cápsula de liberação prolongada', tarja: 'vermelha', category: 'neurologia', terms: ['galantamina', 'reminyl'], verified: true },
  { id: 'memantina', activeIngredient: 'Cloridrato de memantina', brand: 'Ebix', strengths: '10 e 20 mg', forms: 'comprimido revestido, solução oral', tarja: 'vermelha', category: 'neurologia', terms: ['memantina', 'ebix', 'alzheimer'], verified: true },

  // ══ Urologia e próstata ═══════════════════════════════════════════════════
  { id: 'tansulosina', activeIngredient: 'Cloridrato de tansulosina', brand: 'Secotex', strengths: '0,4 mg', forms: 'cápsula de liberação prolongada', tarja: 'vermelha', category: 'urologia', terms: ['tansulosina', 'secotex'], verified: true },
  { id: 'doxazosina', activeIngredient: 'Mesilato de doxazosina', brand: 'Carduran', strengths: '2, 4 e 8 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'urologia', terms: ['doxazosina', 'carduran'], verified: true },
  { id: 'finasterida', activeIngredient: 'Finasterida', brand: 'Proscar / Propecia', strengths: '1 e 5 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'urologia', terms: ['finasterida', 'propecia'], verified: true },
  { id: 'dutasterida', activeIngredient: 'Dutasterida', brand: 'Avodart', strengths: '0,5 mg (isolada ou com tansulosina)', forms: 'cápsula', tarja: 'vermelha', category: 'urologia', terms: ['dutasterida', 'avodart'], verified: true },
  { id: 'sildenafila', activeIngredient: 'Citrato de sildenafila', brand: 'Viagra', strengths: '25, 50 e 100 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'urologia', terms: ['sildenafila', 'viagra'], verified: true },
  { id: 'tadalafila', activeIngredient: 'Tadalafila', brand: 'Cialis', strengths: '2,5, 5, 10 e 20 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'urologia', terms: ['tadalafila', 'cialis'], verified: true },
  { id: 'oxibutinina', activeIngredient: 'Cloridrato de oxibutinina', brand: 'Retemic', strengths: '5 e 10 mg', forms: 'comprimido, comprimido de liberação prolongada', tarja: 'vermelha', category: 'urologia', terms: ['oxibutinina', 'retemic'], verified: true },
  { id: 'solifenacina', activeIngredient: 'Succinato de solifenacina', brand: 'Vesicare', strengths: '5 e 10 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'urologia', terms: ['solifenacina', 'vesicare'], verified: true },
  { id: 'tolterodina', activeIngredient: 'Tartarato de tolterodina', brand: 'Detrusitol', strengths: '2 e 4 mg', forms: 'cápsula de liberação prolongada', tarja: 'vermelha', category: 'urologia', terms: ['tolterodina', 'detrusitol'], verified: true },
  { id: 'mirabegrona', activeIngredient: 'Mirabegrona', brand: 'Myrbetriq', strengths: '25 e 50 mg', forms: 'comprimido de liberação prolongada', tarja: 'vermelha', category: 'urologia', terms: ['mirabegrona', 'myrbetriq'], verified: true },

  // ══ Ossos e reumatologia ══════════════════════════════════════════════════
  { id: 'alopurinol', activeIngredient: 'Alopurinol', brand: 'Zyloric', strengths: '100 e 300 mg', forms: 'comprimido', tarja: 'vermelha', category: 'osso-reuma', terms: ['alopurinol', 'zyloric', 'gota'], verified: true },
  { id: 'colchicina', activeIngredient: 'Colchicina', brand: 'Colchis', strengths: '0,5 e 1 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'osso-reuma', terms: ['colchicina', 'gota'], verified: true },
  { id: 'alendronato', activeIngredient: 'Alendronato de sódio', brand: 'Fosamax', strengths: '10 e 70 mg', forms: 'comprimido', tarja: 'vermelha', category: 'osso-reuma', terms: ['alendronato', 'fosamax', 'osteoporose'], verified: true },
  { id: 'risedronato', activeIngredient: 'Risedronato sódico', brand: 'Actonel', strengths: '5, 35 e 150 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'osso-reuma', terms: ['risedronato', 'actonel'], verified: true },
  { id: 'ibandronato', activeIngredient: 'Ibandronato de sódio', brand: 'Bonviva', strengths: '150 mg; 3 mg/3 mL (injetável)', forms: 'comprimido revestido, injetável', tarja: 'vermelha', category: 'osso-reuma', terms: ['ibandronato', 'bonviva'], verified: true },
  { id: 'acido-zoledronico', activeIngredient: 'Ácido zoledrônico', brand: 'Aclasta', strengths: '4 e 5 mg', forms: 'solução para infusão', tarja: 'vermelha', category: 'osso-reuma', terms: ['zoledronico', 'aclasta', 'zometa'], verified: true },
  { id: 'denosumabe', activeIngredient: 'Denosumabe', brand: 'Prolia', strengths: '60 e 120 mg', forms: 'seringa preenchida (subcutânea)', tarja: 'vermelha', category: 'osso-reuma', terms: ['denosumabe', 'prolia', 'xgeva'], verified: true },
  { id: 'raloxifeno', activeIngredient: 'Cloridrato de raloxifeno', brand: 'Evista', strengths: '60 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'osso-reuma', terms: ['raloxifeno', 'evista'], verified: true },
  { id: 'calcitriol', activeIngredient: 'Calcitriol', brand: 'Rocaltrol', strengths: '0,25 mcg', forms: 'cápsula', tarja: 'vermelha', category: 'osso-reuma', terms: ['calcitriol', 'rocaltrol'], verified: true },
  { id: 'metotrexato', activeIngredient: 'Metotrexato', brand: 'Methotrexato', strengths: '2,5 mg; 25 mg/mL (injetável)', forms: 'comprimido, injetável', tarja: 'vermelha', category: 'osso-reuma', terms: ['metotrexato', 'mtx'], verified: true },
  { id: 'leflunomida', activeIngredient: 'Leflunomida', brand: 'Arava', strengths: '20 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'osso-reuma', terms: ['leflunomida', 'arava'], verified: true },
  { id: 'azatioprina', activeIngredient: 'Azatioprina', brand: 'Imuran', strengths: '50 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'osso-reuma', terms: ['azatioprina', 'imuran'], verified: true },
  { id: 'ciclosporina', activeIngredient: 'Ciclosporina', brand: 'Sandimmun Neoral', strengths: '10, 25, 50 e 100 mg', forms: 'cápsula, solução oral', tarja: 'vermelha', category: 'osso-reuma', terms: ['ciclosporina', 'sandimmun'], verified: true },
  { id: 'micofenolato', activeIngredient: 'Micofenolato de mofetila / sódico', brand: 'CellCept', strengths: '180, 360 e 500 mg', forms: 'comprimido revestido, cápsula', tarja: 'vermelha', category: 'osso-reuma', terms: ['micofenolato', 'cellcept', 'myfortic'], verified: true },

  // ══ Olhos ═════════════════════════════════════════════════════════════════
  { id: 'timolol', activeIngredient: 'Maleato de timolol', brand: 'Timoptol', strengths: '2,5 e 5 mg/mL (0,25% e 0,5%)', forms: 'colírio', tarja: 'vermelha', category: 'oftalmologia', terms: ['timolol', 'timoptol', 'glaucoma'], verified: true },
  { id: 'latanoprosta', activeIngredient: 'Latanoprosta', brand: 'Xalatan', strengths: '0,05 mg/mL', forms: 'colírio', tarja: 'vermelha', category: 'oftalmologia', terms: ['latanoprosta', 'xalatan', 'glaucoma'], verified: true },
  { id: 'bimatoprosta', activeIngredient: 'Bimatoprosta', brand: 'Lumigan', strengths: '0,1 e 0,3 mg/mL', forms: 'colírio', tarja: 'vermelha', category: 'oftalmologia', terms: ['bimatoprosta', 'lumigan'], verified: true },
  { id: 'travoprosta', activeIngredient: 'Travoprosta', brand: 'Travatan', strengths: '0,04 mg/mL', forms: 'colírio', tarja: 'vermelha', category: 'oftalmologia', terms: ['travoprosta', 'travatan'], verified: true },
  { id: 'dorzolamida', activeIngredient: 'Cloridrato de dorzolamida', brand: 'Trusopt', strengths: '20 mg/mL (isolada ou com timolol)', forms: 'colírio', tarja: 'vermelha', category: 'oftalmologia', terms: ['dorzolamida', 'trusopt'], verified: true },
  { id: 'brimonidina', activeIngredient: 'Tartarato de brimonidina', brand: 'Alphagan', strengths: '1,5 e 2 mg/mL', forms: 'colírio', tarja: 'vermelha', category: 'oftalmologia', terms: ['brimonidina', 'alphagan'], verified: true },
  { id: 'tobramicina', activeIngredient: 'Tobramicina (isolada ou com dexametasona)', brand: 'Tobrex / Tobradex', strengths: '3 mg/mL', forms: 'colírio, pomada oftálmica', tarja: 'vermelha', category: 'oftalmologia', terms: ['tobramicina', 'tobrex', 'tobradex'], verified: true },

  // ══ Hormônios e anticoncepção ═════════════════════════════════════════════
  { id: 'estradiol', activeIngredient: 'Estradiol (valerato ou hemi-hidratado)', brand: 'Natifa', strengths: '1 e 2 mg; gel 0,6 e 1 mg/g', forms: 'comprimido, gel transdérmico, adesivo', tarja: 'vermelha', category: 'hormonal', terms: ['estradiol', 'reposicao hormonal'], verified: true },
  { id: 'estriol', activeIngredient: 'Estriol', brand: 'Ovestrion', strengths: '1 mg; creme vaginal 1 mg/g', forms: 'comprimido, creme vaginal', tarja: 'vermelha', category: 'hormonal', terms: ['estriol', 'ovestrion'], verified: true },
  { id: 'tibolona', activeIngredient: 'Tibolona', brand: 'Livial', strengths: '2,5 mg', forms: 'comprimido', tarja: 'vermelha', category: 'hormonal', terms: ['tibolona', 'livial'], verified: true },
  { id: 'progesterona', activeIngredient: 'Progesterona micronizada', brand: 'Utrogestan', strengths: '100 e 200 mg', forms: 'cápsula, gel vaginal', tarja: 'vermelha', category: 'hormonal', terms: ['progesterona', 'utrogestan'], verified: true },
  { id: 'dienogeste', activeIngredient: 'Dienogeste', brand: 'Allurene', strengths: '2 mg (isolado ou com estradiol)', forms: 'comprimido', tarja: 'vermelha', category: 'hormonal', terms: ['dienogeste', 'endometriose'], verified: true },
  { id: 'drospirenona-etinilestradiol', activeIngredient: 'Drospirenona + etinilestradiol', brand: 'Yasmin / Yaz', strengths: '3 mg + 0,02 ou 0,03 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'hormonal', terms: ['drospirenona', 'yasmin', 'yaz', 'anticoncepcional'], verified: true },
  { id: 'levonorgestrel-etinilestradiol', activeIngredient: 'Levonorgestrel + etinilestradiol', brand: 'Microvlar', strengths: '0,15 mg + 0,03 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'hormonal', terms: ['levonorgestrel', 'microvlar', 'anticoncepcional'], verified: true },
  { id: 'gestodeno-etinilestradiol', activeIngredient: 'Gestodeno + etinilestradiol', brand: 'Gynera', strengths: '0,075 mg + 0,02 ou 0,03 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'hormonal', terms: ['gestodeno', 'gynera', 'anticoncepcional'], verified: true },
  { id: 'desogestrel', activeIngredient: 'Desogestrel', brand: 'Cerazette', strengths: '0,075 mg (isolado); 0,15 mg com etinilestradiol', forms: 'comprimido revestido', tarja: 'vermelha', category: 'hormonal', terms: ['desogestrel', 'cerazette'], verified: true },
  { id: 'ciproterona-etinilestradiol', activeIngredient: 'Acetato de ciproterona + etinilestradiol', brand: 'Diane 35', strengths: '2 mg + 0,035 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'hormonal', terms: ['ciproterona', 'diane', 'selene'], verified: true },
  { id: 'noretisterona', activeIngredient: 'Noretisterona (acetato ou enantato)', brand: 'Primolut-Nor', strengths: '0,35 e 10 mg; 50 mg/mL (injetável)', forms: 'comprimido, injetável', tarja: 'vermelha', category: 'hormonal', terms: ['noretisterona', 'primolut'], verified: true },
  { id: 'medroxiprogesterona', activeIngredient: 'Acetato de medroxiprogesterona', brand: 'Depo-Provera', strengths: '10 mg; 150 mg/mL (injetável trimestral)', forms: 'comprimido, suspensão injetável', tarja: 'vermelha', category: 'hormonal', terms: ['medroxiprogesterona', 'depo provera'], verified: true },
  { id: 'clomifeno', activeIngredient: 'Citrato de clomifeno', brand: 'Indux', strengths: '50 mg', forms: 'comprimido', tarja: 'vermelha', category: 'hormonal', terms: ['clomifeno', 'indux', 'clomid'], verified: true },
  { id: 'testosterona', activeIngredient: 'Testosterona (undecilato, cipionato ou gel)', brand: 'Nebido / Androgel', strengths: '250 mg/mL (injetável); gel 10 mg/g', forms: 'injetável, gel transdérmico', tarja: 'preta', category: 'hormonal', terms: ['testosterona', 'nebido', 'deposteron', 'androgel'], verified: true },
  { id: 'tamoxifeno', activeIngredient: 'Citrato de tamoxifeno', brand: 'Nolvadex', strengths: '10 e 20 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'hormonal', terms: ['tamoxifeno', 'nolvadex'], verified: true },
  { id: 'anastrozol', activeIngredient: 'Anastrozol', brand: 'Arimidex', strengths: '1 mg', forms: 'comprimido revestido', tarja: 'vermelha', category: 'hormonal', terms: ['anastrozol', 'arimidex'], verified: true },

  // ══ Vitaminas e suplementos ═══════════════════════════════════════════════
  { id: 'colecalciferol', activeIngredient: 'Colecalciferol (vitamina D3)', brand: 'Addera D3', strengths: '1.000, 2.000, 7.000 e 50.000 UI', forms: 'cápsula, comprimido, gotas', tarja: 'sem-tarja', category: 'suplemento', terms: ['vitamina d', 'colecalciferol', 'addera'], verified: true },
  { id: 'carbonato-calcio', activeIngredient: 'Carbonato de cálcio (com ou sem vitamina D)', brand: 'Caltrate', strengths: '500 e 600 mg de cálcio', forms: 'comprimido revestido', tarja: 'sem-tarja', category: 'suplemento', terms: ['calcio', 'caltrate'], verified: true },
  { id: 'sulfato-ferroso', activeIngredient: 'Sulfato ferroso', brand: 'Sulfato Ferroso', strengths: '40 mg de ferro elementar; 25 mg/mL (gotas)', forms: 'comprimido revestido, solução oral', tarja: 'sem-tarja', category: 'suplemento', terms: ['sulfato ferroso', 'ferro', 'anemia'], verified: true },
  { id: 'hidroxido-ferrico', activeIngredient: 'Sacarato de hidróxido férrico / ferro polimaltosado', brand: 'Noripurum', strengths: '100 mg de ferro; 50 mg/mL (gotas)', forms: 'comprimido mastigável, gotas, injetável', tarja: 'vermelha', category: 'suplemento', terms: ['noripurum', 'ferro polimaltosado'], verified: true },
  { id: 'acido-folico', activeIngredient: 'Ácido fólico', brand: 'Folacin', strengths: '0,2, 2 e 5 mg', forms: 'comprimido', tarja: 'sem-tarja', category: 'suplemento', terms: ['acido folico', 'folato'], verified: true },
  { id: 'cianocobalamina', activeIngredient: 'Cianocobalamina (vitamina B12)', brand: 'Citoneurin', strengths: '1.000 e 5.000 mcg', forms: 'comprimido, injetável', tarja: 'sem-tarja', category: 'suplemento', terms: ['b12', 'cianocobalamina', 'citoneurin'], verified: true },
  { id: 'cloreto-potassio', activeIngredient: 'Cloreto de potássio', brand: 'Slow-K', strengths: '600 mg (8 mEq); 6% (xarope)', forms: 'comprimido de liberação prolongada, xarope, injetável', tarja: 'vermelha', category: 'suplemento', terms: ['cloreto de potassio', 'slow k', 'potassio'], verified: true },
  { id: 'acido-tranexamico', activeIngredient: 'Ácido tranexâmico', brand: 'Transamin', strengths: '250 mg; 50 mg/mL (injetável)', forms: 'comprimido revestido, injetável', tarja: 'vermelha', category: 'suplemento', terms: ['acido tranexamico', 'transamin'], verified: true },
];
