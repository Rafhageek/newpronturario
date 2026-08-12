'use client';

import {
  Activity,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  NotebookPen,
  Pill,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from 'lucide-react';
import {
  ALLERGY_SEVERITY,
  APPOINTMENT_KIND_LABELS,
  APPOINTMENT_STATUS_LABELS,
  CONDITION_STATUS_LABELS,
  EXAM_CATEGORY_LABELS,
  INTAKE_STATUS_LABELS,
  MEDICATION_FREQUENCY_LABELS,
  dataPorExtenso,
  diaLocal,
  estadoSecao,
  horaLocal,
} from '@hubpatients/core';
import {
  useClinicalTimeline,
  type ClinicalTimelineEvent,
  type ClinicalTimelineEventType,
} from '@hubpatients/supabase';
import { useActiveProfile } from '@/components/profile-context';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/painel';

const EVENT_PRESENTATION: Record<
  ClinicalTimelineEventType,
  { label: string; icon: LucideIcon }
> = {
  vital: { label: 'Sinal vital', icon: Activity },
  diary: { label: 'Diário clínico', icon: NotebookPen },
  exam: { label: 'Exame', icon: FlaskConical },
  medication: { label: 'Medicamento', icon: Pill },
  medication_intake: { label: 'Tomada registrada', icon: Pill },
  appointment: { label: 'Consulta', icon: CalendarDays },
  condition: { label: 'Condição registrada', icon: ClipboardList },
  allergy: { label: 'Alergia registrada', icon: ShieldAlert },
  surgery: { label: 'Procedimento', icon: Stethoscope },
  vaccination: { label: 'Vacinação', icon: Syringe },
};

/* ══════════════════════════ Rótulos: nada de enum cru na tela ══════════════════════════
 *
 * A RPC `clinical_timeline` (migration 0034) devolve `status` e monta `summary`
 * com os enums do banco em INGLÊS e sem tradução — o cliente viu na tela
 * "5 · mg · daily" no lugar de "5 · mg · Diariamente". Enum cru num prontuário
 * não é só feio: quem lê não sabe se "daily" é o nome do remédio, a via ou a
 * frequência, e este app é 100% PT-BR para um público 50+.
 *
 * A tradução acontece AQUI, na exibição, e reaproveita os rótulos que já são a
 * fonte da verdade do produto em `@hubpatients/core` — nenhum texto novo foi
 * inventado, e nenhuma linha do banco é reescrita.
 */

/** Separador com que o `concat_ws` da RPC junta os pedaços do resumo. */
const SEPARADOR_RESUMO = ' · ';

/**
 * Só a gravidade da alergia POR EXTENSO. O `tone` que vem junto no core é
 * semáforo (attention/alert) e não entra nesta tela: a linha do tempo é leitura
 * factual do corpo do paciente, e cor de semáforo em dado do corpo é
 * diagnóstico disfarçado — a regra de cor clínica do produto.
 */
const ROTULOS_GRAVIDADE_ALERGIA: Readonly<Record<string, string>> = {
  mild: ALLERGY_SEVERITY.mild.label,
  moderate: ALLERGY_SEVERITY.moderate.label,
  severe: ALLERGY_SEVERITY.severe.label,
};

/** Rótulos de `status`, por tipo de evento — "active" é "Ativo" no remédio e
 *  "Ativa" na condição, e "completed" é "Realizada" na consulta. Um mapa único
 *  para todos os tipos erra a concordância e o sentido. */
const ROTULOS_DE_STATUS: Partial<
  Record<ClinicalTimelineEventType, Readonly<Record<string, string>>>
> = {
  exam: {
    uploaded: 'Enviado',
    processing: 'Em processamento',
    processed: 'Processado',
  },
  medication: { active: 'Ativo', inactive: 'Inativo' },
  medication_intake: INTAKE_STATUS_LABELS,
  appointment: APPOINTMENT_STATUS_LABELS,
  condition: CONDITION_STATUS_LABELS,
  allergy: ROTULOS_GRAVIDADE_ALERGIA,
  vaccination: { planned: 'Planejada', applied: 'Aplicada' },
};

/**
 * Enum que a RPC coloca no ÚLTIMO trecho do resumo:
 *   medicamento  → dosagem · unidade · FREQUÊNCIA
 *   exame        → laboratório · CATEGORIA
 *   consulta     → especialidade · MODALIDADE
 *
 * Traduzir só o último trecho (e não todos) é proposital: os trechos anteriores
 * são texto livre da pessoa (nome de laboratório, especialidade, observação), e
 * um laboratório chamado "Lab" não pode virar "Laboratorial" no prontuário
 * dela. O `nullif` da RPC descarta os vazios, então a posição do enum varia —
 * o que não varia é ele ser o último.
 */
const ENUM_NO_FIM_DO_RESUMO: Partial<
  Record<ClinicalTimelineEventType, Readonly<Record<string, string>>>
> = {
  medication: MEDICATION_FREQUENCY_LABELS,
  exam: EXAM_CATEGORY_LABELS,
  appointment: APPOINTMENT_KIND_LABELS,
};

function resumoEmPortugues(
  tipo: ClinicalTimelineEventType,
  resumo: string,
): string {
  const dicionario = ENUM_NO_FIM_DO_RESUMO[tipo];
  if (!dicionario) return resumo;

  const partes = resumo.split(SEPARADOR_RESUMO);
  const ultima = partes[partes.length - 1]?.trim() ?? '';
  const traduzida = dicionario[ultima];
  // Valor não previsto continua aparecendo como veio: esconder dado de
  // prontuário é pior que mostrá-lo imperfeito — e deixa o defeito visível.
  if (!traduzida) return resumo;

  partes[partes.length - 1] = traduzida;
  return partes.join(SEPARADOR_RESUMO);
}

function statusEmPortugues(
  tipo: ClinicalTimelineEventType,
  status: string,
): string {
  return ROTULOS_DE_STATUS[tipo]?.[status] ?? status;
}

/* ══════════════════════════════════ Data ══════════════════════════════════
 *
 * Sem `Intl` e sem fatiar string ISO na mão: as duas coisas já erraram a data
 * neste projeto. A formatação usa os utilitários PT-BR do core (os mesmos do
 * mobile) e respeita a diferença que a RPC declara em `date_only`:
 *
 *  · `date_only = true`  → é um fato do CALENDÁRIO (cirurgia em 12/03, exame de
 *    ontem). A RPC grava esse dia como MEIO-DIA em UTC justamente para nenhum
 *    fuso empurrar o registro para a véspera ou para o dia seguinte; por isso
 *    lemos o dia de volta em UTC, e não no relógio de quem está lendo.
 *  · `date_only = false` → é um INSTANTE (consulta às 14:30, tomada de remédio).
 *    Esse a gente mostra no fuso local, com a hora, que é o que a pessoa viveu.
 */
function dataDoEvento(evento: ClinicalTimelineEvent): {
  /** `AAAA-MM-DD` ou ISO completo para o atributo `datetime`. */
  atributo: string;
  texto: string;
  hora: string | null;
} {
  const quando = new Date(evento.occurredAt);
  if (Number.isNaN(quando.getTime())) {
    return { atributo: '', texto: '', hora: null };
  }

  if (evento.dateOnly) {
    const ano = quando.getUTCFullYear();
    const mes = String(quando.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(quando.getUTCDate()).padStart(2, '0');
    const diaIso = `${ano}-${mes}-${dia}`;
    return { atributo: diaIso, texto: dataPorExtenso(diaIso), hora: null };
  }

  return {
    atributo: evento.occurredAt,
    texto: dataPorExtenso(diaLocal(quando)),
    hora: horaLocal(quando) || null,
  };
}

export default function LinhaDoTempoPage() {
  const { patientId, active, isPatientKnown } = useActiveProfile();
  const timeline = useClinicalTimeline(patientId || undefined);
  const paginas = timeline.data?.pages;
  const events = paginas?.flatMap((page) => page.events) ?? [];

  /* ═════════════════ Quem tem direito de dizer "nenhum registro" ═════════════════
   *
   * Esta tela escreve "Nenhum registro disponível" — uma AFIRMAÇÃO sobre o
   * prontuário de alguém. Antes ela decidia isso por `isLoading`/`isError`, e as
   * duas são `false` AO MESMO TEMPO enquanto o `patientId` está vazio: a consulta
   * fica `enabled: false` (packages/supabase/src/hooks/timeline.ts) e, no React
   * Query v5, consulta desligada é `status: 'pending'` com `fetchStatus: 'idle'`.
   * As duas travas caíam juntas e a tela declarava o prontuário vazio sem nunca
   * ter perguntado ao banco. É o mesmo defeito que já chegou em produção com
   * alergias (ver o cabeçalho de `dashboard/page.tsx`). Quem decide agora é
   * `estadoSecao`, que trata "ainda não sei de quem é" como estado próprio.
   *
   * As duas flags entram ajustadas por uma resposta JÁ RECEBIDA (`paginas`):
   *  · com página em mãos, a pergunta "existe registro?" está respondida pelo
   *    servidor — lista vazia aqui é vazio de verdade;
   *  · e uma falha POSTERIOR não apaga o que já foi lido. Em v5,
   *    `isFetchNextPageError = isError && direção 'forward'`, ou seja, "carregar
   *    registros anteriores" que falha deixa `isError` verdadeiro com os dados
   *    intactos. Sem esse recorte, um erro de paginação trocaria a linha do tempo
   *    inteira por uma tela de erro — e o aviso logo abaixo da lista, que existe
   *    justamente para esse caso, nunca apareceria.
   */
  const jaRespondeu = paginas !== undefined;
  const estado = estadoSecao({
    sujeitoConhecido: isPatientKnown,
    isSuccess: timeline.isSuccess || jaRespondeu,
    isError: timeline.isError && !jaRespondeu,
  });

  return (
    // `max-w-3xl` e não `5xl`: o cartão largo demais era o que abria o vazio
    // entre o título e a data, e linha longa demais também cansa a leitura.
    <main className="mx-auto max-w-3xl space-y-5 hp-page">
      <PageHeader
        eyebrow="Prontuário"
        title="Linha do tempo clínica"
        subtitle={
          active.isSelf
            ? 'Seus registros organizados pela data original.'
            : `Registros de ${active.name}, conforme suas permissões de cuidado.`
        }
        icon={ClipboardList}
        tone="azul"
      />

      <aside className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-body-sm text-fg-soft">
        <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p>
          Esta visão reúne registros existentes e identifica a fonte de cada item. Ela não
          cria diagnósticos nem substitui avaliação profissional.
        </p>
      </aside>

      {estado === 'sujeito-indefinido' || estado === 'carregando' ? (
        <ListSkeleton rows={5} />
      ) : estado === 'falhou' ? (
        <ErrorState
          message="Não foi possível carregar a linha do tempo. Nenhuma ausência de registro será tratada como resultado normal."
          onRetry={() => void timeline.refetch()}
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum registro disponível"
          description="Novos registros clínicos aparecerão aqui em ordem cronológica."
        />
      ) : (
        <>
          <ol className="relative space-y-3 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-line">
            {events.map((event) => (
              <TimelineItem key={event.eventKey} event={event} />
            ))}
          </ol>

          {timeline.isFetchNextPageError && (
            <div role="alert" className="rounded-xl border border-line bg-surface p-3 text-body-sm text-fg-soft">
              A próxima página não foi carregada. Tente novamente.
            </div>
          )}

          {timeline.hasNextPage && (
            <button
              type="button"
              onClick={() => void timeline.fetchNextPage()}
              disabled={timeline.isFetchingNextPage}
              aria-busy={timeline.isFetchingNextPage}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-body font-semibold text-fg transition-colors hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw
                className={`h-5 w-5 ${timeline.isFetchingNextPage ? 'animate-spin' : ''}`}
                aria-hidden
              />
              {timeline.isFetchingNextPage ? 'Carregando…' : 'Carregar registros anteriores'}
            </button>
          )}
        </>
      )}
    </main>
  );
}

function TimelineItem({ event }: { event: ClinicalTimelineEvent }) {
  const presentation = EVENT_PRESENTATION[event.eventType];
  const Icon = presentation.icon;
  const status = event.status ? statusEmPortugues(event.eventType, event.status) : null;
  const resumo = event.summary ? resumoEmPortugues(event.eventType, event.summary) : null;
  const data = dataDoEvento(event);

  return (
    <li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
      <span className="z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface">
        <Icon className="h-5 w-5 text-primary" aria-hidden />
      </span>
      {/* Em tela larga, duas colunas: identificação (categoria + data) e o
          registro em si. A data deixa de ser empurrada para a borda direita —
          era ela que criava o vão vazio no meio do cartão. Abaixo de `md` tudo
          volta a empilhar, com categoria e data na mesma linha. */}
      <article className="rounded-2xl border border-line bg-surface p-4 md:grid md:grid-cols-[11.5rem_minmax(0,1fr)] md:gap-x-5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 md:block">
          <p className="text-body-sm font-semibold text-primary">{presentation.label}</p>
          {data.texto ? (
            <time dateTime={data.atributo} className="text-body-sm text-fg-soft md:mt-1 md:block">
              {data.texto}
              {data.hora ? <span className="whitespace-nowrap">, {data.hora}</span> : null}
            </time>
          ) : (
            <span className="text-body-sm text-fg-soft">Data indisponível</span>
          )}
        </div>

        <div className="mt-2 md:mt-0">
          <h2 className="text-body font-semibold text-fg">{event.title}</h2>
          {resumo && <p className="mt-1 text-body text-fg-soft">{resumo}</p>}
          {status && (
            <span className="mt-2 inline-flex rounded-full bg-surface-2 px-3 py-1 text-body-sm font-semibold text-fg-soft">
              {status}
            </span>
          )}
        </div>
      </article>
    </li>
  );
}
