'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { ExamMetric, ExamMetricExplanation } from '@hubpatients/core';
import { classifyExamMetric, METRIC_FLAG, UNCLASSIFIED_METRIC } from '@hubpatients/core';
import { useMetricHistory } from '@hubpatients/supabase';
import { statusVars, type StatusKind } from '@/components/ui/status-chip';

const MetricEvolutionChart = dynamic(
  () => import('./metric-evolution-chart').then((module) => module.MetricEvolutionChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-24 animate-pulse rounded-lg bg-surface" role="status">
        <span className="sr-only">Carregando evolução da métrica</span>
      </div>
    ),
  },
);

/**
 * Tom do laudo → papel de status do sistema. O `#10B981 / #F59E0B / #EF4444`
 * anterior reprovava em AA (2,41 / 2,04 / 3,57:1 sobre o canvas creme) e não
 * tinha versão de tema escuro; agora cada tom rende `ink` (texto), `mark`
 * (marcador) e `tint` (fundo), já theme-aware. Ver `ui/status-chip.tsx`.
 */
const TONE_STATUS = {
  ok: 'ok',
  attention: 'attention',
  alert: 'alert',
  neutral: 'neutro',
} as const satisfies Record<string, StatusKind>;

export function MetricRow({
  metric,
  explanation,
  patientId,
}: {
  metric: ExamMetric;
  explanation?: ExamMetricExplanation;
  patientId: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: history } = useMetricHistory(open ? patientId : undefined, metric.name, metric.metric_code);

  const classification = classifyExamMetric(metric);
  const meta = classification === 'unclassified' ? UNCLASSIFIED_METRIC : METRIC_FLAG[classification];
  const { ink, mark, tint } = statusVars(TONE_STATUS[meta.tone]);
  // Direção real do desvio: alto e baixo são avaliados de forma independente.
  // Se não dá para determinar (faltam referências), não arriscamos mostrar a
  // explicação trocada — preferimos não exibir a interpretação direcional.
  const isHigh = metric.value != null && metric.reference_max != null && metric.value > metric.reference_max;
  const isLow = metric.value != null && metric.reference_min != null && metric.value < metric.reference_min;
  const meaning = isHigh ? explanation?.high_means : isLow ? explanation?.low_means : undefined;
  const action = isHigh ? explanation?.actions_high : isLow ? explanation?.actions_low : undefined;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: mark }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{explanation?.metric_name ?? metric.name}</p>
          <p className="text-xs text-muted">
            {metric.value ?? '—'} {metric.unit ?? ''}
            {metric.reference_min != null && metric.reference_max != null && (
              <span className="text-faint"> · ref {metric.reference_min}–{metric.reference_max}</span>
            )}
          </p>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-caption font-semibold"
          style={{ background: tint, color: ink }}
        >
          {meta.label}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}>
            <div className="space-y-3 border-t border-line px-4 py-4 text-sm">
              {explanation ? (
                <>
                  <Field label="O que mede" text={explanation.what_measures} />
                  <Field label="Por que importa" text={explanation.why_matters} />
                  {meta.tone !== 'ok' && meaning && <Field label="O que pode significar" text={meaning} />}
                  {meta.tone !== 'ok' && action && <Field label="Converse com seu médico" text={action} accent />}
                </>
              ) : (
                <p className="text-xs text-muted">Explicação educativa indisponível para esta métrica.</p>
              )}
              <div>
                <p className="mb-1 text-xs font-medium text-muted">Evolução</p>
                <MetricEvolutionChart history={history ?? []} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 leading-relaxed ${accent ? 'text-primary' : 'text-fg-soft'}`}>{text}</p>
    </div>
  );
}
