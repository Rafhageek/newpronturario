/* ==========================================================================
 * ATIVIDADE FÍSICA — vocabulário, referência citada e contas factuais
 *
 * Este módulo é a fonte única do que a tela de Atividade física escreve. Ele
 * carrega quatro decisões de produto que não são detalhe de texto:
 *
 * 1. VOCABULÁRIO DE QUEM VAI USAR. "Hidroginástica", "fisioterapia",
 *    "jardinagem", "tarefas de casa" — não "treino A/B", não "HIIT", não
 *    "cardio". Quem abre esta tela tem 50, 60, 70 anos e chama o que faz pelo
 *    nome que faz. Jargão de academia aqui não é estilo: é a pessoa não achar
 *    o próprio movimento na lista e desistir de registrar.
 *
 * 2. ESFORÇO PELO TESTE DA FALA. A escala não pede frequencímetro, relógio nem
 *    cinta cardíaca — pede a própria voz da pessoa. É por isso que o rótulo
 *    DESCREVE o método ("conseguia conversar, mas não cantar") em vez de dizer
 *    só "moderado", que não significa nada para quem nunca mediu nada.
 *
 * 3. SINTOMA É REGISTRO, NÃO PARECER. Não existe aqui nenhum mapa
 *    sintoma → gravidade, sintoma → cor, sintoma → "procure um médico agora".
 *    O app não sabe o que aquele aperto no peito significa, e fingir que sabe é
 *    pior do que não dizer nada: ou assusta quem não precisava, ou tranquiliza
 *    quem precisava ir. O que o app faz é guardar o sintoma junto do esforço em
 *    que ele aconteceu, e lembrar de levar isso à consulta.
 *
 * 4. A OMS É CITAÇÃO, NUNCA META DO APP. Os 150 min/semana aparecem com fonte
 *    escrita, do mesmo jeito que uma faixa de referência aparece num laudo — e
 *    nunca como alvo, barra que enche, porcentagem atingida ou cor de
 *    desempenho. O total semanal que este módulo calcula é factual: "120
 *    minutos registrados nesta semana". Só isso.
 *
 * O QUE FOI DEIXADO DE FORA DE PROPÓSITO (e não deve ser adicionado depois):
 * sequência, ofensiva, recorde, "melhor semana", porcentagem da referência da
 * OMS, medalha, "parabéns", "você está indo bem". É a mesma decisão tomada no
 * diário alimentar em 05/08/2026 e documentada em `utils/diario-alimentar.ts`:
 * diário que pontua assiduidade vira obrigação, e obrigação em registro de
 * saúde faz a pessoa parar de registrar — ou registrar o que fica bonito.
 * ========================================================================== */

import { numeroBR } from '../utils/diario-alimentar';

/* ─────────────────────────── Tipo de atividade ─────────────────────────── */

export const ACTIVITY_KINDS = [
  'caminhada',
  'hidroginastica',
  'bicicleta',
  'musculacao',
  'fisioterapia',
  'danca',
  'jardinagem',
  'tarefas_de_casa',
  'natacao',
  'alongamento',
  'outro',
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/**
 * Rótulos visíveis. A ordem é a da lista na tela e foi escolhida por FREQUÊNCIA
 * no público, não por alfabeto: caminhada primeiro porque é o que a maioria faz;
 * "outro" por último porque é a saída, não a escolha.
 */
export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  caminhada: 'Caminhada',
  hidroginastica: 'Hidroginástica',
  bicicleta: 'Bicicleta',
  musculacao: 'Musculação',
  fisioterapia: 'Fisioterapia',
  danca: 'Dança',
  jardinagem: 'Jardinagem',
  tarefas_de_casa: 'Tarefas de casa',
  natacao: 'Natação',
  alongamento: 'Alongamento',
  outro: 'Outro',
};

export interface ActivityKindOption {
  valor: ActivityKind;
  rotulo: string;
}

/** A lista pronta para a tela, na ordem de exibição. */
export const ACTIVITY_KIND_OPTIONS: readonly ActivityKindOption[] = ACTIVITY_KINDS.map((valor) => ({
  valor,
  rotulo: ACTIVITY_KIND_LABELS[valor],
}));

/**
 * Jardinagem e tarefas de casa estão na lista de propósito. Elas costumam ficar
 * de fora dos apps de exercício porque "não contam como treino" — e é
 * exatamente por isso que precisam estar aqui: para muita gente com 60+ são o
 * movimento real do dia, e um registro que as ignora conta uma semana mais
 * parada do que a semana que de fato aconteceu.
 */
export const ACTIVITY_KIND_NOTA =
  'Vale o movimento do seu dia — inclusive jardinagem e tarefas de casa.';

/* ────────────────────── Esforço percebido (teste da fala) ────────────────── */

export const ACTIVITY_EFFORTS = ['leve', 'moderado', 'intenso'] as const;

export type ActivityEffort = (typeof ACTIVITY_EFFORTS)[number];

export interface ActivityEffortOption {
  valor: ActivityEffort;
  /** Nome curto do degrau. Nunca aparece sozinho: vem sempre com a descrição. */
  rotulo: string;
  /** O MÉTODO, escrito. É esta frase que a pessoa usa para se classificar. */
  descricao: string;
}

/**
 * Teste da fala: o jeito de medir esforço que não exige aparelho nenhum.
 *
 * A descrição não é texto de apoio — é o critério. Quem lê "moderado" não sabe
 * o que responder; quem lê "conseguia conversar, mas não cantar" sabe na hora,
 * porque está descrevendo o que aconteceu com a própria respiração.
 */
export const ACTIVITY_EFFORT_OPTIONS: readonly ActivityEffortOption[] = [
  {
    valor: 'leve',
    rotulo: 'Leve',
    descricao: 'Conseguia conversar e cantar',
  },
  {
    valor: 'moderado',
    rotulo: 'Moderado',
    descricao: 'Conseguia conversar, mas não cantar',
  },
  {
    valor: 'intenso',
    rotulo: 'Intenso',
    descricao: 'Não conseguia manter conversa',
  },
];

export const ACTIVITY_EFFORT_LABELS: Record<ActivityEffort, string> = {
  leve: 'Leve',
  moderado: 'Moderado',
  intenso: 'Intenso',
};

/** Cabeçalho do campo. Nomeia o método para quem nunca ouviu falar dele. */
export const ACTIVITY_EFFORT_PERGUNTA = 'Como estava sua respiração durante a atividade?';

export const ACTIVITY_EFFORT_NOTA =
  'Isto é o teste da fala: você se avalia pela própria voz, sem precisar de relógio nem frequencímetro.';

/* ──────────────────── Sintomas durante o esforço ──────────────────── */

export const ACTIVITY_SYMPTOMS = [
  'dor_no_peito',
  'falta_de_ar',
  'tontura',
  'palpitacao',
  'dor_nas_pernas',
  'nenhum',
] as const;

export type ActivitySymptom = (typeof ACTIVITY_SYMPTOMS)[number];

/**
 * O valor `nenhum` é uma AFIRMAÇÃO da pessoa, e por isso é uma opção marcável —
 * não o estado do campo em branco. Campo em branco significa "não respondeu", e
 * as duas coisas viram frases diferentes no prontuário
 * (ver `ACTIVITY_SYMPTOMS_NAO_RESPONDIDO` e `ACTIVITY_SYMPTOMS_NENHUM_TEXTO`).
 * É a mesma distinção que a 0049 trouxe para "sem alergia conhecida".
 */
export const ACTIVITY_SYMPTOM_LABELS: Record<ActivitySymptom, string> = {
  dor_no_peito: 'Dor ou aperto no peito',
  falta_de_ar: 'Falta de ar fora do comum',
  tontura: 'Tontura',
  palpitacao: 'Palpitação',
  dor_nas_pernas: 'Dor nas pernas',
  nenhum: 'Nenhum',
};

export interface ActivitySymptomOption {
  valor: ActivitySymptom;
  rotulo: string;
  /**
   * `true` no "Nenhum": marcar esta opção limpa as outras, e marcar qualquer
   * outra limpa esta. Não é enfeite de interface — é o que impede o registro de
   * afirmar, ao mesmo tempo, que houve e que não houve sintoma. O banco recusa
   * a contradição no CHECK `activity_sessions_symptoms_check` (0050); a tela só
   * evita que a pessoa chegue até lá.
   */
  exclusivo: boolean;
}

export const ACTIVITY_SYMPTOM_OPTIONS: readonly ActivitySymptomOption[] = ACTIVITY_SYMPTOMS.map(
  (valor) => ({
    valor,
    rotulo: ACTIVITY_SYMPTOM_LABELS[valor],
    exclusivo: valor === 'nenhum',
  }),
);

export const ACTIVITY_SYMPTOMS_PERGUNTA = 'Sentiu algo durante a atividade?';

/**
 * A ÚNICA frase que o app diz sobre sintoma — e repare no que ela não faz: não
 * classifica, não usa "grave", "atenção", "risco" nem "urgente", não manda
 * ninguém para o pronto-socorro e não sugere que está tudo bem. Ela devolve o
 * registro para a conversa com quem sabe interpretá-lo.
 *
 * Isso é decisão de produto, não timidez: o app não examinou ninguém. Um alerta
 * automático aqui seria diagnóstico — proibido pela regra 1 do projeto — e, do
 * outro lado, o silêncio absoluto deixaria a informação clínica mais valiosa do
 * módulo morrer dentro do celular.
 */
export const ACTIVITY_SYMPTOMS_NOTA =
  'O que você anotar aqui fica guardado junto da atividade. Leve este registro à sua próxima consulta: é o tipo de informação que costuma escapar na hora de conversar com o médico.';

/** Como a tela escreve um registro em que o campo não foi respondido. */
export const ACTIVITY_SYMPTOMS_NAO_RESPONDIDO = 'Sintomas não registrados';

/** Como a tela escreve um registro em que a pessoa afirmou não ter sentido nada. */
export const ACTIVITY_SYMPTOMS_NENHUM_TEXTO = 'Você registrou que não sentiu nada';

/**
 * Traduz a lista guardada no banco para a frase da tela, sem confundir
 * "não respondeu" com "não sentiu".
 */
export function descreverSintomas(sintomas: readonly string[] | null | undefined): string {
  const lista = (sintomas ?? []).filter((s): s is ActivitySymptom =>
    (ACTIVITY_SYMPTOMS as readonly string[]).includes(s),
  );
  if (lista.length === 0) return ACTIVITY_SYMPTOMS_NAO_RESPONDIDO;
  if (lista.length === 1 && lista[0] === 'nenhum') return ACTIVITY_SYMPTOMS_NENHUM_TEXTO;
  return ACTIVITY_SYMPTOMS.filter((s) => s !== 'nenhum' && lista.includes(s))
    .map((s) => ACTIVITY_SYMPTOM_LABELS[s])
    .join(' · ');
}

/* ───────────────────── Como se sentiu depois ───────────────────── */

/**
 * Reusa a escala 1–5 do diário (`MOOD_SCALE` em `data/mood-scale.ts`, rótulos em
 * `constants/health.ts`). Não existe escala nova aqui de propósito: duas escalas
 * de 1 a 5 com significados diferentes no mesmo prontuário é armadilha para
 * quem for ler depois — inclusive para o médico.
 */
export const ACTIVITY_FEELING_PERGUNTA = 'Como você se sentiu depois?';

export const ACTIVITY_FEELING_MIN = 1;
export const ACTIVITY_FEELING_MAX = 5;

/* ──────────────────── Referência da OMS (citada, nunca meta) ──────────────── */

/** 150 minutos por semana de atividade moderada, para adultos. */
export const OMS_MINUTOS_SEMANA = 150;

/** A fonte, escrita. Sem ela isto vira número solto — e número solto vira meta. */
export const OMS_REFERENCIA_FONTE =
  'Organização Mundial da Saúde — Diretrizes sobre atividade física e comportamento sedentário (2020)';

/**
 * O texto que a tela mostra. A última frase é a parte que não pode sair: ela
 * separa "referência de saúde pública" de "alvo que este app definiu para você".
 */
export const OMS_REFERENCIA_TEXTO = `A ${OMS_REFERENCIA_FONTE} cita ${OMS_MINUTOS_SEMANA} minutos por semana de atividade moderada para adultos. É uma referência geral de saúde pública, não uma meta que este app definiu para você — quem ajusta ao seu caso é sua equipe de saúde.`;

/**
 * Frase para quando não há meta definida pela pessoa. O app NÃO sugere uma —
 * mesma regra do diário alimentar.
 */
export const ACTIVITY_SEM_META_TEXTO = 'Sem meta definida — o app não sugere uma.';

/* ──────────────────────── Contas factuais da semana ──────────────────────── */

/** O mínimo que uma sessão precisa ter para entrar nas contas. */
export interface SessaoParaSoma {
  duration_min: number | null | undefined;
}

/**
 * Soma os minutos registrados. Ignora valor ausente, negativo ou não numérico —
 * um registro estragado não pode inventar minutos que ninguém fez.
 */
export function somaMinutos(sessoes: readonly SessaoParaSoma[]): number {
  return sessoes.reduce((total, s) => {
    const m = Number(s.duration_min);
    return Number.isFinite(m) && m > 0 ? total + m : total;
  }, 0);
}

/**
 * "1 h 30 min" — como se fala. Abaixo de uma hora, só minutos.
 * Sem `Intl` (o Hermes do mobile não traz os dados de locale).
 */
export function formatarDuracao(minutos: number): string {
  const m = Number.isFinite(minutos) && minutos > 0 ? Math.round(minutos) : 0;
  if (m < 60) return `${numeroBR(m)} min`;
  const horas = Math.floor(m / 60);
  const resto = m % 60;
  const h = `${numeroBR(horas)} h`;
  return resto === 0 ? h : `${h} ${resto} min`;
}

export interface ResumoSemanaAtividade {
  /** Total de minutos registrados na janela. */
  minutos: number;
  /** Quantos registros entraram na conta. */
  registros: number;
  /** "120 minutos registrados nesta semana" — descreve o DIÁRIO, não a pessoa. */
  texto: string;
  /** "2 atividades registradas" — idem. */
  textoRegistros: string;
}

/**
 * O resumo da semana.
 *
 * A REDAÇÃO É A PARTE IMPORTANTE, de novo. "120 minutos registrados nesta
 * semana" fala do que está anotado; "faltam 30 minutos para os 150 da OMS"
 * falaria da pessoa — e transformaria uma referência de saúde pública numa
 * cobrança que o app não tem autoridade para fazer. Por isso esta função não
 * devolve fração, porcentagem, "restante", nem qualquer campo que uma barra de
 * progresso pudesse consumir para "encher".
 *
 * Zero registro devolve texto no plural mesmo assim ("0 minutos registrados"),
 * porque o número zero é um fato — e não um fracasso a ser suavizado.
 */
export function resumoSemanaAtividade(
  sessoes: readonly SessaoParaSoma[],
): ResumoSemanaAtividade {
  const minutos = somaMinutos(sessoes);
  const registros = sessoes.length;
  return {
    minutos,
    registros,
    texto: `${numeroBR(minutos)} ${minutos === 1 ? 'minuto registrado' : 'minutos registrados'} nesta semana`,
    textoRegistros: `${numeroBR(registros)} ${registros === 1 ? 'atividade registrada' : 'atividades registradas'}`,
  };
}
