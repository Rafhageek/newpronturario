/**
 * LOINC — subconjunto dos exames laboratoriais de rotina no Brasil.
 *
 * ── ATRIBUIÇÃO LOINC (exigida pela licença) ──────────────────────────────────
 * This material contains content from LOINC (https://loinc.org). LOINC is
 * copyright © 1995-2026, Regenstrief Institute, Inc. and the Logical Observation
 * Identifiers Names and Codes (LOINC) Committee and is available at no cost
 * under the license at https://loinc.org/license/. LOINC® is a registered
 * United States trademark of Regenstrief Institute, Inc.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Fonte dos códigos: LOINC (https://loinc.org/downloads/).
 * Verificação: cada `code` deste arquivo foi consultado, um a um, no serviço
 * público de busca LOINC do NLM/NIH (Clinical Table Search Service,
 * https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search) e o LONG_COMMON_NAME
 * oficial devolvido bate com o conceito descrito em `name_pt`. Códigos que não
 * fechavam com o conceito foram descartados, não "aproximados".
 * Checado em: 2026-07-25.
 *
 * PROCEDÊNCIA (honestidade de dados):
 *   • `code` = oficial LOINC, VERIFICADO na fonte acima (nenhum código inventado);
 *   • `name_pt` = tradução/nome de uso corrente no Brasil, escrita por nós — NÃO
 *     é a tradução oficial LOINC em português;
 *   • `unit_default` = unidade mais comum nos laboratórios brasileiros, por
 *     curadoria. É só um palpite de exibição: a unidade que vale é SEMPRE a do
 *     laudo, que varia entre laboratórios e métodos;
 *   • `verified` = `true` só quando o código passou pela conferência acima.
 *
 * ⚠️ Isto NÃO é a tabela LOINC completa (a oficial tem dezenas de milhares de
 * códigos). É um recorte para reconhecer exames comuns e organizar resultados do
 * paciente. Não interpreta laudo, não estabelece valor de referência e não
 * substitui o laboratório nem o médico.
 */

export const LOINC_SOURCE_URL = 'https://loinc.org/downloads/';

/** Serviço público usado para conferir cada código (NLM/NIH). */
export const LOINC_VERIFICATION_URL =
  'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search';

/** Data da última conferência dos códigos (AAAA-MM-DD). */
export const LOINC_CHECKED_AT = '2026-07-25';

/** Aviso de atribuição a exibir em qualquer tela que mostre códigos LOINC. */
export const LOINC_ATTRIBUTION =
  'Códigos LOINC® © 1995-2026 Regenstrief Institute, Inc. e o LOINC Committee, usados sob a licença em loinc.org/license. LOINC® é marca registrada do Regenstrief Institute, Inc.';

export type LoincCategory =
  | 'hemograma'
  | 'coagulacao'
  | 'glicemia'
  | 'lipidios'
  | 'renal'
  | 'eletrolitos'
  | 'hepatico'
  | 'tireoide'
  | 'hormonios'
  | 'vitaminas-minerais'
  | 'inflamacao'
  | 'cardiaco'
  | 'marcadores-tumorais'
  | 'sorologia'
  | 'urina'
  | 'fezes'
  | 'gasometria'
  | 'painel';

export const LOINC_CATEGORY_LABELS: Record<LoincCategory, string> = {
  hemograma: 'Hemograma',
  coagulacao: 'Coagulação',
  glicemia: 'Glicemia e diabetes',
  lipidios: 'Colesterol e triglicerídeos',
  renal: 'Rins e urina de 24 h',
  eletrolitos: 'Eletrólitos e minerais',
  hepatico: 'Fígado e pâncreas',
  tireoide: 'Tireoide',
  hormonios: 'Hormônios',
  'vitaminas-minerais': 'Vitaminas e ferro',
  inflamacao: 'Inflamação e imunologia',
  cardiaco: 'Coração',
  'marcadores-tumorais': 'Marcadores tumorais',
  sorologia: 'Sorologias e infecções',
  urina: 'Urina (EAS e cultura)',
  fezes: 'Fezes',
  gasometria: 'Gasometria',
  painel: 'Painéis (conjuntos de exames)',
};

export interface LoincExam {
  /** Código LOINC oficial, com o dígito verificador (ex.: "718-7"). */
  code: string;
  /** Nome em português de uso corrente no Brasil (nosso, não oficial LOINC). */
  name_pt: string;
  /**
   * Unidade mais comum nos laudos brasileiros. Vazio (`''`) quando o resultado é
   * qualitativo (positivo/negativo, título, presença) ou é um painel.
   */
  unit_default: string;
  category: LoincCategory;
  /** `true` = código conferido na fonte oficial. Ver cabeçalho. */
  verified: boolean;
  /** Sinônimos/siglas extras para a busca (o `name_pt` já entra sozinho). */
  terms?: string[];
}

/** 223 exames. Todos com `verified: true` — ver método no cabeçalho. */
export const LOINC_EXAMS: readonly LoincExam[] = [
  // ── Hemograma ──────────────────────────────────────────────────────────────
  { code: '58410-2', name_pt: 'Hemograma completo', unit_default: '', category: 'hemograma', verified: true, terms: ['hemograma', 'hemograma completo'] },
  { code: '718-7', name_pt: 'Hemoglobina', unit_default: 'g/dL', category: 'hemograma', verified: true, terms: ['hb'] },
  { code: '4544-3', name_pt: 'Hematócrito', unit_default: '%', category: 'hemograma', verified: true, terms: ['ht', 'hct'] },
  { code: '789-8', name_pt: 'Hemácias (eritrócitos)', unit_default: 'milhões/mm³', category: 'hemograma', verified: true, terms: ['eritrocitos', 'globulos vermelhos'] },
  { code: '6690-2', name_pt: 'Leucócitos (contagem global)', unit_default: '/mm³', category: 'hemograma', verified: true, terms: ['leucograma', 'globulos brancos'] },
  { code: '777-3', name_pt: 'Plaquetas', unit_default: '/mm³', category: 'hemograma', verified: true },
  { code: '787-2', name_pt: 'VCM (volume corpuscular médio)', unit_default: 'fL', category: 'hemograma', verified: true, terms: ['vcm', 'mcv'] },
  { code: '785-6', name_pt: 'HCM (hemoglobina corpuscular média)', unit_default: 'pg', category: 'hemograma', verified: true, terms: ['hcm', 'mch'] },
  { code: '786-4', name_pt: 'CHCM (concentração de hemoglobina corpuscular média)', unit_default: 'g/dL', category: 'hemograma', verified: true, terms: ['chcm', 'mchc'] },
  { code: '788-0', name_pt: 'RDW (índice de anisocitose)', unit_default: '%', category: 'hemograma', verified: true, terms: ['rdw'] },
  { code: '32623-1', name_pt: 'VPM (volume plaquetário médio)', unit_default: 'fL', category: 'hemograma', verified: true, terms: ['vpm', 'mpv'] },
  { code: '770-8', name_pt: 'Neutrófilos (percentual)', unit_default: '%', category: 'hemograma', verified: true },
  { code: '751-8', name_pt: 'Neutrófilos (contagem absoluta)', unit_default: '/mm³', category: 'hemograma', verified: true },
  { code: '736-9', name_pt: 'Linfócitos (percentual)', unit_default: '%', category: 'hemograma', verified: true },
  { code: '731-0', name_pt: 'Linfócitos (contagem absoluta)', unit_default: '/mm³', category: 'hemograma', verified: true },
  { code: '5905-5', name_pt: 'Monócitos (percentual)', unit_default: '%', category: 'hemograma', verified: true },
  { code: '742-7', name_pt: 'Monócitos (contagem absoluta)', unit_default: '/mm³', category: 'hemograma', verified: true },
  { code: '713-8', name_pt: 'Eosinófilos (percentual)', unit_default: '%', category: 'hemograma', verified: true },
  { code: '711-2', name_pt: 'Eosinófilos (contagem absoluta)', unit_default: '/mm³', category: 'hemograma', verified: true },
  { code: '706-2', name_pt: 'Basófilos (percentual)', unit_default: '%', category: 'hemograma', verified: true },
  { code: '704-7', name_pt: 'Basófilos (contagem absoluta)', unit_default: '/mm³', category: 'hemograma', verified: true },
  { code: '4679-7', name_pt: 'Reticulócitos (percentual)', unit_default: '%', category: 'hemograma', verified: true },
  { code: '60474-4', name_pt: 'Reticulócitos (contagem absoluta)', unit_default: '/mm³', category: 'hemograma', verified: true },
  { code: '30341-2', name_pt: 'VHS (velocidade de hemossedimentação)', unit_default: 'mm/h', category: 'hemograma', verified: true, terms: ['vhs', 'vs', 'hemossedimentacao'] },
  { code: '4537-7', name_pt: 'VHS pelo método de Westergren', unit_default: 'mm/h', category: 'hemograma', verified: true, terms: ['westergren'] },
  { code: '4552-6', name_pt: 'Hemoglobina A2 (eletroforese de hemoglobina)', unit_default: '%', category: 'hemograma', verified: true, terms: ['eletroforese de hemoglobina', 'talassemia'] },
  { code: '4621-9', name_pt: 'Hemoglobina S (pesquisa)', unit_default: '', category: 'hemograma', verified: true, terms: ['falciforme', 'anemia falciforme'] },
  { code: '882-1', name_pt: 'Tipagem sanguínea ABO e fator Rh', unit_default: '', category: 'hemograma', verified: true, terms: ['tipo sanguineo', 'abo', 'fator rh'] },

  // ── Coagulação ─────────────────────────────────────────────────────────────
  { code: '5902-2', name_pt: 'Tempo de protrombina (TP)', unit_default: 's', category: 'coagulacao', verified: true, terms: ['tap', 'tempo de atividade de protrombina'] },
  { code: '6301-6', name_pt: 'INR (RNI)', unit_default: '', category: 'coagulacao', verified: true, terms: ['inr', 'rni', 'varfarina'] },
  { code: '3173-2', name_pt: 'TTPa (tempo de tromboplastina parcial ativada)', unit_default: 's', category: 'coagulacao', verified: true, terms: ['ttpa', 'kptt'] },
  { code: '3255-7', name_pt: 'Fibrinogênio', unit_default: 'mg/dL', category: 'coagulacao', verified: true },
  { code: '48065-7', name_pt: 'D-dímero', unit_default: 'ng/mL FEU', category: 'coagulacao', verified: true, terms: ['d dimero'] },

  // ── Glicemia e diabetes ────────────────────────────────────────────────────
  { code: '2345-7', name_pt: 'Glicose (glicemia)', unit_default: 'mg/dL', category: 'glicemia', verified: true, terms: ['glicemia', 'acucar no sangue'] },
  { code: '1558-6', name_pt: 'Glicemia de jejum', unit_default: 'mg/dL', category: 'glicemia', verified: true, terms: ['glicemia em jejum'] },
  { code: '1518-0', name_pt: 'Glicemia 2 h após 75 g de glicose (curva glicêmica)', unit_default: 'mg/dL', category: 'glicemia', verified: true, terms: ['totg', 'curva glicemica', 'teste oral de tolerancia'] },
  { code: '4548-4', name_pt: 'Hemoglobina glicada (HbA1c)', unit_default: '%', category: 'glicemia', verified: true, terms: ['hba1c', 'glicada', 'a1c'] },
  { code: '17856-6', name_pt: 'Hemoglobina glicada por HPLC', unit_default: '%', category: 'glicemia', verified: true },
  { code: '27353-2', name_pt: 'Glicemia média estimada', unit_default: 'mg/dL', category: 'glicemia', verified: true, terms: ['gme'] },
  { code: '15069-8', name_pt: 'Frutosamina', unit_default: 'µmol/L', category: 'glicemia', verified: true },
  { code: '20448-7', name_pt: 'Insulina', unit_default: 'µUI/mL', category: 'glicemia', verified: true },
  { code: '1986-9', name_pt: 'Peptídeo C', unit_default: 'ng/mL', category: 'glicemia', verified: true, terms: ['peptideo c'] },

  // ── Colesterol e triglicerídeos ────────────────────────────────────────────
  { code: '100898-6', name_pt: 'Perfil lipídico (lipidograma)', unit_default: '', category: 'painel', verified: true, terms: ['lipidograma', 'perfil lipidico'] },
  { code: '2093-3', name_pt: 'Colesterol total', unit_default: 'mg/dL', category: 'lipidios', verified: true },
  { code: '2085-9', name_pt: 'HDL-colesterol', unit_default: 'mg/dL', category: 'lipidios', verified: true, terms: ['hdl', 'colesterol bom'] },
  { code: '2089-1', name_pt: 'LDL-colesterol', unit_default: 'mg/dL', category: 'lipidios', verified: true, terms: ['ldl', 'colesterol ruim'] },
  { code: '13457-7', name_pt: 'LDL-colesterol (calculado)', unit_default: 'mg/dL', category: 'lipidios', verified: true, terms: ['ldl calculado', 'friedewald'] },
  { code: '18262-6', name_pt: 'LDL-colesterol (dosagem direta)', unit_default: 'mg/dL', category: 'lipidios', verified: true, terms: ['ldl direto'] },
  { code: '13458-5', name_pt: 'VLDL-colesterol (calculado)', unit_default: 'mg/dL', category: 'lipidios', verified: true, terms: ['vldl'] },
  { code: '43396-1', name_pt: 'Colesterol não-HDL', unit_default: 'mg/dL', category: 'lipidios', verified: true, terms: ['nao hdl'] },
  { code: '2571-8', name_pt: 'Triglicerídeos', unit_default: 'mg/dL', category: 'lipidios', verified: true, terms: ['triglicerides', 'triglicerideos'] },
  { code: '1869-7', name_pt: 'Apolipoproteína A-I', unit_default: 'mg/dL', category: 'lipidios', verified: true, terms: ['apo a1'] },
  { code: '1884-6', name_pt: 'Apolipoproteína B', unit_default: 'mg/dL', category: 'lipidios', verified: true, terms: ['apo b'] },
  { code: '10835-7', name_pt: 'Lipoproteína (a)', unit_default: 'mg/dL', category: 'lipidios', verified: true, terms: ['lp a', 'lipoproteina a'] },

  // ── Rins e urina de 24 h ───────────────────────────────────────────────────
  { code: '2160-0', name_pt: 'Creatinina (sangue)', unit_default: 'mg/dL', category: 'renal', verified: true },
  { code: '3091-6', name_pt: 'Ureia (sangue)', unit_default: 'mg/dL', category: 'renal', verified: true, terms: ['ureia'] },
  { code: '3094-0', name_pt: 'Nitrogênio ureico (BUN)', unit_default: 'mg/dL', category: 'renal', verified: true, terms: ['bun'] },
  { code: '98979-8', name_pt: 'Taxa de filtração glomerular estimada (CKD-EPI 2021)', unit_default: 'mL/min/1,73 m²', category: 'renal', verified: true, terms: ['tfg', 'filtracao glomerular', 'ckd epi'] },
  { code: '62238-1', name_pt: 'Taxa de filtração glomerular estimada (CKD-EPI)', unit_default: 'mL/min/1,73 m²', category: 'renal', verified: true, terms: ['tfg'] },
  { code: '33914-3', name_pt: 'Taxa de filtração glomerular estimada (MDRD)', unit_default: 'mL/min/1,73 m²', category: 'renal', verified: true, terms: ['tfg', 'mdrd'] },
  { code: '3084-1', name_pt: 'Ácido úrico (sangue)', unit_default: 'mg/dL', category: 'renal', verified: true, terms: ['acido urico', 'gota'] },
  { code: '2164-2', name_pt: 'Depuração (clearance) de creatinina', unit_default: 'mL/min', category: 'renal', verified: true, terms: ['clearance'] },
  { code: '2161-8', name_pt: 'Creatinina urinária', unit_default: 'mg/dL', category: 'renal', verified: true },
  { code: '14957-5', name_pt: 'Microalbuminúria (albumina na urina)', unit_default: 'mg/L', category: 'renal', verified: true, terms: ['microalbuminuria'] },
  { code: '14959-1', name_pt: 'Relação albumina/creatinina urinária (RAC)', unit_default: 'mg/g', category: 'renal', verified: true, terms: ['rac', 'relacao albumina creatinina'] },
  { code: '1755-8', name_pt: 'Albuminúria de 24 horas', unit_default: 'mg/24 h', category: 'renal', verified: true },
  { code: '2889-4', name_pt: 'Proteinúria de 24 horas', unit_default: 'mg/24 h', category: 'renal', verified: true, terms: ['proteinuria'] },
  { code: '3167-4', name_pt: 'Volume urinário de 24 horas', unit_default: 'mL', category: 'renal', verified: true },
  { code: '2692-2', name_pt: 'Osmolalidade do sangue', unit_default: 'mOsm/kg', category: 'renal', verified: true },
  { code: '2695-5', name_pt: 'Osmolalidade urinária', unit_default: 'mOsm/kg', category: 'renal', verified: true },
  { code: '2955-3', name_pt: 'Sódio urinário', unit_default: 'mEq/L', category: 'renal', verified: true },
  { code: '2828-2', name_pt: 'Potássio urinário', unit_default: 'mEq/L', category: 'renal', verified: true },
  { code: '2078-4', name_pt: 'Cloreto urinário', unit_default: 'mEq/L', category: 'renal', verified: true },
  { code: '3086-6', name_pt: 'Ácido úrico urinário', unit_default: 'mg/dL', category: 'renal', verified: true },
  { code: '6874-2', name_pt: 'Cálcio urinário de 24 horas', unit_default: 'mg/24 h', category: 'renal', verified: true },
  { code: '2778-9', name_pt: 'Fósforo urinário', unit_default: 'mg/dL', category: 'renal', verified: true },

  // ── Eletrólitos e minerais ─────────────────────────────────────────────────
  { code: '51990-0', name_pt: 'Painel metabólico básico', unit_default: '', category: 'painel', verified: true },
  { code: '24323-8', name_pt: 'Painel metabólico completo', unit_default: '', category: 'painel', verified: true },
  { code: '2951-2', name_pt: 'Sódio', unit_default: 'mEq/L', category: 'eletrolitos', verified: true, terms: ['sodio', 'na'] },
  { code: '2823-3', name_pt: 'Potássio', unit_default: 'mEq/L', category: 'eletrolitos', verified: true, terms: ['potassio', 'k'] },
  { code: '2075-0', name_pt: 'Cloreto', unit_default: 'mEq/L', category: 'eletrolitos', verified: true, terms: ['cloro'] },
  { code: '17861-6', name_pt: 'Cálcio total', unit_default: 'mg/dL', category: 'eletrolitos', verified: true, terms: ['calcio'] },
  { code: '1994-3', name_pt: 'Cálcio iônico', unit_default: 'mmol/L', category: 'eletrolitos', verified: true, terms: ['calcio ionico', 'calcio ionizado'] },
  { code: '19123-9', name_pt: 'Magnésio', unit_default: 'mg/dL', category: 'eletrolitos', verified: true, terms: ['magnesio'] },
  { code: '2777-1', name_pt: 'Fósforo', unit_default: 'mg/dL', category: 'eletrolitos', verified: true, terms: ['fosforo', 'fosfato'] },
  { code: '2028-9', name_pt: 'Gás carbônico total (CO₂ total)', unit_default: 'mEq/L', category: 'eletrolitos', verified: true, terms: ['co2 total', 'bicarbonato venoso'] },
  { code: '1863-0', name_pt: 'Ânion gap', unit_default: 'mEq/L', category: 'eletrolitos', verified: true, terms: ['anion gap'] },

  // ── Fígado e pâncreas ──────────────────────────────────────────────────────
  { code: '24325-3', name_pt: 'Perfil hepático (painel)', unit_default: '', category: 'painel', verified: true, terms: ['hepatograma'] },
  { code: '1742-6', name_pt: 'TGP / ALT (alanina aminotransferase)', unit_default: 'U/L', category: 'hepatico', verified: true, terms: ['tgp', 'alt', 'alanina'] },
  { code: '1920-8', name_pt: 'TGO / AST (aspartato aminotransferase)', unit_default: 'U/L', category: 'hepatico', verified: true, terms: ['tgo', 'ast', 'aspartato'] },
  { code: '6768-6', name_pt: 'Fosfatase alcalina', unit_default: 'U/L', category: 'hepatico', verified: true, terms: ['fal', 'fosfatase alcalina'] },
  { code: '1777-2', name_pt: 'Fosfatase alcalina óssea', unit_default: 'U/L', category: 'hepatico', verified: true },
  { code: '2324-2', name_pt: 'Gama-GT (gama glutamil transferase)', unit_default: 'U/L', category: 'hepatico', verified: true, terms: ['ggt', 'gama gt', 'gamaglutamil'] },
  { code: '1975-2', name_pt: 'Bilirrubina total', unit_default: 'mg/dL', category: 'hepatico', verified: true },
  { code: '1968-7', name_pt: 'Bilirrubina direta', unit_default: 'mg/dL', category: 'hepatico', verified: true },
  { code: '1971-1', name_pt: 'Bilirrubina indireta', unit_default: 'mg/dL', category: 'hepatico', verified: true },
  { code: '1751-7', name_pt: 'Albumina', unit_default: 'g/dL', category: 'hepatico', verified: true },
  { code: '2885-2', name_pt: 'Proteínas totais', unit_default: 'g/dL', category: 'hepatico', verified: true, terms: ['proteinas totais'] },
  { code: '10834-0', name_pt: 'Globulinas', unit_default: 'g/dL', category: 'hepatico', verified: true },
  { code: '1759-0', name_pt: 'Relação albumina/globulina', unit_default: '', category: 'hepatico', verified: true },
  { code: '2532-0', name_pt: 'DHL (desidrogenase lática)', unit_default: 'U/L', category: 'hepatico', verified: true, terms: ['ldh', 'dhl'] },
  { code: '1798-8', name_pt: 'Amilase', unit_default: 'U/L', category: 'hepatico', verified: true },
  { code: '1799-6', name_pt: 'Amilase urinária', unit_default: 'U/L', category: 'hepatico', verified: true },
  { code: '3040-3', name_pt: 'Lipase', unit_default: 'U/L', category: 'hepatico', verified: true },
  { code: '22763-7', name_pt: 'Amônia', unit_default: 'µg/dL', category: 'hepatico', verified: true, terms: ['amonia'] },

  // ── Tireoide ───────────────────────────────────────────────────────────────
  { code: '3016-3', name_pt: 'TSH (hormônio tireoestimulante)', unit_default: 'µUI/mL', category: 'tireoide', verified: true, terms: ['tsh', 'tireoestimulante'] },
  { code: '3024-7', name_pt: 'T4 livre (tiroxina livre)', unit_default: 'ng/dL', category: 'tireoide', verified: true, terms: ['t4 livre', 't4l'] },
  { code: '3026-2', name_pt: 'T4 total (tiroxina)', unit_default: 'µg/dL', category: 'tireoide', verified: true, terms: ['t4'] },
  { code: '3053-6', name_pt: 'T3 total (triiodotironina)', unit_default: 'ng/dL', category: 'tireoide', verified: true, terms: ['t3'] },
  { code: '3051-0', name_pt: 'T3 livre', unit_default: 'pg/mL', category: 'tireoide', verified: true, terms: ['t3 livre'] },
  { code: '32215-6', name_pt: 'Índice de tiroxina livre', unit_default: '', category: 'tireoide', verified: true },
  { code: '8099-4', name_pt: 'Anti-TPO (anticorpo antitireoperoxidase)', unit_default: 'UI/mL', category: 'tireoide', verified: true, terms: ['anti tpo', 'antitireoperoxidase', 'hashimoto'] },
  { code: '110119-5', name_pt: 'Anti-tireoglobulina', unit_default: 'UI/mL', category: 'tireoide', verified: true, terms: ['anti tg', 'antitireoglobulina'] },
  { code: '3013-0', name_pt: 'Tireoglobulina', unit_default: 'ng/mL', category: 'tireoide', verified: true },
  { code: '5385-0', name_pt: 'TRAb (anticorpo antirreceptor de TSH)', unit_default: 'UI/L', category: 'tireoide', verified: true, terms: ['trab', 'graves'] },

  // ── Hormônios ──────────────────────────────────────────────────────────────
  { code: '2842-3', name_pt: 'Prolactina', unit_default: 'ng/mL', category: 'hormonios', verified: true },
  { code: '2986-8', name_pt: 'Testosterona total', unit_default: 'ng/dL', category: 'hormonios', verified: true },
  { code: '2991-8', name_pt: 'Testosterona livre', unit_default: 'pg/mL', category: 'hormonios', verified: true },
  { code: '24125-7', name_pt: 'Índice de androgênios livres', unit_default: '', category: 'hormonios', verified: true },
  { code: '2243-4', name_pt: 'Estradiol', unit_default: 'pg/mL', category: 'hormonios', verified: true, terms: ['e2'] },
  { code: '15067-2', name_pt: 'FSH (hormônio folículo-estimulante)', unit_default: 'mUI/mL', category: 'hormonios', verified: true, terms: ['fsh'] },
  { code: '10501-5', name_pt: 'LH (hormônio luteinizante)', unit_default: 'mUI/mL', category: 'hormonios', verified: true, terms: ['lh'] },
  { code: '2839-9', name_pt: 'Progesterona', unit_default: 'ng/mL', category: 'hormonios', verified: true },
  { code: '2191-5', name_pt: 'SDHEA (sulfato de deidroepiandrosterona)', unit_default: 'µg/dL', category: 'hormonios', verified: true, terms: ['dheas', 'sdhea'] },
  { code: '13967-5', name_pt: 'SHBG (globulina ligadora de hormônios sexuais)', unit_default: 'nmol/L', category: 'hormonios', verified: true, terms: ['shbg'] },
  { code: '2731-8', name_pt: 'PTH (paratormônio intacto)', unit_default: 'pg/mL', category: 'hormonios', verified: true, terms: ['pth', 'paratormonio'] },
  { code: '2143-6', name_pt: 'Cortisol (sangue)', unit_default: 'µg/dL', category: 'hormonios', verified: true },
  { code: '2142-8', name_pt: 'Cortisol salivar', unit_default: 'ng/mL', category: 'hormonios', verified: true },
  { code: '2963-7', name_pt: 'GH (hormônio do crescimento)', unit_default: 'ng/mL', category: 'hormonios', verified: true, terms: ['gh', 'somatotropina'] },
  { code: '2484-4', name_pt: 'IGF-1 (somatomedina C)', unit_default: 'ng/mL', category: 'hormonios', verified: true, terms: ['igf 1', 'somatomedina'] },
  { code: '19080-1', name_pt: 'Beta-hCG quantitativo', unit_default: 'mUI/mL', category: 'hormonios', verified: true, terms: ['beta hcg', 'teste de gravidez'] },
  { code: '38476-8', name_pt: 'Hormônio antimülleriano (AMH)', unit_default: 'ng/mL', category: 'hormonios', verified: true, terms: ['amh', 'antimulleriano'] },
  { code: '1763-2', name_pt: 'Aldosterona', unit_default: 'ng/dL', category: 'hormonios', verified: true },
  { code: '2915-7', name_pt: 'Atividade de renina plasmática', unit_default: 'ng/mL/h', category: 'hormonios', verified: true, terms: ['renina'] },

  // ── Vitaminas e ferro ──────────────────────────────────────────────────────
  { code: '62292-8', name_pt: 'Vitamina D — 25-hidroxivitamina D total', unit_default: 'ng/mL', category: 'vitaminas-minerais', verified: true, terms: ['vitamina d', '25 oh vitamina d'] },
  { code: '1989-3', name_pt: '25-hidroxivitamina D3', unit_default: 'ng/mL', category: 'vitaminas-minerais', verified: true, terms: ['vitamina d3'] },
  { code: '2132-9', name_pt: 'Vitamina B12 (cobalamina)', unit_default: 'pg/mL', category: 'vitaminas-minerais', verified: true, terms: ['b12', 'cobalamina'] },
  { code: '2284-8', name_pt: 'Ácido fólico (folato)', unit_default: 'ng/mL', category: 'vitaminas-minerais', verified: true, terms: ['acido folico', 'folato'] },
  { code: '2276-4', name_pt: 'Ferritina', unit_default: 'ng/mL', category: 'vitaminas-minerais', verified: true },
  { code: '2498-4', name_pt: 'Ferro sérico', unit_default: 'µg/dL', category: 'vitaminas-minerais', verified: true, terms: ['ferro'] },
  { code: '2500-7', name_pt: 'Capacidade total de ligação do ferro (TIBC)', unit_default: 'µg/dL', category: 'vitaminas-minerais', verified: true, terms: ['tibc', 'ctlf'] },
  { code: '2502-3', name_pt: 'Índice de saturação da transferrina', unit_default: '%', category: 'vitaminas-minerais', verified: true, terms: ['saturacao de transferrina'] },
  { code: '3034-6', name_pt: 'Transferrina', unit_default: 'mg/dL', category: 'vitaminas-minerais', verified: true },
  { code: '5763-8', name_pt: 'Zinco', unit_default: 'µg/dL', category: 'vitaminas-minerais', verified: true },
  { code: '47791-9', name_pt: 'Vitamina E (tocoferóis)', unit_default: 'mg/L', category: 'vitaminas-minerais', verified: true, terms: ['vitamina e', 'tocoferol'] },
  { code: '2064-4', name_pt: 'Ceruloplasmina', unit_default: 'mg/dL', category: 'vitaminas-minerais', verified: true },
  { code: '2697-1', name_pt: 'Osteocalcina', unit_default: 'ng/mL', category: 'vitaminas-minerais', verified: true },

  // ── Inflamação e imunologia ────────────────────────────────────────────────
  { code: '1988-5', name_pt: 'PCR (proteína C reativa)', unit_default: 'mg/L', category: 'inflamacao', verified: true, terms: ['pcr', 'proteina c reativa'] },
  { code: '30522-7', name_pt: 'PCR ultrassensível', unit_default: 'mg/L', category: 'inflamacao', verified: true, terms: ['pcr us', 'pcr ultra sensivel'] },
  { code: '11572-5', name_pt: 'Fator reumatoide', unit_default: 'UI/mL', category: 'inflamacao', verified: true, terms: ['fator reumatoide', 'fr'] },
  { code: '5048-4', name_pt: 'FAN (fator antinuclear) — título', unit_default: '', category: 'inflamacao', verified: true, terms: ['fan', 'ana', 'antinuclear'] },
  { code: '33935-8', name_pt: 'Anti-CCP (peptídeo citrulinado cíclico)', unit_default: 'U/mL', category: 'inflamacao', verified: true, terms: ['anti ccp'] },
  { code: '4485-9', name_pt: 'Complemento C3', unit_default: 'mg/dL', category: 'inflamacao', verified: true, terms: ['c3'] },
  { code: '4498-2', name_pt: 'Complemento C4', unit_default: 'mg/dL', category: 'inflamacao', verified: true, terms: ['c4'] },
  { code: '2465-3', name_pt: 'IgG', unit_default: 'mg/dL', category: 'inflamacao', verified: true, terms: ['imunoglobulina g'] },
  { code: '2458-8', name_pt: 'IgA', unit_default: 'mg/dL', category: 'inflamacao', verified: true, terms: ['imunoglobulina a'] },
  { code: '2472-9', name_pt: 'IgM', unit_default: 'mg/dL', category: 'inflamacao', verified: true, terms: ['imunoglobulina m'] },
  { code: '19113-0', name_pt: 'IgE total', unit_default: 'UI/mL', category: 'inflamacao', verified: true, terms: ['ige', 'alergia'] },
  { code: '31017-7', name_pt: 'Antitransglutaminase tecidual IgA', unit_default: 'U/mL', category: 'inflamacao', verified: true, terms: ['anti transglutaminase', 'celiaca', 'doenca celiaca'] },
  { code: '5370-2', name_pt: 'ASLO (antiestreptolisina O)', unit_default: 'UI/mL', category: 'inflamacao', verified: true, terms: ['aslo', 'antiestreptolisina'] },

  // ── Coração ────────────────────────────────────────────────────────────────
  { code: '33762-6', name_pt: 'NT-proBNP', unit_default: 'pg/mL', category: 'cardiaco', verified: true, terms: ['nt probnp', 'insuficiencia cardiaca'] },
  { code: '30934-4', name_pt: 'BNP (peptídeo natriurético tipo B)', unit_default: 'pg/mL', category: 'cardiaco', verified: true, terms: ['bnp'] },
  { code: '10839-9', name_pt: 'Troponina I cardíaca', unit_default: 'ng/mL', category: 'cardiaco', verified: true, terms: ['troponina i'] },
  { code: '89579-7', name_pt: 'Troponina I ultrassensível', unit_default: 'ng/L', category: 'cardiaco', verified: true, terms: ['troponina i us'] },
  { code: '6598-7', name_pt: 'Troponina T cardíaca', unit_default: 'ng/mL', category: 'cardiaco', verified: true, terms: ['troponina t'] },
  { code: '67151-1', name_pt: 'Troponina T ultrassensível', unit_default: 'ng/L', category: 'cardiaco', verified: true, terms: ['troponina t us'] },
  { code: '2157-6', name_pt: 'CPK (creatinoquinase total)', unit_default: 'U/L', category: 'cardiaco', verified: true, terms: ['cpk', 'ck total', 'creatinofosfoquinase'] },
  { code: '32673-6', name_pt: 'CK-MB (atividade)', unit_default: 'U/L', category: 'cardiaco', verified: true, terms: ['ckmb'] },
  { code: '13969-1', name_pt: 'CK-MB massa', unit_default: 'ng/mL', category: 'cardiaco', verified: true, terms: ['ckmb massa'] },

  // ── Marcadores tumorais ────────────────────────────────────────────────────
  { code: '2857-1', name_pt: 'PSA total', unit_default: 'ng/mL', category: 'marcadores-tumorais', verified: true, terms: ['psa', 'prostata'] },
  { code: '10886-0', name_pt: 'PSA livre', unit_default: 'ng/mL', category: 'marcadores-tumorais', verified: true },
  { code: '12841-3', name_pt: 'Relação PSA livre/total', unit_default: '', category: 'marcadores-tumorais', verified: true },
  { code: '2039-6', name_pt: 'CEA (antígeno carcinoembrionário)', unit_default: 'ng/mL', category: 'marcadores-tumorais', verified: true, terms: ['cea'] },
  { code: '10334-1', name_pt: 'CA 125', unit_default: 'U/mL', category: 'marcadores-tumorais', verified: true, terms: ['ca 125'] },
  { code: '24108-3', name_pt: 'CA 19-9', unit_default: 'U/mL', category: 'marcadores-tumorais', verified: true, terms: ['ca 19 9'] },
  { code: '6875-9', name_pt: 'CA 15-3', unit_default: 'U/mL', category: 'marcadores-tumorais', verified: true, terms: ['ca 15 3'] },
  { code: '1834-1', name_pt: 'Alfafetoproteína (AFP)', unit_default: 'ng/mL', category: 'marcadores-tumorais', verified: true, terms: ['afp', 'alfafetoproteina'] },

  // ── Sorologias e infecções ─────────────────────────────────────────────────
  { code: '5196-1', name_pt: 'HBsAg (antígeno de superfície da hepatite B)', unit_default: '', category: 'sorologia', verified: true, terms: ['hbsag', 'hepatite b'] },
  { code: '16935-9', name_pt: 'Anti-HBs (quantitativo)', unit_default: 'mUI/mL', category: 'sorologia', verified: true, terms: ['anti hbs'] },
  { code: '10900-9', name_pt: 'Anti-HBs (qualitativo)', unit_default: '', category: 'sorologia', verified: true, terms: ['anti hbs'] },
  { code: '13952-7', name_pt: 'Anti-HBc total', unit_default: '', category: 'sorologia', verified: true, terms: ['anti hbc'] },
  { code: '31204-1', name_pt: 'Anti-HBc IgM', unit_default: '', category: 'sorologia', verified: true },
  { code: '16128-1', name_pt: 'Anti-HCV (hepatite C)', unit_default: '', category: 'sorologia', verified: true, terms: ['anti hcv', 'hepatite c'] },
  { code: '56888-1', name_pt: 'HIV — antígeno p24 e anticorpos 1 e 2', unit_default: '', category: 'sorologia', verified: true, terms: ['hiv', 'aids'] },
  { code: '5292-8', name_pt: 'VDRL', unit_default: '', category: 'sorologia', verified: true, terms: ['vdrl', 'sifilis'] },
  { code: '20507-0', name_pt: 'RPR', unit_default: '', category: 'sorologia', verified: true, terms: ['rpr', 'sifilis'] },
  { code: '22587-0', name_pt: 'Anticorpos anti-Treponema pallidum', unit_default: '', category: 'sorologia', verified: true, terms: ['treponema', 'sifilis', 'fta abs'] },
  { code: '22580-5', name_pt: 'Toxoplasmose IgG', unit_default: '', category: 'sorologia', verified: true, terms: ['toxoplasmose'] },
  { code: '25542-2', name_pt: 'Toxoplasmose IgM', unit_default: '', category: 'sorologia', verified: true, terms: ['toxoplasmose'] },
  { code: '25514-1', name_pt: 'Rubéola IgG', unit_default: '', category: 'sorologia', verified: true, terms: ['rubeola'] },
  { code: '5334-8', name_pt: 'Rubéola IgG (quantitativo)', unit_default: 'UI/mL', category: 'sorologia', verified: true, terms: ['rubeola'] },
  { code: '8045-7', name_pt: 'Doença de Chagas — anticorpos anti-Trypanosoma cruzi', unit_default: 'UI/mL', category: 'sorologia', verified: true, terms: ['chagas', 'trypanosoma'] },
  { code: '91064-6', name_pt: 'Dengue — antígeno NS1', unit_default: '', category: 'sorologia', verified: true, terms: ['dengue', 'ns1'] },
  { code: '31843-6', name_pt: 'Helicobacter pylori — antígeno nas fezes', unit_default: '', category: 'sorologia', verified: true, terms: ['h pylori', 'helicobacter'] },

  // ── Urina (EAS e cultura) ──────────────────────────────────────────────────
  { code: '24357-6', name_pt: 'EAS / urina tipo I — fita reagente', unit_default: '', category: 'urina', verified: true, terms: ['eas', 'urina tipo 1', 'urina i', 'sumario de urina'] },
  { code: '5778-6', name_pt: 'Cor da urina', unit_default: '', category: 'urina', verified: true },
  { code: '5767-9', name_pt: 'Aspecto da urina', unit_default: '', category: 'urina', verified: true },
  { code: '32167-9', name_pt: 'Limpidez da urina', unit_default: '', category: 'urina', verified: true },
  { code: '5811-5', name_pt: 'Densidade urinária', unit_default: '', category: 'urina', verified: true },
  { code: '5803-2', name_pt: 'pH urinário', unit_default: '', category: 'urina', verified: true },
  { code: '5804-0', name_pt: 'Proteína na urina (fita)', unit_default: 'mg/dL', category: 'urina', verified: true },
  { code: '5792-7', name_pt: 'Glicose na urina (fita)', unit_default: 'mg/dL', category: 'urina', verified: true, terms: ['glicosuria'] },
  { code: '5794-3', name_pt: 'Hemoglobina na urina (fita)', unit_default: '', category: 'urina', verified: true, terms: ['hematuria'] },
  { code: '5797-6', name_pt: 'Corpos cetônicos na urina (fita)', unit_default: 'mg/dL', category: 'urina', verified: true, terms: ['cetonuria', 'cetona'] },
  { code: '5799-2', name_pt: 'Esterase leucocitária (fita)', unit_default: '', category: 'urina', verified: true },
  { code: '5802-4', name_pt: 'Nitrito (fita)', unit_default: '', category: 'urina', verified: true },
  { code: '5818-0', name_pt: 'Urobilinogênio (fita)', unit_default: '', category: 'urina', verified: true },
  { code: '5770-3', name_pt: 'Bilirrubina na urina (fita)', unit_default: '', category: 'urina', verified: true },
  { code: '5821-4', name_pt: 'Leucócitos no sedimento urinário', unit_default: '/campo', category: 'urina', verified: true, terms: ['piocitos'] },
  { code: '13945-1', name_pt: 'Hemácias no sedimento urinário', unit_default: '/campo', category: 'urina', verified: true },
  { code: '5787-7', name_pt: 'Células epiteliais no sedimento urinário', unit_default: '/campo', category: 'urina', verified: true },
  { code: '88966-7', name_pt: 'Cilindros hialinos no sedimento urinário', unit_default: '/campo', category: 'urina', verified: true, terms: ['cilindros'] },
  { code: '5769-5', name_pt: 'Bactérias no sedimento urinário', unit_default: '/campo', category: 'urina', verified: true },
  { code: '630-4', name_pt: 'Urocultura (cultura de urina)', unit_default: '', category: 'urina', verified: true, terms: ['urocultura', 'cultura de urina'] },

  // ── Fezes ──────────────────────────────────────────────────────────────────
  { code: '2335-8', name_pt: 'Sangue oculto nas fezes', unit_default: '', category: 'fezes', verified: true, terms: ['sangue oculto'] },
  { code: '57905-2', name_pt: 'Sangue oculto nas fezes (imunoquímico)', unit_default: '', category: 'fezes', verified: true, terms: ['fit', 'imunoquimico'] },
  { code: '10701-1', name_pt: 'Parasitológico de fezes', unit_default: '', category: 'fezes', verified: true, terms: ['parasitologico', 'epf', 'verme'] },

  // ── Gasometria ─────────────────────────────────────────────────────────────
  { code: '2744-1', name_pt: 'pH (sangue arterial)', unit_default: '', category: 'gasometria', verified: true },
  { code: '2703-7', name_pt: 'pO₂ (pressão parcial de oxigênio)', unit_default: 'mmHg', category: 'gasometria', verified: true, terms: ['po2'] },
  { code: '2019-8', name_pt: 'pCO₂ (pressão parcial de gás carbônico)', unit_default: 'mmHg', category: 'gasometria', verified: true, terms: ['pco2'] },
  { code: '1963-8', name_pt: 'Bicarbonato (HCO₃⁻)', unit_default: 'mEq/L', category: 'gasometria', verified: true, terms: ['bicarbonato', 'hco3'] },
  { code: '2708-6', name_pt: 'Saturação de oxigênio', unit_default: '%', category: 'gasometria', verified: true, terms: ['saturacao', 'sato2'] },
  { code: '2524-7', name_pt: 'Lactato', unit_default: 'mmol/L', category: 'gasometria', verified: true },
];
