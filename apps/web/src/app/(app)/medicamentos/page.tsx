'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, Package, Pill, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useMedications,
  useRecentIntakes,
  useRegisterIntake,
  useDrugInteractions,
  useDoseAdherence,
  useRecordDoseEvent,
} from '@hubpatients/supabase';
import {
  adherenceByHour,
  adherenceRate,
  dailyDosesFromMed,
  estadoSecao,
  expectedDosesInDays,
  findFarmaciaPopularItem,
  stockForecast,
  ADHERENCE_DISCLAIMER,
  type EstadoSecao,
  type Medication,
} from '@hubpatients/core';
import { useActiveProfile } from '@/components/profile-context';
import { MedicationCard } from '@/components/meds/medication-card';
import { FarmaciaPopularBadge } from '@/components/meds/farmacia-popular-badge';
import { InteractionBanner } from '@/components/meds/interaction-banner';
import { NewMedicationModal } from '@/components/meds/new-medication-modal';
import { StockModal } from '@/components/meds/stock-modal';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui';
import { PageHeader } from '@/components/ui/painel';
import { scheduledAtToday } from '@/lib/time';

/** Teto da janela do painel de adesão e do alerta de reposição (paridade com o mobile). */
const ADHERENCE_DAYS = 30;
const STOCK_ALERT_DAYS = 7;

/**
 * Dias mínimos de acompanhamento para o painel de doses confirmadas aparecer
 * QUANDO AINDA NÃO HÁ NENHUM REGISTRO na janela.
 *
 * O painel abria a tela mostrando "0%" para quem tinha acabado de cadastrar o
 * primeiro remédio — um número que não descrevia a pessoa, descrevia o app
 * recém-instalado, e que lido de relance soa como falha de quem acabou de se
 * organizar. Mas o corte por tempo sozinho tirava o cartão de quem TEM
 * histórico (bastava o remédio ativo mais antigo ter menos de uma semana), e
 * isso é perda de funcionalidade, não higiene de tela vazia. Por isso o corte
 * só vale enquanto não houver nenhuma dose registrada na janela: havendo
 * registro, o número já descreve a pessoa e o cartão fica.
 */
const ADHERENCE_MIN_DAYS = 7;

const dayWord = (n: number) => (n === 1 ? 'dia' : 'dias');

/** 'AAAA-MM-DD' -> 'DD/MM'. */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return month && day ? `${day}/${month}` : isoDate;
}

/** Dias inteiros entre `iso` e agora. Data futura ou ilegível conta como 0. */
function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** Um remédio cujo consumo dá para prever, junto com quantas doses/dia ele prevê. */
type MedComPrevisao = { med: Medication; dosesPorDia: number };

/**
 * Quais remédios entram na contagem de doses previstas — e quantas doses por
 * dia cada um prevê.
 *
 * Duas exclusões, as duas para não inventar dívida contra a pessoa:
 *  • sem horário cadastrado não há dose prevista (e `dailyDosesFromMed` devolve
 *    1/dia por padrão, o que aqui viraria previsão do nada);
 *  • `as_needed` ("se necessário") não prevê nada — é o `null` do helper.
 *
 * E o número vem de `dailyDosesFromMed`, não de `times.length`: no SEMANAL cada
 * horário vale n/7 por dia. Contar cada horário como diário multiplicava o
 * previsto por sete e derrubava o percentual sozinho — uma conta errada do app
 * que a pessoa lê como falha dela.
 */
function medsComPrevisao(meds: Medication[]): MedComPrevisao[] {
  const lista: MedComPrevisao[] = [];
  for (const med of meds) {
    if ((med.times?.length ?? 0) === 0) continue;
    const dosesPorDia = dailyDosesFromMed(med.frequency, med.times);
    if (dosesPorDia == null || dosesPorDia <= 0) continue;
    lista.push({ med, dosesPorDia });
  }
  return lista;
}

/**
 * Janela ÚNICA do painel, em dias: no máximo 30, no máximo a idade do remédio
 * contado mais antigo. É ela que vai para a consulta dos eventos E para o
 * cálculo do previsto — numerador e denominador falam do mesmo período.
 */
function janelaDeAcompanhamento(previsiveis: MedComPrevisao[]): number {
  return Math.min(
    ADHERENCE_DAYS,
    previsiveis.reduce((maior, { med }) => Math.max(maior, daysSince(med.created_at)), 0),
  );
}

export default function MedicamentosPage() {
  const { patientId, ownId, active: activeProfile, isPatientKnown } = useActiveProfile();
  const medsQuery = useMedications(patientId || undefined);
  const meds = medsQuery.data;
  const { data: intakes, refetch: refetchIntakes } = useRecentIntakes(patientId || undefined);
  const registerIntake = useRegisterIntake(patientId);

  /*
   * VERACIDADE — esta tela não pode dizer "Nenhum medicamento ativo" (nem
   * "Ativos (0)") antes de o servidor ter respondido isso.
   *
   * Ler só `data` era a forma mais silenciosa do defeito: com `patientId`
   * vazio a consulta fica `enabled: false` e, no React Query v5, `isLoading` e
   * `isError` são `false` AO MESMO TEMPO — as duas travas habituais caem
   * juntas e a tela renderiza a lista vazia como se fosse resposta. Quem
   * decide agora é `estadoSecao`, que trata "ainda não sei de quem é o
   * prontuário" como estado próprio. Mesma porta do Painel
   * (`apps/web/src/app/(app)/dashboard/page.tsx`) e regra em
   * `packages/core/src/utils/estado-secao.ts`.
   */
  const estado = estadoSecao({
    sujeitoConhecido: isPatientKnown,
    isSuccess: medsQuery.isSuccess,
    isError: medsQuery.isError,
  });

  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [stockMed, setStockMed] = useState<Medication | null>(null);

  const active = useMemo(() => (meds ?? []).filter((m) => m.active), [meds]);
  const inactive = useMemo(() => (meds ?? []).filter((m) => !m.active), [meds]);
  const shown = tab === 'active' ? active : inactive;

  // Remédios que entram na contagem de doses e a janela que eles definem.
  const previsiveis = useMemo(() => medsComPrevisao(active), [active]);
  const trackedDays = useMemo(() => janelaDeAcompanhamento(previsiveis), [previsiveis]);

  /*
   * dose_events é owner-only (RLS user_id = auth.uid()): só no próprio perfil.
   * A janela pedida é a MESMA usada no denominador — era daí que saía a frase
   * impossível ("confirmou 24 de 8 doses previstas nos últimos 8 dias"): o
   * numerador vinha fixo de 30 dias e o denominador, de 8.
   */
  const selfView = activeProfile.isSelf;
  const doseUserId = selfView && ownId ? ownId : undefined;
  const doseQuery = useDoseAdherence(doseUserId, Math.max(1, trackedDays));
  const estadoDoses = estadoSecao({
    sujeitoConhecido: Boolean(doseUserId),
    isSuccess: doseQuery.isSuccess,
    isError: doseQuery.isError,
  });
  const recordDose = useRecordDoseEvent(doseUserId);

  // Reposição de estoque: quando acaba, pelo consumo cadastrado. Alerta se falta
  // menos de uma semana OU se o limiar configurado pela pessoa já foi atingido.
  const stockAlerts = useMemo(() => {
    return active
      .map((med) => ({
        med,
        forecast: stockForecast({
          stockCount: med.stock_count,
          dosesPerDay: dailyDosesFromMed(med.frequency, med.times),
        }),
      }))
      .filter(({ med, forecast }) => {
        const days = forecast.daysRemaining;
        return days != null && (days < STOCK_ALERT_DAYS || days <= med.stock_low_threshold_days);
      })
      .sort((a, b) => (a.forecast.daysRemaining ?? 0) - (b.forecast.daysRemaining ?? 0));
  }, [active]);

  const firstAlert = stockAlerts[0];

  const activeNames = active.map((m) => m.name);
  const {
    data: interactions,
    isLoading: interactionsLoading,
    isError: interactionsError,
  } = useDrugInteractions(activeNames, activeNames.length > 1);

  function handleNew() {
    setModalOpen(true);
  }

  /**
   * Espelha a confirmação em `dose_events` para a adesão contar tanto o que veio
   * da ação da notificação (celular) quanto o que foi marcado aqui. Silencioso:
   * a tomada já foi registrada, uma falha aqui não vira erro na tela.
   */
  function mirrorDoseEvent(medicationId: string, scheduledFor: string) {
    if (!selfView || !ownId) return;
    recordDose
      .mutateAsync({
        medication_id: medicationId,
        scheduled_for: scheduledFor,
        status: 'taken',
        source: 'app',
      })
      .catch(() => undefined);
  }

  async function handleRegister(medicationId: string, time: string) {
    const scheduledFor = scheduledAtToday(time);
    try {
      await registerIntake.mutateAsync({
        patient_id: patientId,
        medication_id: medicationId,
        status: 'taken',
        scheduled_for: scheduledFor,
        taken_at: new Date().toISOString(),
      });
      mirrorDoseEvent(medicationId, scheduledFor);
      await refetchIntakes();
      toast.success('Tomada registrada. 👏');
    } catch {
      toast.error('Não foi possível registrar.');
    }
  }

  /**
   * O estado vazio de "Ativos" é o único que traz uma chamada para ação, e é
   * ela que fica: alvo grande, no centro da tela e com a frase inteira
   * ("Adicionar primeiro medicamento"). O "+ Novo" do topo era um alvo pequeno
   * com um rótulo de uma palavra dizendo a MESMA coisa dois centímetros acima —
   * duas portas para a mesma sala dividem a atenção justamente de quem tem mais
   * dificuldade de escolher. O botão do topo volta assim que existe lista.
   *
   * `estado === 'confirmada'` é obrigatório aqui: enquanto a lista não foi
   * confirmada não existe estado vazio na tela, e esconder o botão do topo
   * deixaria a página sem NENHUMA porta de entrada durante o carregamento ou
   * depois de uma falha.
   */
  const estadoVazioJaConvida = estado === 'confirmada' && shown.length === 0 && tab === 'active';

  return (
    <div className="mx-auto max-w-5xl space-y-5 hp-page">
      <PageHeader
        eyebrow="Meu prontuário"
        title="Medicamentos"
        subtitle="Organize horários, confirme tomadas e acompanhe quando será necessário repor o estoque."
        icon={Pill}
        tone="azul"
        right={
          estadoVazioJaConvida ? undefined : (
            <Button onClick={handleNew}>
              <Plus className="h-5 w-5" aria-hidden /> Novo medicamento
            </Button>
          )
        }
      />

      {/* Lembrete de reposição: quando acaba e em que data. */}
      {firstAlert && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
          <Package className="h-5 w-5 shrink-0 text-status-alert-ink" />
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-rose-700 dark:text-rose-200">
              {`Seu estoque de ${firstAlert.med.name} acaba em ${firstAlert.forecast.daysRemaining} ${dayWord(firstAlert.forecast.daysRemaining ?? 0)}.`}
            </p>
            {/* Sem opacidade: `/80` derrubava o contraste da linha que explica
                a data justamente no aviso que precisa ser lido. */}
            <p className="text-body-sm text-rose-700 dark:text-rose-200">
              {firstAlert.forecast.runsOutOn
                ? `Previsão pelo consumo cadastrado: por volta de ${shortDate(firstAlert.forecast.runsOutOn)}.`
                : 'Previsão pelo consumo cadastrado.'}
              {stockAlerts.length > 1 ? ` Outros ${stockAlerts.length - 1} também estão acabando.` : ''}
            </p>
          </div>
          <button
            onClick={() => setStockMed(firstAlert.med)}
            className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-accent px-4 text-label font-semibold text-white transition hover:opacity-90"
          >
            Comprei mais
          </button>
        </div>
      )}

      {/* Doses confirmadas (só no próprio perfil — dose_events é owner-only). */}
      {selfView && estado === 'confirmada' && (
        <AdherencePanel
          previsiveis={previsiveis}
          trackedDays={trackedDays}
          estado={estadoDoses}
          summary={doseQuery.data}
          onRetry={() => {
            void doseQuery.refetch();
          }}
        />
      )}

      {/* Checador de interações */}
      {active.length > 1 && (
        <InteractionBanner
          interactions={interactions ?? []}
          isLoading={interactionsLoading}
          isError={interactionsError}
        />
      )}

      {/*
        Abas, contagens, lista e estado vazio só existem depois da resposta do
        servidor. "Ativos (0)" é uma AFIRMAÇÃO de ausência tanto quanto o
        "Nenhum medicamento ativo" logo abaixo — antes de `confirmada` a tela
        mostra que está buscando (ou que falhou, com como tentar de novo).
      */}
      {estado === 'confirmada' ? (
        <>
          <Tabs<'active' | 'inactive'>
            ariaLabel="Filtrar medicamentos"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'active', label: `Ativos (${active.length})` },
              { key: 'inactive', label: `Inativos (${inactive.length})` },
            ]}
          />

          {shown.length > 0 ? (
            <div className="space-y-3">
              {shown.map((m) => {
                // Etiqueta informativa: o princípio ativo consta no elenco gratuito do
                // Farmácia Popular. Não é indicação nem promessa de direito adquirido.
                const farmaciaPopular = findFarmaciaPopularItem(m.name);
                return (
                  <div key={m.id}>
                    <MedicationCard
                      medication={m}
                      intakes={(intakes ?? []).filter((i) => i.medication_id === m.id)}
                      onRegister={(time) => handleRegister(m.id, time)}
                      onStock={() => setStockMed(m)}
                    />
                    {farmaciaPopular && (
                      <div className="mt-2 pl-1">
                        <FarmaciaPopularBadge item={farmaciaPopular} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : tab === 'active' ? (
            <EmptyState
              icon={Pill}
              title="Nenhum medicamento ativo"
              description="Cadastre seus remédios para receber lembretes e registrar as tomadas."
              action={
                <Button onClick={handleNew}>
                  <Plus className="h-5 w-5" aria-hidden /> Adicionar primeiro medicamento
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Pill} title="Nenhum medicamento inativo" />
          )}
        </>
      ) : estado === 'falhou' ? (
        <ErrorState
          message="Não foi possível carregar sua lista de medicamentos agora. Enquanto isso, esta tela não diz que você não tem nenhum — ela só não conseguiu ler."
          onRetry={() => {
            void medsQuery.refetch();
          }}
        />
      ) : (
        <ListSkeleton rows={3} />
      )}

      <p className="text-center text-body-sm text-muted">
        Lembrete básico e registro de tomada são gratuitos, sempre. 💙
      </p>

      <NewMedicationModal open={modalOpen} onClose={() => setModalOpen(false)} patientId={patientId} />
      {stockMed && (
        <StockModal open={Boolean(stockMed)} onClose={() => setStockMed(null)} medication={stockMed} patientId={patientId} />
      )}
    </div>
  );
}

/* ─────────────────────────── Doses confirmadas ──────────────────────────── */

/**
 * Formato mínimo do agregado (evita depender do tipo exportado do pacote).
 *
 * Só os eventos crus entram: as contagens prontas (`taken`, `snoozed`,
 * `skipped`) somam TODOS os medicamentos da pessoa, inclusive os inativos, e
 * era delas que vinha o numerador de outro conjunto. Aqui a contagem é feita
 * sobre os eventos já filtrados.
 */
type DoseSummaryLike = {
  events: {
    medication_id: string;
    scheduled_for: string;
    status: 'taken' | 'snoozed' | 'skipped';
  }[];
};

/**
 * Doses confirmadas — pela ação da notificação no celular ou marcadas aqui.
 * É contagem, não avaliação: nada de "adesão ruim". Quem lê o tratamento é a
 * equipe de saúde.
 *
 * AS TRÊS CONTAS QUE PRECISAM FECHAR (e que já não fechavam)
 *  1. MESMO CONJUNTO. O previsto vem dos remédios ATIVOS com horário, então o
 *     confirmado também: os eventos são filtrados por `medication_id`. Sem
 *     isso o numerador trazia dose de remédio inativo e a frase virava
 *     aritmeticamente impossível ("confirmou 24 de 8").
 *  2. MESMA JANELA. Um só `trackedDays` — o mesmo que foi pedido à consulta.
 *     Antes o numerador vinha de 30 dias fixos e o denominador, da idade do
 *     remédio. `Math.min` na frase seria remendo: esconderia a incoerência sem
 *     desfazê-la, e o texto continuaria descrevendo um período que não é o do
 *     dado.
 *  3. MESMA UNIDADE. Doses/dia saem de `dailyDosesFromMed` (semanal = n/7,
 *     "se necessário" não conta), não de `times.length`.
 *
 * QUANDO ELE NÃO APARECE (queixa do cliente: "essa parte de cima pode sair")
 * Só quando o número não descreveria ninguém: sem remédio com horário, sem
 * previsto, ou cadastro recém-feito AINDA SEM nenhuma dose registrada. Quem já
 * tem registro na janela vê o cartão — tirá-lo de quem tem histórico seria
 * perder função, não limpar tela.
 */
function AdherencePanel({
  previsiveis,
  trackedDays,
  estado,
  summary,
  onRetry,
}: {
  previsiveis: MedComPrevisao[];
  trackedDays: number;
  estado: EstadoSecao;
  summary: DoseSummaryLike | undefined;
  onRetry: () => void;
}) {
  const idsContados = useMemo(
    () => new Set(previsiveis.map(({ med }) => med.id)),
    [previsiveis],
  );

  // Só os eventos dos remédios que também estão no denominador.
  const eventos = useMemo(
    () => (summary?.events ?? []).filter((e) => idsContados.has(e.medication_id)),
    [summary, idsContados],
  );

  // Previsto por remédio, limitado à janela e à idade do cadastro: remédio
  // novo não gera dívida de dias em que ele nem existia.
  const previstas = useMemo(
    () =>
      previsiveis.reduce(
        (soma, { med, dosesPorDia }) =>
          soma + expectedDosesInDays(dosesPorDia, Math.min(trackedDays, daysSince(med.created_at))),
        0,
      ),
    [previsiveis, trackedDays],
  );

  const confirmadas = eventos.filter((e) => e.status === 'taken').length;
  const adiadas = eventos.filter((e) => e.status === 'snoozed').length;
  const puladas = eventos.filter((e) => e.status === 'skipped').length;
  const rate = adherenceRate(eventos, previstas);

  // Padrão por horário: ajuda a pessoa a ver sozinha qual dose costuma escapar.
  const byHour = adherenceByHour(eventos).filter((b) => b.total >= 3);
  const lowest = byHour.length > 1 ? byHour.reduce((a, b) => ((b.rate ?? 100) < (a.rate ?? 100) ? b : a)) : null;
  const weakest = lowest && lowest.rate != null && lowest.rate < 100 ? lowest : null;

  // Sem remédio com horário não há o que contar — e não há o que dizer.
  if (previsiveis.length === 0) return null;

  // Ausência de cartão não afirma nada; um cartão com "0%" montado sobre dado
  // que não chegou, sim. Por isso, antes da resposta, o painel não existe.
  if (estado === 'sujeito-indefinido' || estado === 'carregando') return null;

  // Falha não pode virar "você não confirmou nada": some o número e fica o
  // caminho de volta.
  if (estado === 'falhou') {
    return (
      <ErrorState
        message="Não foi possível carregar suas doses confirmadas agora. O número não aparece porque não foi lido — não porque seja zero."
        onRetry={onRetry}
      />
    );
  }

  // `rate == null` = nada previsto no período (nenhum dos remédios completou um
  // dia de cadastro). E, sem nenhum registro, um cartão recém-nascido só
  // mostraria a idade do cadastro em forma de 0%.
  if (rate == null) return null;
  if (eventos.length === 0 && trackedDays < ADHERENCE_MIN_DAYS) return null;

  /*
   * Registro manual pode passar do previsto (dose de hoje confirmada antes de o
   * dia fechar, por exemplo). Nesse caso a frase muda de forma em vez de fingir
   * uma fração: "8 de 6" não existe, mas "8 doses, e o previsto era 6" é o que
   * de fato aconteceu.
   */
  const frase =
    confirmadas <= previstas
      ? `Você confirmou ${confirmadas} de ${previstas} doses previstas nos últimos ${trackedDays} ${dayWord(trackedDays)}.`
      : `Você confirmou ${confirmadas} doses nos últimos ${trackedDays} ${dayWord(trackedDays)} — mais do que as ${previstas} previstas pelo que está cadastrado.`;

  return (
    <section className="space-y-1.5 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-5 w-5 shrink-0 text-status-info-ink" aria-hidden />
        <h2 className="flex-1 text-body font-semibold text-fg">
          Doses confirmadas · {trackedDays} {dayWord(trackedDays)}
        </h2>
        <span className="text-xl font-bold text-status-info-ink">{rate}%</span>
      </div>

      {/*
        SC 1.4.11 (contraste não-textual, 3:1) MEDIDO no tema claro, que é o
        padrão do app:
          • preenchimento × trilho: `sky-500` #0ea5e9 sobre `surface-2` #f3f1ec
            dava 2,46:1 — reprovado, e a barra é a única representação gráfica
            do número. `primary` #0442bf sobre o mesmo trilho dá 7,33:1
            (no escuro, #8ba9ff sobre #212121 dá 7,07:1);
          • trilho × cartão: #f3f1ec sobre `surface` #ffffff é 1,13:1, ou seja,
            a extensão do trilho era invisível — quem visse metade preenchida
            não veria de quanto era a metade. A borda `line-strong` delimita a
            barra inteira: #87837c sobre o branco = 3,77:1 (claro) e #727578
            sobre #171717 = 3,87:1 (escuro).
      */}
      <div
        role="progressbar"
        aria-valuenow={rate}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Doses confirmadas nos últimos ${trackedDays} ${dayWord(trackedDays)}`}
        className="h-3 w-full overflow-hidden rounded-full border border-line-strong bg-surface-2"
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${rate}%` }} />
      </div>

      <p className="text-body-sm text-fg-soft">{frase}</p>

      {weakest && (
        <p className="text-body-sm text-fg-soft">
          {`Por horário: às ${String(weakest.hour).padStart(2, '0')}h você confirmou ${weakest.taken} de ${weakest.total} vezes.`}
        </p>
      )}

      {(adiadas > 0 || puladas > 0) && (
        <p className="text-body-sm text-muted">
          {`Adiadas: ${adiadas} · marcadas como puladas: ${puladas}.`}
        </p>
      )}

      {/* A frase que impede o número de virar julgamento. Era 11px em `muted`,
          o texto mais apagado da tela: o cuidado estava escrito e ilegível. */}
      <p className="text-body-sm text-fg-soft">{ADHERENCE_DISCLAIMER}</p>
    </section>
  );
}
