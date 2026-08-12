'use client';

import { Check, Clock, FileText, Package, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import type { Medication, MedicationIntake } from '@hubpatients/core';
import {
  computeAdherence,
  dailyDosesFromMed,
  expectedDosesInDays,
  MEDICATION_FREQUENCY_LABELS,
  MEDICATION_FORM_LABELS,
  formatStockStatus,
  daysRemainingForMed,
  resolveBulaUrl,
  ANVISA_EXIT_NOTICE,
} from '@hubpatients/core';
import { AdherenceBar } from './adherence-bar';

/** Teto da janela de adesão do cartão, em dias. */
const ADESAO_DIAS = 7;

const MS_POR_DIA = 86_400_000;

/** Dias inteiros entre `iso` e agora. Data futura ou ilegível conta como 0. */
function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / MS_POR_DIA));
}

function openBula(medication: Medication) {
  toast.info(ANVISA_EXIT_NOTICE);
  window.open(resolveBulaUrl(medication), '_blank', 'noopener,noreferrer');
}

export function MedicationCard({
  medication,
  intakes,
  onRegister,
  onStock,
}: {
  medication: Medication;
  intakes: MedicationIntake[];
  onRegister: (time: string) => void;
  onStock?: () => void;
  registering?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const stockDays = daysRemainingForMed(medication);
  const stockUrgent =
    medication.stock_count != null && stockDays != null && stockDays <= medication.stock_low_threshold_days;

  /*
   * ADESÃO DO CARTÃO — a conta precisa fechar com a do painel de cima.
   *
   * O que havia aqui: `expected = medication.times.length * 7`. Três defeitos
   * numa linha só, e todos empurram o percentual PARA BAIXO:
   *  1. SEMANAL virava diário. Remédio `weekly` com um horário prevê 1 dose na
   *     semana; a conta previa 7. Quem tomava a única dose da semana lia
   *     "Adesão · 7 dias — 14%" em VERMELHO logo abaixo do nome do remédio.
   *  2. "Se necessário" (`as_needed`) não prevê nada, e ganhava previsão do
   *     nada — dívida inventada contra quem usa o remédio só quando precisa.
   *  3. Remédio cadastrado ontem já nascia devendo os sete dias em que ele nem
   *     existia.
   *
   * Um número gerado pelo app que a pessoa lê como falha DELA é exatamente o
   * que este produto não faz. A página (`(app)/medicamentos/page.tsx`) já tinha
   * corrigido a mesma conta no painel; o defeito sobreviveu aqui, e era o
   * cartão — colado no nome do remédio — que a pessoa realmente lê.
   *
   * Agora, a mesma semântica já validada lá:
   *  • doses/dia saem de `dailyDosesFromMed` (semanal = n/7, `as_needed` =
   *    null), nunca de `times.length`;
   *  • a janela é no máximo 7 dias E no máximo a idade do cadastro;
   *  • numerador e denominador falam do MESMO período — as tomadas contadas
   *    são as da janela, não sempre as de 7 dias;
   *  • sem previsão (null, 0 doses/dia ou janela de 0 dia) a barra não aparece:
   *    ausência de número não afirma nada, um "0%" montado no vazio afirma.
   */
  const semHorario = (medication.times?.length ?? 0) === 0;
  // `dailyDosesFromMed` devolve 1/dia por padrão, então SEM HORÁRIO ela preveria
  // uma dose por dia que ninguém tem como confirmar (não há botão de tomada) —
  // 0% garantido, em vermelho. Mesma exclusão que `medsComPrevisao` faz na página.
  const dosesPorDia = semHorario ? null : dailyDosesFromMed(medication.frequency, medication.times);
  const janelaAdesao = Math.min(ADESAO_DIAS, daysSince(medication.created_at));
  const previstas =
    dosesPorDia == null || dosesPorDia <= 0 ? 0 : expectedDosesInDays(dosesPorDia, janelaAdesao);
  const desdeAdesao = new Date(Date.now() - janelaAdesao * MS_POR_DIA);
  const confirmadas = intakes.filter(
    (i) => i.status === 'taken' && i.taken_at && new Date(i.taken_at) >= desdeAdesao,
  ).length;
  const adherence = computeAdherence(confirmadas, previstas);

  // dose tomada hoje neste horário?
  const takenToday = (time: string) =>
    intakes.some(
      (i) => i.status === 'taken' && i.scheduled_for?.slice(0, 10) === today && i.scheduled_for?.slice(11, 16) === time,
    );

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/*
           * LEGIBILIDADE 50+ (correção 2026-08) — este cartão é a queixa LITERAL
           * do idealizador (54 anos): "achei os caracteres do remédio, mg,
           * diariamente, comprimido, Dr. Rafael bem claro e de difícil
           * visualização para o público 50+".
           *
           * O que havia aqui: nome a 16px e TODO o resto — dose, posologia,
           * forma, prescritor — a 12px (`text-xs`) pintado de `muted`. Como a
           * rodada anterior subiu o entorno (aviso de estoque, adesão,
           * disclaimer), o cartão do remédio tinha virado o texto MAIS apagado e
           * MAIS pequeno da tela inteira — o oposto exato da hierarquia pedida.
           *
           * Piso aplicado, o mesmo que as primitivas do Painel estabeleceram:
           * metadado nunca abaixo de `text-body-sm` (15px) e tinta mínima
           * `fg-soft`. Medido pela fórmula da WCAG 2.x contra a superfície REAL
           * do cartão (`--surface`, dentro de `.hp-clinical-shell`):
           *
           *   claro   fg-soft #354056 sobre #ffffff = 10,40:1  (era 5,90:1)
           *   escuro  fg-soft #cfd4dd sobre #171717 = 12,05:1  (era 7,84:1)
           *
           * Os dois degraus são `rem` puro, então o Modo Sênior leva 15px a
           * ~19,5px e 17px a ~22px. A hierarquia não sumiu: ela mora agora no
           * PESO e na TINTA, não em encolher o que precisa ser lido.
           */}
          <p className="text-body font-semibold text-fg">
            {medication.name}
            {/* A dose é número clínico: `hp-num` (Atkinson Mono, tabular) para
                que 1/l e 0/O sejam inconfundíveis — quem lê "5mg" errado erra a
                dose. E ela deixa de ser o texto mais fraco da linha. */}
            {medication.dosage && (
              <span className="hp-num ml-1.5 text-body-sm font-semibold text-fg-soft">
                {medication.dosage}
                {medication.unit ?? ''}
              </span>
            )}
          </p>
          <p className="text-body-sm text-fg-soft">
            {MEDICATION_FREQUENCY_LABELS[medication.frequency]} · {MEDICATION_FORM_LABELS[medication.form]}
          </p>
          {medication.prescriber && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-body-sm text-fg-soft">
              <Stethoscope className="h-4 w-4 shrink-0" aria-hidden="true" /> {medication.prescriber}
            </p>
          )}
        </div>
      </div>

      {adherence != null && (
        <div className="mt-4">
          <AdherenceBar percent={adherence} days={janelaAdesao} />
        </div>
      )}

      {/* Estoque */}
      <div
        className={`mt-3 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
          stockUrgent ? 'border-rose-500/40 bg-rose-500/10' : 'border-line bg-surface-2'
        }`}
      >
        <span
          className={`inline-flex items-center gap-1.5 text-body-sm font-medium ${
            stockUrgent ? 'text-rose-700 dark:text-rose-300' : 'text-fg-soft'
          }`}
        >
          <Package className="h-4 w-4 shrink-0" aria-hidden="true" /> {formatStockStatus(medication)}
        </span>
        {onStock && (
          // Alvo de toque: `min-h-11` (2,75rem = 44px), nunca `h-11` — com a
          // fonte ampliada o botão precisa CRESCER, não cortar o rótulo. Antes
          // eram ~24px de altura (py-1 + 12px de texto).
          <button
            onClick={onStock}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-body-sm font-semibold text-primary hover:bg-sky-500/15"
          >
            {medication.stock_count == null ? 'Acompanhar' : 'Comprei mais'}
          </button>
        )}
      </div>

      {medication.times.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-body-sm font-semibold text-fg-soft">Doses de hoje</p>
          <div className="flex flex-wrap gap-2">
            {medication.times.map((t) => {
              const done = takenToday(t);
              return (
                // Este é o alvo mais importante do cartão — é onde a pessoa
                // confirma que tomou o remédio. Tinha ~32px de altura (py-2 +
                // 12px de texto); vai a `min-h-11` (44px, ~57px no Modo Sênior).
                // O horário é número clínico: `hp-num` para tabular e 0/O nítido.
                <button
                  key={t}
                  onClick={() => !done && onRegister(t)}
                  disabled={done}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-body-sm font-semibold transition ${
                    done
                      ? 'cursor-default bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-sky-500/15 text-primary hover:bg-sky-500/25'
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="hp-num">{t.slice(0, 5)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-body-sm text-fg-soft">
          Sem horários definidos. Adicione para registrar tomadas.
        </p>
      )}

      {/* Bula oficial Anvisa */}
      <div className="mt-4 border-t border-line pt-3">
        {/* `-ml-2 px-2` mantém o texto alinhado à coluna do cartão enquanto o
            botão ganha os 44px de alvo que ele não tinha (era ~16px). */}
        <button
          onClick={() => openBula(medication)}
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-body-sm font-semibold text-primary hover:underline"
          aria-label={`Ver a bula de ${medication.name} no Bulário oficial da Anvisa (abre em nova aba)`}
        >
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true" /> Ver bula oficial Anvisa ↗
        </button>
      </div>
    </div>
  );
}
