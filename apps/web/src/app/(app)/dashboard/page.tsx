'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PAINEL — visão geral
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Primeira tela reescrita sobre a fundação (docs/DESIGN.md). Ela não inventa
 * vocabulário: cartão, chip, botão, estado vazio e cabeçalho vêm todos de
 * `@/components/ui/painel`. Se você precisou de um hex, um `fontSize` ou um raio
 * AQUI, a peça está faltando na fundação — abra lá, não aqui.
 *
 * QUATRO COISAS QUE ESTA TELA PROTEGE (e que um redesenho desfaz sem querer):
 *
 * 1. NÃO AFIRMAR O QUE NÃO SE SABE. Quem decide se a tela pode dizer "nenhuma
 *    alergia registrada" é `estadoSecao`/`estadoAgregado`, não `isLoading`. As
 *    duas flags do React Query são `false` juntas enquanto `patientId` está
 *    vazio (`enabled: false`), e foi assim que a tela já afirmou ausência de
 *    alergia sobre um paciente que ainda não tinha sido identificado. Falha de
 *    carregamento vira `ErrorState` com "tentar de novo" — nunca "não há nada".
 *    Do mesmo lado da regra: o cartão de Alergias tem TRÊS estados, não dois —
 *    substância cadastrada, "Sem alergia conhecida" (o paciente DECLAROU, coluna
 *    `profiles.sem_alergia_conhecida_em`) e "Nenhuma registrada" (ninguém
 *    preencheu). Não os junte de novo: são fatos clínicos diferentes.
 *
 * 2. A DICA SEGUE O ESTADO. O mockup trazia "Nenhuma registrada" com "Informado
 *    por você" logo embaixo. Se não há registro, ninguém informou: quando o
 *    cartão está vazio a dica vira um caminho ("Você pode informar no perfil"),
 *    e nunca uma atribuição de autoria.
 *
 * 3. O DESTAQUE É DO DADO QUE EXISTE. Cartão com mais de uma medida (peso e
 *    altura) nunca põe "Não informado" no lugar grande enquanto houver algo
 *    preenchido: mostra o que existe e usa a dica para pedir o que falta.
 *    "Não informado" no destaque é só para o cartão inteiramente vazio.
 *
 * 4. COR NUNCA NO CORPO DO PACIENTE. A faixa da pressão sai em PALAVRAS
 *    (`leituraDaFaixa`) + seta neutra (`Trend`); os chips dos cartões são de
 *    CATEGORIA e a paleta não tem verde, âmbar nem vermelho para escolher. O
 *    humor usa `<MoodScale>`/`<MoodMark>`: forma + rótulo, um matiz só. Âmbar e
 *    vermelho aparecem apenas em status de AGENDA (`SystemStatusChip`), que é
 *    domínio do sistema. Trava: `packages/core/src/utils/regra-cor-clinica.test.ts`.
 *
 * A FILEIRA DO TOPO NÃO CORTA MAIS TEXTO — e esta nota existe para impedir que
 * alguém volte a encurtar string por um motivo que já não existe.
 *
 * A fileira é medida pela COLUNA, não por breakpoint: `<StatRow>` perdeu o
 * `xl:grid-cols-5` e hoje é `auto-fit` + `minmax(min(15rem, 100%), 1fr)` — a
 * regra deixou de ser "cinco cartões sempre" e passou a ser "nenhuma coluna
 * abaixo de 15rem" (~240px, ~312px no Modo Sênior, porque a medida é rem e
 * acompanha a letra). Em tela larga voltam os cinco cartões do mockup; em
 * 1280px a fileira cai sozinha para três em vez de espremer cinco.
 *
 * E `<StatCard layout="compact">` não tem `truncate` em texto NENHUM — rótulo,
 * valor e dica quebram linha (`leading-tight` + `overflow-wrap: anywhere`) e o
 * cartão cresce, porque ele é `min-h-28`. Está escrito assim, com o motivo, no
 * cabeçalho de `components/ui/painel/primitives.tsx` (item C) e ao lado do
 * próprio JSX: subir a letra mantendo reticências seria trocar "pequeno demais
 * para ler" por "cortado antes de terminar". Ou seja: o que passa da largura
 * QUEBRA A LINHA, não é cortado. Não conte caracteres aqui.
 *
 * O que SOBREVIVE do orçamento antigo é a regra de VERACIDADE, que nunca foi
 * sobre caber: "Nenhuma registrada" não vira "Nenhuma", e "marcada como grave"
 * não vira "grave" — encurtar até apagar quem afirmou o quê troca um problema
 * visível (linha mais alta) por um erro invisível (afirmação que mudou de
 * sentido). Preferir o dado que existe ("2 resolvidas") a uma oração inteira
 * sobre a ausência continua valendo como ESCRITA CLARA, não como corte.
 *
 * Datas e horas são formatadas pelos utilitários PT-BR do `@hubpatients/core`,
 * sem `Intl` — o mobile roda em Hermes, e paridade também é ter um formatador só.
 */

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Droplets,
  FileHeart,
  FlaskConical,
  HeartPulse,
  History,
  Hospital,
  NotebookPen,
  Pill,
  QrCode,
  Scale,
  Send,
  Share2,
  ShieldCheck,
  Smile,
  Stethoscope,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  useAllergies,
  useAppointments,
  useClinicalTimeline,
  useConditions,
  useCreateDiaryEntry,
  useDashboard,
  useDiaryEntries,
  useDiarySummary,
  useNextAppointment,
  useProfile,
  useRegisterIntake,
  useVitals,
  useVitalsRange,
} from '@hubpatients/supabase';
import {
  APPOINTMENT_KIND_LABELS,
  CONDITION_STATUS_LABELS,
  DIAS_SEMANA_PT,
  DISCLAIMERS,
  MEDICATION_FORM_LABELS,
  MEDICATION_FREQUENCY_LABELS,
  classifyBloodPressure,
  computeBMI,
  dataDoDia,
  dataPorExtenso,
  diaEMes,
  diaLocal,
  estadoAgregado,
  estadoSecao,
  formatVital,
} from '@hubpatients/core';
import { useActiveProfile } from '@/components/profile-context';
import { ConstancyCard } from '@/components/dashboard/constancy-card';
import { WaterCard } from '@/components/dashboard/water-card';
import { TrendChip } from '@/components/dashboard/trend-chip';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/error-state';
import { SystemStatusChip, Trend } from '@/components/dashboard/metric-cards';
import { leituraDaFaixa } from '@/components/dashboard/clinical-range-chip';
import {
  IlustracaoAgenda,
  IlustracaoDiario,
  IlustracaoRemedio,
} from '@/components/dashboard/empty-illustrations';
import {
  EmptyState,
  IconChip,
  MoodFace,
  MoodMark,
  MoodScale,
  PageHeader,
  PanelButton,
  PanelCard,
  QuickActions,
  Seal,
  SectionHeader,
  StatCard,
  StatRow,
  type QuickAction,
} from '@/components/ui/painel';
import { toast } from 'sonner';

const BloodPressureChart = dynamic(
  () => import('@/components/dashboard/bp-chart').then((module) => module.BloodPressureChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-60 animate-pulse rounded-card bg-surface-2" role="status">
        <span className="sr-only">Carregando gráfico de pressão arterial</span>
      </div>
    ),
  },
);

const TIMELINE_ICONS = {
  appointment: CalendarDays,
  exam: FlaskConical,
  surgery: Hospital,
} satisfies Partial<Record<string, LucideIcon>>;

const TIMELINE_STATUS: Record<string, string> = {
  scheduled: 'Agendada',
  completed: 'Concluído',
  cancelled: 'Cancelada',
  processed: 'Concluído',
  processing: 'Em análise',
  error: 'Requer atenção',
  active: 'Ativo',
  resolved: 'Resolvido',
};

const ACOES_RAPIDAS: QuickAction[] = [
  { label: 'Anotar no diário', icon: NotebookPen, href: '/diario/novo', tone: 'azul' },
  { label: 'Registrar dor', icon: Activity, href: '/diario/dor', tone: 'ardosia' },
  { label: 'Adicionar exame', icon: FlaskConical, href: '/exames', tone: 'violeta' },
  { label: 'Mostrar ao médico', icon: QrCode, href: '/compartilhar', tone: 'turquesa' },
];

/* ── Formatação PT-BR, sem `Intl` (paridade com o mobile) ────────────────── */

/** "5 de agosto" a partir de um instante ISO, no fuso de quem está lendo. */
function dataCurta(iso: string): string {
  return diaEMes(diaLocal(new Date(iso)));
}

/** "14:30". Concatenação, porque `toLocaleTimeString` é `Intl` por baixo. */
function horaLocal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Número com vírgula decimal. "78.4" no banco é "78,4" na tela. */
function numeroBR(valor: number, casas = 1): string {
  return valor.toFixed(casas).replace('.', ',');
}

/**
 * "12 de agosto de 2026" a partir do instante gravado no banco — COM o ano, ao
 * contrário de `dataCurta`. Uma declaração de ausência de alergia envelhece:
 * quem lê decide pela data se vale perguntar de novo, e "12 de agosto" sem ano
 * pode ser de anteontem ou de três anos atrás. Data ilegível devolve string
 * vazia e a tela fala da declaração SEM data — nunca com uma data inventada.
 * Mesma regra e mesmo formato da seção de Alergias do Perfil.
 */
function dataDaDeclaracao(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return dataPorExtenso(diaLocal(d));
}

export default function DashboardPage() {
  const { patientId, ownId, active, isViewingDependent, isPatientKnown } = useActiveProfile();
  const profileQuery = useProfile(patientId || undefined);
  const dashboardQuery = useDashboard(patientId || undefined);
  const bpQuery = useVitalsRange(patientId || undefined, 'blood_pressure', 30);
  const weightQuery = useVitals(patientId || undefined, 'weight');
  const appointmentQuery = useNextAppointment(patientId || undefined);
  const appointmentsQuery = useAppointments(patientId || undefined);
  const wellbeingQuery = useDiarySummary(patientId || undefined);
  const diaryQuery = useDiaryEntries(patientId || undefined);
  const allergiesQuery = useAllergies(patientId || undefined);
  const conditionsQuery = useConditions(patientId || undefined);
  const timelineQuery = useClinicalTimeline(patientId || undefined, 12);
  const registerIntake = useRegisterIntake(patientId);
  const criarEntradaDiario = useCreateDiaryEntry(patientId);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [humorDeHoje, setHumorDeHoje] = useState<number | null>(null);

  const dashboardQueries = [
    profileQuery,
    dashboardQuery,
    bpQuery,
    weightQuery,
    appointmentQuery,
    appointmentsQuery,
    wellbeingQuery,
    diaryQuery,
    allergiesQuery,
    conditionsQuery,
    timelineQuery,
  ];
  /*
   * Este painel escreve "Nenhuma registrada" em Alergias e em Condições de
   * saúde. Antes ele decidia isso com `isLoading`/`isError`, e as duas flags
   * são `false` ao mesmo tempo enquanto `patientId` está vazio (consulta
   * `enabled: false` no React Query v5) — ou seja, as duas travas eram
   * contornadas juntas, em TODO carregamento do painel, e a tela afirmava
   * ausência de alergia sobre um paciente que ainda não tinha sido
   * identificado. Quem decide agora é `estadoSecao`, que trata "não sei de
   * quem é" como estado próprio. Regra e testes em
   * `packages/core/src/utils/estado-secao.ts`.
   */
  const estado = estadoAgregado(
    dashboardQueries.map((query) =>
      estadoSecao({
        sujeitoConhecido: isPatientKnown,
        isSuccess: query.isSuccess,
        isError: query.isError,
      }),
    ),
  );

  if (estado === 'sujeito-indefinido' || estado === 'carregando') {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center"
        role="status"
        aria-label="Carregando o resumo de saúde"
      >
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (estado === 'falhou') {
    return (
      <ErrorState
        message="Não foi possível carregar todo o seu resumo. Nenhuma ausência de informação será tratada como resultado normal."
        onRetry={() => {
          void Promise.all(dashboardQueries.map((query) => query.refetch()));
        }}
        className="min-h-[50vh]"
      />
    );
  }

  const hoje = diaLocal();
  const dataDeHoje = dataDoDia(hoje);
  const diaDaSemana = dataDeHoje ? DIAS_SEMANA_PT[dataDeHoje.getDay()] ?? '' : '';
  const dataPorExtenso = diaDaSemana
    ? `${diaDaSemana.charAt(0).toUpperCase()}${diaDaSemana.slice(1)}, ${diaEMes(hoje)}`
    : diaEMes(hoje);

  const profile = profileQuery.data;
  const data = dashboardQuery.data;
  const bp = data?.latestBloodPressure ?? null;
  const meds = data?.activeMedications ?? [];
  const upcoming = data?.upcomingIntakes ?? [];
  const allergies = allergiesQuery.data ?? [];
  const condicoes = conditionsQuery.data ?? [];
  /*
   * "Em acompanhamento" = tudo que não foi dado por resolvido: `active`,
   * `controlled` e `suspected`. O rótulo do cartão dizia "registros ativos", e
   * chamar uma condição SUSPEITA de ativa é o app afirmando mais do que o
   * paciente escreveu — vocabulário, não cosmética.
   */
  const condicoesEmAcompanhamento = condicoes.filter(
    (condition) => condition.status !== 'resolved',
  );
  const condicoesResolvidas = condicoes.length - condicoesEmAcompanhamento.length;
  const range = bpQuery.data ?? [];
  const nextAppt = appointmentQuery.data;
  const wellbeing = wellbeingQuery.data;
  const entradasDoDiario = diaryQuery.data ?? [];
  const registroDeHoje = entradasDoDiario.find((entrada) => entrada.entry_date === hoje) ?? null;
  const humorRegistrado = humorDeHoje ?? registroDeHoje?.mood ?? null;

  const latestWeight =
    (weightQuery.data ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
      )[0] ?? null;
  const bmi = computeBMI(latestWeight?.value_primary ?? null, profile?.height_cm ?? null);
  const alturaEmMetros = profile?.height_cm ? numeroBR(profile.height_cm / 100, 2) : null;

  /*
   * ── PESO E ALTURA: o destaque é do dado que EXISTE ─────────────────────────
   *
   * O cartão colocava o peso (ou "Não informado") no valor grande e a altura na
   * dica. Quem já tinha cadastrado 1,85 m e ainda não pesara via a tela GRITAR
   * a ausência e SUSSURRAR o dado que ele mesmo digitou — a leitura de quem usa
   * é "o app perdeu minha altura". A ordem passa a ser peso → altura →
   * "Não informado", e a dica assume o papel de dizer o que falta.
   *
   * Isto NÃO afrouxa a regra de veracidade: quem autoriza a tela a falar de
   * ausência continua sendo `estado` (`estadoSecao`/`estadoAgregado`, lá em
   * cima) — enquanto o sujeito é desconhecido ou a consulta falhou, esta parte
   * do arquivo nem chega a rodar. O que muda aqui é só a hierarquia de leitura
   * entre dados JÁ carregados com sucesso.
   *
   * Sem semáforo: peso, altura e IMC são corpo do paciente. O cartão descreve,
   * não classifica (regra de cor clínica).
   */
  const pesoEmTela = latestWeight ? `${numeroBR(latestWeight.value_primary)} kg` : null;
  const alturaEmTela = alturaEmMetros ? `${alturaEmMetros} m` : null;
  const pesoEAlturaValor = pesoEmTela ?? alturaEmTela ?? 'Não informado';
  let pesoEAlturaDica: string;
  if (pesoEmTela && alturaEmTela) {
    pesoEAlturaDica = [alturaEmTela, bmi ? `IMC ${numeroBR(bmi)}` : null]
      .filter(Boolean)
      .join(' · ');
  } else if (pesoEmTela) {
    // O IMC não existe sem altura — a dica diz o que falta e onde se resolve.
    pesoEAlturaDica = 'Informe sua altura no perfil';
  } else if (alturaEmTela) {
    /*
     * Só altura: o número grande é 1,85 m, e sem esta dica o cartão fica
     * ambíguo — "Peso e altura · 1,85 m" pode ser lido como uma medição
     * recente/de hoje. "Altura do perfil ·" resolve as DUAS coisas de uma vez:
     * nomeia a grandeza E diz a procedência (é o cadastro do paciente, não uma
     * aferição). O segundo trecho é o caminho, no imperativo curto que o resto
     * do painel já usa ("Registre peso e altura") — não uma cobrança, e sem
     * "falta"/"pendente", que soam a repreensão.
     * 34 caracteres: é a dica mais longa da fileira, e é assim de propósito —
     * encurtar aqui custaria a procedência, e procedência é regra de veracidade.
     */
    pesoEAlturaDica = 'Altura do perfil · registre o peso';
  } else {
    pesoEAlturaDica = 'Registre peso e altura';
  }

  /*
   * ── CONDIÇÕES DE SAÚDE: mesma leitura ──────────────────────────────────────
   *
   * O cartão só olhava as condições não resolvidas. Quem tivesse registrado só
   * condições já resolvidas lia "Nenhuma registrada" — o app negando um dado
   * que ele próprio guardou. Existe um terceiro estado, e ele obedece à mesma
   * regra do cartão de peso (proteção 3 do cabeçalho): o DESTAQUE é do dado que
   * EXISTE. Quem só tem condições resolvidas vê "2 resolvidas" no lugar grande
   * — o que ele cadastrou — e a ausência desce para a dica.
   *
   * Isto também conserta um corte: "Nenhuma em acompanhamento" tem 25
   * caracteres e o valor do cartão compacto é 17px; a tela mostrava
   * "Nenhuma em ac…", que é pior que silêncio, porque a frase truncada pode ser
   * lida como o começo de qualquer coisa. "2 resolvidas" tem 12 e diz mais.
   */
  const condicoesValor =
    condicoesEmAcompanhamento.length > 0
      ? condicoesEmAcompanhamento
          .slice(0, 2)
          .map((condition) => condition.name)
          .join(', ')
      : condicoesResolvidas > 0
        ? `${condicoesResolvidas} ${condicoesResolvidas === 1 ? 'resolvida' : 'resolvidas'}`
        : 'Nenhuma registrada';
  let condicoesDica: string;
  if (condicoesEmAcompanhamento.length === 1) {
    /*
     * Uma só condição: a dica carrega o status que o PACIENTE escolheu. Só que
     * o rótulo do core vem sozinho e no absoluto — "Ativa", "Controlada",
     * "Suspeita" —, e um adjetivo solto embaixo do nome da doença é o app
     * dizendo em que pé ela está. Quem diz isso é o cadastro; a tela só repete.
     * "Registrada como controlada" devolve a qualificação que "1 registro
     * ativo" carregava antes da troca pelo mapa do core, sem voltar a chamar
     * uma condição SUSPEITA de ativa.
     */
    const rotuloDoStatus = CONDITION_STATUS_LABELS[condicoesEmAcompanhamento[0]!.status];
    condicoesDica = `Registrada como ${rotuloDoStatus.toLowerCase()}`;
  } else if (condicoesEmAcompanhamento.length > 1) {
    // Mesmo motivo: "3 em acompanhamento" afirma um acompanhamento que o app
    // não conhece (ele não sabe se alguém está acompanhando de fato). O que ele
    // sabe é quantos REGISTROS não foram dados por resolvidos.
    condicoesDica = `${condicoesEmAcompanhamento.length} registros em acompanhamento`;
  } else if (condicoesResolvidas > 0) {
    // O valor já diz quantas são resolvidas; a dica fica com a ausência.
    condicoesDica = 'Nenhuma em acompanhamento';
  } else {
    condicoesDica = 'Você pode adicionar no perfil';
  }

  /*
   * ── ALERGIAS: "declarei que não tenho" ≠ "ninguém preencheu" ───────────────
   *
   * O cartão escrevia "Nenhuma registrada" nos DOIS casos — exatamente a
   * ambiguidade que a declaração de ausência (migration 0049) existe para
   * desfazer. Em prontuário são fatos diferentes: um é resposta de quem foi
   * perguntado, o outro é campo em branco. Quem lê o painel antes de uma
   * consulta precisa saber qual dos dois está vendo.
   *
   * A DECLARAÇÃO ENTRA PELA MESMA PORTA (proteção 1 do cabeçalho). Ela é lida
   * de `profileQuery`, que está em `dashboardQueries` e portanto já passou por
   * `estadoSecao`/`estadoAgregado`: este trecho só roda com `estado ===
   * 'confirmada'`, ou seja, com o perfil E as alergias respondidos. Nada de
   * atalho por `isLoading` — se a leitura do perfil falhar, a tela inteira vira
   * `ErrorState` e não afirma nem declaração nem ausência.
   *
   * TOLERA A COLUNA AUSENTE: a 0049 pode não estar aplicada quando este código
   * subir. Aí a chave nem vem no JSON e a leitura é `undefined`, que é
   * indistinguível de "não declarou" — o `?? null` a trata como o estado mais
   * modesto dos dois ("ninguém preencheu"), que é o único seguro. Sem `null`
   * explícito, `undefined` cairia no mesmo lugar, mas o `??` é o que deixa a
   * intenção escrita: ignorância nunca vira declaração.
   *
   * A ALERGIA SEMPRE VENCE: com substância na lista, o cartão mostra a
   * substância e a declaração some daqui (o banco a derruba sozinho no trigger
   * da 0049, mas dado velho e cache existem). Exibir as duas juntas seria o
   * pior dos dois mundos — é o mesmo critério da seção de Alergias do Perfil.
   *
   * E POR QUE "Condições de saúde" CONTINUA COM "Nenhuma registrada": lá não
   * existe terceiro estado a perder. Só há declaração de ausência para alergia
   * (a 0049 criou uma coluna, não um conceito geral), e escrever "ninguém
   * preencheu" num cartão sem esse caminho seria o app falando de si mesmo como
   * se oferecesse algo que não oferece. Quando/se nascer a declaração de
   * "nenhuma condição", o critério a repetir é este, não outro.
   */
  const declaradoSemAlergiaEm = profile?.sem_alergia_conhecida_em ?? null;
  const declarouSemAlergia = allergies.length === 0 && declaradoSemAlergiaEm != null;
  const dataDaDeclaracaoSemAlergia = declaradoSemAlergiaEm
    ? dataDaDeclaracao(declaradoSemAlergiaEm)
    : '';
  /*
   * A dica de ALERGIA, caso a caso:
   *
   * · DECLAROU — a dica vira PROCEDÊNCIA, como no tipo sanguíneo: sem ela,
   *   "Sem alergia conhecida" no destaque pareceria conclusão do app, e não a
   *   resposta que a pessoa deu. Com a data, porque declaração de prontuário
   *   sem data é anotação solta (é o motivo de a 0049 gravar `timestamptz` em
   *   vez de um booleano).
   * · NINGUÉM PREENCHEU — a dica diz isso com todas as letras e oferece o
   *   caminho (proteção 2: cartão vazio ganha caminho, nunca autoria). "no
   *   perfil" fica de fora porque o cartão inteiro já é o link para lá.
   * · TEM ALERGIA — a qualificação que precisa sobreviver ao corte: "Contém
   *   alergia marcada como grave" tem 33 caracteres e virava "Contém alergia
   *   ma…" na dica compacta. A parte que NÃO pode cair é o "marcada como": quem
   *   marcou a alergia como grave foi quem cadastrou, e sem essa qualificação a
   *   frase passa a ser o app afirmando gravidade. Contar no lugar de descrever
   *   devolve a frase a ~20 caracteres com o "marcada como" intacto — e ainda
   *   diz quantas são.
   */
  const alergiasGraves = allergies.filter((allergy) => allergy.severity === 'severe').length;
  let alergiasDica: string;
  if (declarouSemAlergia) {
    alergiasDica = dataDaDeclaracaoSemAlergia
      ? `Declarado em ${dataDaDeclaracaoSemAlergia}`
      : 'Declarado no perfil';
  } else if (allergies.length === 0) {
    alergiasDica = 'Ninguém preencheu ainda · você pode informar';
  } else if (alergiasGraves > 0) {
    alergiasDica =
      alergiasGraves === 1
        ? '1 marcada como grave'
        : `${alergiasGraves} marcadas como graves`;
  } else {
    alergiasDica = `${allergies.length} ${allergies.length === 1 ? 'registrada' : 'registradas'}`;
  }

  const timelineEvents = (timelineQuery.data?.pages ?? [])
    .flatMap((page) => page.events)
    .filter((event) => ['appointment', 'exam', 'surgery'].includes(event.eventType))
    .slice(0, 3);
  const previousAppointments = (appointmentsQuery.data ?? [])
    .filter((appointment) => appointment.status === 'completed')
    .slice(-2)
    .reverse();

  const bpStatus =
    bp && bp.value_secondary != null
      ? classifyBloodPressure(bp.value_primary, bp.value_secondary)
      : null;
  const trend: 'up' | 'down' | 'flat' = (() => {
    if (range.length < 2) return 'flat';
    const previous = range[range.length - 2]!.value_primary;
    const current = range[range.length - 1]!.value_primary;
    return current > previous ? 'up' : current < previous ? 'down' : 'flat';
  })();

  const temTipoSanguineo = Boolean(profile?.blood_type && profile.blood_type !== 'unknown');
  const primeiroNome = (profile?.full_name ?? active.name).trim().split(' ')[0] || 'você';
  const saudacao = isViewingDependent
    ? `Prontuário de ${primeiroNome}`
    : `Olá, ${primeiroNome}! 👋`;

  async function handleRegisterPending(intake: (typeof upcoming)[number]) {
    if (registeringId) return;
    setRegisteringId(intake.id);
    try {
      await registerIntake.mutateAsync({
        patient_id: patientId,
        medication_id: intake.medication_id,
        schedule_id: intake.schedule_id,
        scheduled_for: intake.scheduled_for,
        status: 'taken',
        taken_at: new Date().toISOString(),
      });
      toast.success('Tomada registrada.');
    } catch {
      toast.error('Não foi possível registrar.');
    } finally {
      setRegisteringId(null);
    }
  }

  /**
   * Registra o humor de hoje. Só aparece quando NÃO existe entrada para o dia:
   * a tabela aceita várias por data, e um segundo toque criaria um registro
   * duplicado que depois puxaria a média da semana. Para corrigir, o caminho é
   * o diário, onde a entrada inteira pode ser editada.
   */
  async function registrarHumor(valor: number) {
    if (criarEntradaDiario.isPending) return;
    setHumorDeHoje(valor);
    try {
      await criarEntradaDiario.mutateAsync({
        patient_id: patientId,
        entry_date: hoje,
        mood: valor,
      });
      toast.success('Registrado. Obrigado por contar como você está.');
    } catch {
      setHumorDeHoje(null);
      toast.error('Não foi possível registrar agora.');
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow={dataPorExtenso}
        title={saudacao}
        subtitle="Aqui está seu resumo de saúde, organizado para uma leitura rápida."
        right={
          /* O selo é informação FIXA — não muda de cor, não alerta. Continua
             clicável porque era um atalho real para o painel de permissões, e
             tirar o caminho seria uma regressão silenciosa. */
          <Link
            href="/consentimento"
            aria-label="Dados protegidos • LGPD — ver e ajustar suas permissões"
            className="inline-flex min-h-11 items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Seal icon={ShieldCheck}>Dados protegidos • LGPD</Seal>
          </Link>
        }
      />

      <StatRow>
        <StatCard
          layout="compact"
          icon={HeartPulse}
          tone="azul"
          label="Pressão arterial"
          href="/analise"
          clinical={Boolean(bp)}
          value={
            bp ? (
              <span className="inline-flex items-center gap-2">
                {formatVital(bp)}
                <Trend direction={trend} />
              </span>
            ) : (
              'Sem registro'
            )
          }
          /* Faixa de referência em PALAVRAS. Nada de semáforo: o app exibe e
             organiza, quem interpreta é o médico. A frase da faixa é longa de
             propósito e NÃO é encurtada aqui: ela é escrita uma vez só, em
             `clinical-range-chip.tsx`, para a tela e o leitor de tela nunca
             divergirem sobre a mesma medida.
             Já a dica do cartão vazio era "Você pode registrar em Indicadores"
             (34 caracteres). O cartão inteiro é um link para /analise, com
             chevron — o destino já está dito pelo próprio cartão, e repeti-lo
             custava metade da linha. */
          hint={bpStatus ? leituraDaFaixa(bpStatus.zone) : 'Você pode registrar'}
        />

        <StatCard
          layout="compact"
          icon={Scale}
          tone="turquesa"
          label="Peso e altura"
          href="/composicao-corporal"
          /* `hp-num` (Atkinson Mono, tabular) vale para peso E para altura:
             os dois são medida do corpo. Só "Não informado" não é número. */
          clinical={Boolean(pesoEmTela || alturaEmTela)}
          value={pesoEAlturaValor}
          hint={pesoEAlturaDica}
        />

        <StatCard
          layout="compact"
          icon={Droplets}
          tone="ameixa"
          label="Tipo sanguíneo"
          href="/perfil"
          /* `hp-num` é o que separa O de 0 e 1 de l — num tipo sanguíneo essa
             ambiguidade é risco de transfusão, não detalhe tipográfico. */
          clinical={temTipoSanguineo}
          /* Aqui não existe o problema de hierarquia do cartão de peso: o
             cartão carrega UM dado só, então "Não informado" no destaque nunca
             está encobrindo algo que o paciente digitou. A queixa de
             "caracteres discretos" neste cartão era de TAMANHO, e o tamanho
             mora na primitiva `StatCard` (layout `compact`), não aqui: lá o
             rótulo já subiu para 15px/`fg-soft` e o valor para 17px. Se voltar
             a parecer pequeno, o conserto é na primitiva — nunca um tamanho
             literal nesta tela, que mataria o Modo Sênior. */
          value={temTipoSanguineo ? profile?.blood_type : 'Não informado'}
          /* A dica segue o ESTADO: sem registro, ninguém "informou" nada. E com
             registro ela diz a PROCEDÊNCIA — o app não pode deixar um tipo
             sanguíneo de autorrelato passar por resultado de exame. */
          hint={temTipoSanguineo ? 'Informado por você' : 'Você pode informar no perfil'}
        />

        <StatCard
          layout="compact"
          icon={FileHeart}
          tone="indigo"
          label="Condições de saúde"
          href="/perfil"
          value={condicoesValor}
          /* O nome da condição é o dado; a dica diz em que pé ele está. Sem
             tinta de gravidade: condição de saúde é corpo do paciente. */
          hint={condicoesDica}
        />

        <StatCard
          layout="compact"
          icon={AlertTriangle}
          tone="violeta"
          label="Alergias"
          href="/perfil"
          /* Três destaques possíveis, e a diferença entre os dois últimos é o
             ponto do cartão: a substância cadastrada; "Sem alergia conhecida",
             que é a RESPOSTA de quem foi perguntado; e "Nenhuma registrada",
             que é só o estado do formulário. A frase declarada é a mesma do
             Perfil e a mesma da 0049 — o prontuário não pode chamar o mesmo
             fato por dois nomes conforme a tela. */
          value={
            allergies.length > 0
              ? allergies
                  .slice(0, 2)
                  .map((allergy) => allergy.substance)
                  .join(', ')
              : declarouSemAlergia
                ? 'Sem alergia conhecida'
                : 'Nenhuma registrada'
          }
          hint={alergiasDica}
        />
      </StatRow>

      {/* Corpo em duas colunas ≈2/3 + 1/3 (layout.bodyColumns). */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.82fr)_minmax(380px,1fr)]">
        <div className="space-y-4">
          <PanelCard as="section" className="vl-rise p-5">
            <SectionHeader
              title="Medicamentos de hoje"
              icon={Pill}
              tone="azul"
              href="/medicamentos"
            />
            {meds.length === 0 ? (
              <EmptyState
                className="mt-4"
                layout="horizontal"
                illustration={<IlustracaoRemedio />}
                title="Nenhum medicamento ativo"
                description="Cadastre seus medicamentos para acompanhar horários e tomadas."
                actionLabel="Adicionar medicamento"
                actionHref="/medicamentos"
              />
            ) : (
              <>
                <ul className="mt-2 divide-y divide-line">
                  {meds.slice(0, 4).map((medication, index) => {
                    const intake = upcoming.find(
                      (candidate) => candidate.medication_id === medication.id,
                    );
                    const scheduledTime =
                      horaLocal(intake?.scheduled_for ?? null) ??
                      medication.times[index % Math.max(medication.times.length, 1)] ??
                      null;
                    const busy = intake ? registeringId === intake.id : false;
                    return (
                      <li key={medication.id} className="flex items-center gap-3 py-3">
                        <IconChip icon={Pill} tone="azul" size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-semibold text-fg">
                            {medication.name}
                            {medication.dosage ? ` · ${medication.dosage}` : ''}
                          </p>
                          <p className="mt-0.5 truncate text-caption text-muted">
                            {MEDICATION_FORM_LABELS[medication.form]} ·{' '}
                            {MEDICATION_FREQUENCY_LABELS[medication.frequency]}
                          </p>
                        </div>
                        {intake ? (
                          <PanelButton
                            className="shrink-0"
                            size="sm"
                            icon={Check}
                            onClick={() => void handleRegisterPending(intake)}
                            disabled={busy || registeringId !== null}
                            aria-label={`Registrar tomada de ${medication.name}${
                              scheduledTime ? ` das ${scheduledTime}` : ''
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className="hidden sm:inline">
                                {busy ? 'Registrando…' : 'Registrar'}
                              </span>
                              {scheduledTime ? (
                                <span className="hp-num">{scheduledTime}</span>
                              ) : null}
                            </span>
                          </PanelButton>
                        ) : (
                          <span className="hp-num shrink-0 rounded-full bg-surface-3 px-3 py-1.5 text-caption font-semibold text-muted">
                            {scheduledTime ?? 'Sem horário'}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <PanelButton
                  className="mt-4 w-full"
                  variant="secondary"
                  size="sm"
                  href="/medicamentos"
                >
                  Adicionar ou atualizar medicamento
                </PanelButton>
              </>
            )}
          </PanelCard>

          <PanelCard as="section" className="vl-rise p-5">
            <SectionHeader
              title="Consultas, exames e procedimentos"
              icon={CalendarDays}
              tone="indigo"
              href="/linha-do-tempo"
              actionLabel="Linha do tempo"
            />
            {timelineEvents.length === 0 && !nextAppt && previousAppointments.length === 0 ? (
              <EmptyState
                className="mt-4"
                layout="horizontal"
                illustration={<IlustracaoAgenda />}
                title="Sua linha do tempo começa aqui"
                description="Registre consultas, exames e procedimentos para encontrá-los em ordem cronológica."
                actionLabel="Registrar evento"
                actionHref="/consultas"
              />
            ) : (
              <>
                <ul className="mt-2 divide-y divide-line">
                  {nextAppt ? (
                    <TimelineRow
                      icon={CalendarDays}
                      title={`${nextAppt.specialty ?? 'Consulta'} · ${nextAppt.doctor_name}`}
                      description={`${dataCurta(nextAppt.scheduled_at)}${
                        horaLocal(nextAppt.scheduled_at) ? `, ${horaLocal(nextAppt.scheduled_at)}` : ''
                      } · ${APPOINTMENT_KIND_LABELS[nextAppt.kind]}`}
                      status="Próxima"
                      tone="attention"
                    />
                  ) : null}
                  {timelineEvents
                    .filter(
                      (event) =>
                        !nextAppt ||
                        event.eventId !== nextAppt.id ||
                        event.eventType !== 'appointment',
                    )
                    .slice(0, nextAppt ? 2 : 3)
                    .map((event) => (
                      <TimelineRow
                        key={event.eventKey}
                        icon={
                          TIMELINE_ICONS[event.eventType as keyof typeof TIMELINE_ICONS] ?? History
                        }
                        title={event.title}
                        description={`${dataCurta(event.occurredAt)}${
                          !event.dateOnly && horaLocal(event.occurredAt)
                            ? `, ${horaLocal(event.occurredAt)}`
                            : ''
                        }${event.summary ? ` · ${event.summary}` : ''}`}
                        status={
                          event.status ? TIMELINE_STATUS[event.status] ?? event.status : 'Registrado'
                        }
                        tone={event.status === 'error' ? 'alert' : 'ok'}
                      />
                    ))}
                  {timelineEvents.length === 0
                    ? previousAppointments.slice(0, nextAppt ? 2 : 3).map((appointment) => (
                        <TimelineRow
                          key={appointment.id}
                          icon={Stethoscope}
                          title={`${appointment.specialty ?? 'Consulta'} · ${appointment.doctor_name}`}
                          description={`${dataCurta(appointment.scheduled_at)} · ${APPOINTMENT_KIND_LABELS[appointment.kind]}`}
                          status="Realizada"
                          tone="ok"
                        />
                      ))
                    : null}
                </ul>
                <PanelButton className="mt-4 w-full" variant="secondary" size="sm" href="/consultas">
                  Agendar ou registrar consulta
                </PanelButton>
              </>
            )}
          </PanelCard>

          <QuickActions
            actions={[
              { label: 'Adicionar medicamento', icon: Pill, href: '/medicamentos', tone: 'azul' },
              { label: 'Registrar exame', icon: FlaskConical, href: '/exames', tone: 'turquesa' },
              { label: 'Agendar consulta', icon: CalendarDays, href: '/consultas', tone: 'indigo' },
              { label: 'Novo diário clínico', icon: NotebookPen, href: '/diario/novo', tone: 'violeta' },
            ]}
            variant="floating"
            className="sticky bottom-4 z-20 mx-auto -mt-10 hidden w-fit max-w-full xl:block"
          />
        </div>

        <div className="space-y-4">
          <PanelCard as="section" className="vl-rise p-5">
            <SectionHeader title="Compartilhar dados" icon={Share2} tone="violeta" />
            <p className="mt-3 text-body-sm leading-relaxed text-muted">
              Você escolhe o que compartilhar, com quem e por quanto tempo.
            </p>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2">
              <li>
                <ShareOption
                  icon={Stethoscope}
                  title="Profissional de saúde"
                  description="Resumo para uma consulta"
                />
              </li>
              <li>
                <ShareOption
                  icon={Building2}
                  title="Hospital ou laboratório"
                  description="Acesso temporário"
                />
              </li>
            </ul>
            <PanelButton
              className="mt-4 w-full border-primary text-primary"
              variant="secondary"
              icon={Send}
              href="/compartilhar"
            >
              Criar compartilhamento seguro
            </PanelButton>
          </PanelCard>

          <PanelCard as="section" className="vl-rise p-5">
            <SectionHeader
              title="Bem-estar · 7 dias"
              icon={Smile}
              tone="turquesa"
              href="/analise"
              actionLabel="Ver indicadores"
            />

            {/*
              Humor e energia são AUTORRELATO. Sem semáforo, sem carinha
              vermelha: a escala e o marcador vêm da fundação, num matiz só,
              com a ordem na FORMA e no RÓTULO (DESIGN.md §5).
            */}
            {wellbeing?.wellbeing != null ? (
              <WellbeingSummary
                score={wellbeing.wellbeing}
                mood={wellbeing.mood}
                energy={wellbeing.energy}
              />
            ) : (
              <EmptyState
                className="mt-4 py-8"
                illustration={<IlustracaoDiario className="h-20 w-auto" />}
                title="Sem registros nesta semana"
                description="Contar como você está leva alguns segundos — e é o que faz esta média existir."
              />
            )}

            <div className="mt-4 border-t border-line pt-4">
              {registroDeHoje || humorRegistrado != null ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 text-body-sm text-fg-soft">
                    Hoje você registrou{' '}
                    {humorRegistrado != null ? (
                      <MoodMark value={humorRegistrado} className="align-middle" />
                    ) : (
                      'seu diário'
                    )}
                  </p>
                  <Link
                    href="/diario"
                    className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-caption font-semibold text-primary hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Abrir diário
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              ) : (
                <MoodScale
                  variant="compact"
                  name="humor-de-hoje"
                  value={humorRegistrado}
                  onChange={(valor) => void registrarHumor(valor)}
                  disabled={criarEntradaDiario.isPending}
                />
              )}
            </div>
          </PanelCard>
        </div>
      </div>

      {/* ── Acompanhamento ─────────────────────────────────────────────── */}
      <section aria-labelledby="acompanhamento-titulo" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption font-semibold uppercase tracking-wider text-primary">
              Acompanhamento
            </p>
            <h2 id="acompanhamento-titulo" className="mt-1 font-display text-title text-fg">
              Seus hábitos e indicadores
            </h2>
          </div>
          <PanelButton href="/analise" variant="quiet" size="sm">
            Ver indicadores
          </PanelButton>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className={isViewingDependent ? 'lg:col-span-3' : 'lg:col-span-2'}>
            <ConstancyCard patientId={patientId || undefined} />
          </div>
          {!isViewingDependent ? (
            <WaterCard patientId={ownId} dateOfBirth={profile?.date_of_birth} />
          ) : null}
        </div>

        <PanelCard as="section" className="p-5">
          <SectionHeader
            title="Pressão arterial · 30 dias"
            icon={HeartPulse}
            tone="azul"
            action={
              <TrendChip values={range.map((vital) => vital.value_primary)} label="Sistólica" />
            }
          />
          <p className="mt-1 text-caption text-hint">Histórico informado por você</p>
          <div className="mt-4">
            <BloodPressureChart vitals={range} />
          </div>
          <p className="mt-3 text-caption leading-relaxed text-muted">
            {DISCLAIMERS.examInterpretation}
          </p>
        </PanelCard>
      </section>

      <QuickActions actions={ACOES_RAPIDAS} className="xl:hidden" />
    </div>
  );
}

/* ══════════════════════════════ Peças locais ══════════════════════════════ */

function WellbeingSummary({
  score,
  mood,
  energy,
}: {
  score: number;
  mood: number | null;
  energy: number | null;
}) {
  const percentual = Math.max(0, Math.min(100, (score / 5) * 100));
  const humor = Math.max(1, Math.min(5, Math.round(mood ?? score)));

  return (
    <div className="mt-3 grid grid-cols-[108px_1fr] items-center gap-4">
      <div
        className="grid h-24 w-24 place-items-center rounded-full p-2"
        style={{
          background: `conic-gradient(var(--chip-turquesa-ink) ${percentual}%, var(--surface-3) ${percentual}% 100%)`,
        }}
        aria-label={`${numeroBR(score)} de 5`}
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-surface text-primary shadow-inner">
          <MoodFace value={humor} className="h-11 w-11" strokeWidth={2} />
        </div>
      </div>

      <div className="min-w-0">
        <p className="hp-num text-[2.25rem] font-semibold leading-none text-fg">
          {numeroBR(score)}
          <span className="ml-1 text-body-sm font-normal text-muted">/ 5</span>
        </p>
        <p className="mt-2 text-caption text-muted">
          Humor {mood != null ? numeroBR(mood) : '—'} · energia {energy != null ? numeroBR(energy) : '—'}
        </p>
        <svg
          viewBox="0 0 250 52"
          className="mt-2 h-12 w-full text-chip-turquesa-ink"
          fill="none"
          role="img"
          aria-label="Tendência de bem-estar nos últimos sete dias"
        >
          <path
            d="M8 37 C30 34 36 27 60 27 S88 17 111 22 S139 40 164 31 S195 19 242 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {[8, 52, 96, 140, 184, 242].map((x, index) => (
            <circle key={x} cx={x} cy={[37, 28, 21, 35, 27, 15][index]} r="3" fill="currentColor" />
          ))}
        </svg>
      </div>
    </div>
  );
}

function TimelineRow({
  icon: Icon,
  title,
  description,
  status,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  status: string;
  /* Status de AGENDA/SISTEMA ("Próxima", "Realizada", falha de importação) —
     é o domínio em que âmbar/vermelho são permitidos. Nunca dado do corpo. */
  tone: 'ok' | 'attention' | 'alert';
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <IconChip icon={Icon} seed={title} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-sm font-semibold text-fg">{title}</p>
        <p className="mt-0.5 truncate text-caption text-muted">{description}</p>
      </div>
      <span className="shrink-0">
        <SystemStatusChip tone={tone} label={status} />
      </span>
    </li>
  );
}

function ShareOption({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
}) {
  return (
    <Link
      href="/compartilhar"
      className="group flex min-h-11 items-center gap-3 rounded-card border border-line bg-surface-2 px-3 py-3 transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <IconChip icon={icon} seed={title} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block truncate text-caption text-muted">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-hint" aria-hidden />
    </Link>
  );
}
