import type { ConsentPurpose } from '../types/db';

export type DataCategory = 'vitals' | 'exams' | 'medications' | 'diary' | 'profile';

export const DATA_CATEGORY_LABELS: Record<DataCategory, string> = {
  vitals: 'Sinais vitais',
  exams: 'Exames',
  medications: 'Medicamentos',
  diary: 'Diário',
  profile: 'Dados pessoais',
};

/**
 * Versão do texto de consentimento apresentado ao titular.
 *
 * É gravada junto da decisão (coluna `consents.version`, e no `audit_log` pelo
 * RPC `set_patient_consent`). É ela que permite provar DEPOIS *o que* a pessoa
 * leu quando autorizou (LGPD art. 8º, §1º — o ônus de provar o consentimento é
 * do controlador). Mudou o texto de um setor? Sobe a versão.
 */
export const CONSENT_TEXT_VERSION = 'v2-setores-2026-07';

/**
 * Como o dado sai (ou não sai) do app em cada setor.
 *
 * Isto não é detalhe técnico, é o que separa o lícito do ilícito:
 *  - `anonymized`  — só estatística agregada, sem ninguém identificável. Dado
 *    anonimizado não é dado pessoal (art. 12), então fica fora do escopo da lei.
 *  - `directed`    — o próprio titular manda os dados dele para um prestador que
 *    ELE escolheu, no atendimento dele. É portabilidade/assistência (art. 11,
 *    §4º e incisos; art. 18, V), não venda de dado.
 *  - `notify_only` — nada sai. O app avisa o titular e ele decide procurar.
 */
export type SharingMode = 'anonymized' | 'directed' | 'notify_only';

export const SHARING_MODE_LABELS: Record<SharingMode, string> = {
  anonymized: 'Somente dados anonimizados e agregados',
  directed: 'Somente quando você enviar, para quem você escolher',
  notify_only: 'Nenhum dado sai — você só recebe o convite',
};

export interface ConsentScope {
  purpose: ConsentPurpose;
  label: string;
  description: string;
  /** Agrupamento na tela. */
  sector: 'cuidado' | 'pesquisa' | 'servicos' | 'publico';
  sharing: SharingMode;
  /** Base legal citada na própria interface — transparência (art. 9º). */
  legalBasis: string;
  /** Categorias de dados sugeridas para este compartilhamento. */
  defaultData: DataCategory[];
  /**
   * Limite que o app promete ao titular e que a UI EXIBE. Existe onde a lei
   * impõe uma fronteira que o consentimento não move.
   */
  limit?: string;
}

/**
 * Escopos de compartilhamento por setor (LGPD).
 *
 * ══ O QUE DELIBERADAMENTE NÃO EXISTE AQUI ══
 * Não há troca de dado clínico por vantagem econômica (desconto em remédio,
 * abatimento em plano). O art. 11, §4º VEDA comunicação de dado sensível de
 * saúde entre controladores com objetivo de obter vantagem econômica, e o §5º
 * VEDA à operadora de plano usar dado de saúde para seleção de risco. São
 * proibições — consentimento não as destrava. Além disso, oferecer dinheiro a
 * paciente idoso e crônico em troca do prontuário dele corrói o "consentimento
 * livre" do art. 8º. A ausência desse mecanismo é decisão consciente.
 *
 * Benefício pode existir, mas desacoplado do conteúdo clínico (ex.: convênio
 * negociado com farmácia válido para todo usuário, sem a farmácia receber dado).
 */
export const CONSENT_SCOPES: ConsentScope[] = [
  // ── Cuidado direto ───────────────────────────────────────────────────────
  {
    purpose: 'data_sharing_family',
    label: 'Família e cuidadores',
    description: 'Pessoas que você autorizar podem acompanhar seu cuidado.',
    sector: 'cuidado',
    sharing: 'directed',
    legalBasis: 'Consentimento do titular (art. 7º, I e art. 11, I)',
    defaultData: ['vitals', 'medications', 'diary'],
  },
  {
    purpose: 'data_sharing_doctor',
    label: 'Médicos',
    description: 'Profissionais que você convidar podem ver seus registros.',
    sector: 'cuidado',
    sharing: 'directed',
    legalBasis: 'Tutela da saúde por profissional de saúde (art. 11, II, "f")',
    defaultData: ['vitals', 'exams', 'medications', 'diary'],
  },
  {
    purpose: 'data_sharing_hospital',
    label: 'Hospitais e clínicas',
    description: 'Levar seu histórico para um atendimento, internação ou cirurgia.',
    sector: 'cuidado',
    sharing: 'directed',
    legalBasis: 'Prestação de serviços de saúde, em benefício do titular (art. 11, §4º)',
    defaultData: ['profile', 'exams', 'medications'],
    limit: 'Enviado por você, para o atendimento que você escolher.',
  },

  // ── Serviços ─────────────────────────────────────────────────────────────
  {
    purpose: 'data_sharing_pharmacy',
    label: 'Farmácias',
    description: 'Levar sua lista de medicamentos e alergias ao balcão, para conferência.',
    sector: 'servicos',
    sharing: 'directed',
    legalBasis: 'Assistência farmacêutica, em benefício do titular (art. 11, §4º)',
    defaultData: ['medications', 'profile'],
    limit: 'Serve para evitar interação e erro de dispensação — não vira cadastro de marketing.',
  },
  {
    purpose: 'data_sharing_lab',
    label: 'Laboratórios',
    description: 'Receba e compartilhe exames com laboratórios.',
    sector: 'servicos',
    sharing: 'directed',
    legalBasis: 'Serviços auxiliares de diagnose e terapia (art. 11, §4º)',
    defaultData: ['exams'],
  },
  {
    purpose: 'data_sharing_insurance',
    label: 'Convênio / plano de saúde',
    description: 'Enviar o necessário para reembolso ou autorização de procedimento.',
    sector: 'servicos',
    sharing: 'directed',
    legalBasis: 'Transações administrativas da prestação do serviço (art. 11, §4º, II)',
    defaultData: ['exams'],
    limit:
      'Somente para reembolso e autorização. Por lei, a operadora não pode usar dados de saúde '
      + 'para selecionar risco, definir preço ou excluir beneficiário (art. 11, §5º). Autorizar '
      + 'aqui não altera seu preço nem sua cobertura.',
  },

  // ── Pesquisa ─────────────────────────────────────────────────────────────
  {
    purpose: 'research_academic',
    label: 'Universidades e centros de pesquisa',
    description: 'Contribuir com estatística anonimizada para estudos em saúde pública.',
    sector: 'pesquisa',
    sharing: 'anonymized',
    legalBasis: 'Estudo por órgão de pesquisa, com anonimização (art. 11, II, "c" e art. 12)',
    defaultData: ['vitals', 'diary'],
    limit: 'Vai número, não pessoa: nem seu nome, nem contato, nem nada que identifique você.',
  },
  {
    purpose: 'research_pharma',
    label: 'Indústria farmacêutica',
    description: 'Contribuir com estatística anonimizada sobre uso e efeitos de medicamentos.',
    sector: 'pesquisa',
    sharing: 'anonymized',
    legalBasis: 'Estudo com base anonimizada (art. 12)',
    defaultData: ['medications', 'diary'],
    limit:
      'Somente agregado e anonimizado. Nenhum laboratório recebe quem você é, e isto não gera '
      + 'desconto nem contrapartida — a lei proíbe trocar dado de saúde por vantagem econômica.',
  },
  {
    purpose: 'study_invitations',
    label: 'Convites para participar de estudos',
    description: 'Ser avisado quando houver pesquisa recrutando para o seu caso.',
    sector: 'pesquisa',
    sharing: 'notify_only',
    legalBasis: 'Consentimento do titular (art. 7º, I)',
    defaultData: [],
    limit: 'O aviso chega para você dentro do app. O pesquisador só te conhece se VOCÊ procurar.',
  },

  // ── Poder público ────────────────────────────────────────────────────────
  {
    purpose: 'data_sharing_public_health',
    label: 'Órgãos públicos de saúde',
    description:
      'Contribuir voluntariamente com painéis de saúde pública (municipal, estadual ou federal).',
    sector: 'publico',
    sharing: 'anonymized',
    legalBasis: 'Política pública e tutela da saúde (art. 11, II, "a" e "b"; art. 7º, III)',
    defaultData: ['vitals'],
    limit:
      'Contribuição anonimizada e voluntária. Não se confunde com notificação compulsória de '
      + 'doença, que a lei já exige do serviço de saúde independentemente desta escolha.',
  },
];

export const SECTOR_LABELS: Record<ConsentScope['sector'], string> = {
  cuidado: 'Quem cuida de você',
  servicos: 'Serviços de saúde',
  pesquisa: 'Pesquisa e ciência',
  publico: 'Poder público',
};

/** Ordem de exibição dos grupos na tela. */
export const SECTOR_ORDER: ConsentScope['sector'][] = ['cuidado', 'servicos', 'pesquisa', 'publico'];

/** Escopos de um setor, preservando a ordem declarada em CONSENT_SCOPES. */
export function scopesBySector(sector: ConsentScope['sector']): ConsentScope[] {
  return CONSENT_SCOPES.filter((s) => s.sector === sector);
}

/**
 * Aviso que a tela exibe SEMPRE, ligado ou desligado.
 *
 * Existe porque hoje não há nenhum parceiro conectado: a autorização é
 * registrada, mas nada é transmitido. Dizer isso é obrigação de transparência
 * (art. 9º) — e prometer compartilhamento que não acontece seria informação
 * falsa ao titular.
 */
export const SECTOR_CONSENT_NOTICE =
  'Autorizar aqui registra a sua permissão — nada é enviado automaticamente. '
  + 'Enquanto não houver parceria formalizada, nenhum dado sai do aplicativo. '
  + 'Você pode desligar qualquer item quando quiser, e isso vale na hora.';

/**
 * Por que não existe "dados em troca de desconto". Fica visível na tela: se a
 * pessoa vier procurar por isso (é uma expectativa razoável), ela merece a
 * explicação em vez do silêncio.
 */
export const NO_DATA_FOR_BENEFIT_NOTICE =
  'Este aplicativo não troca dados de saúde por desconto ou benefício. A lei proíbe '
  + 'compartilhar dado de saúde para obter vantagem econômica, e proíbe plano de saúde usar '
  + 'esses dados para definir preço ou recusar alguém (LGPD art. 11, §4º e §5º). '
  + 'Sua decisão aqui nunca muda o que você paga nem o seu atendimento.';

/** Base legal LGPD por finalidade (rótulo curto para o log de acessos). */
export const LEGAL_BASIS_LABEL = 'Consentimento (LGPD Art. 7º, I)';
