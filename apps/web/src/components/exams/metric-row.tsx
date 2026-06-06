'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { ExamMetric, ExamMetricExplanation } from '@vidalog/core';
import { METRIC_FLAG } from '@vidalog/core';
import { useMetricHistory } from '@vidalog/supabase';
import { MetricEvolutionChart } from './metric-evolution-chart';

const TONE_COLOR = { ok: '#10B981', attention: '#F59E0B', alert: '#EF4444' } as const;

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

  const meta = METRIC_FLAG[metric.flag];
  const color = TONE_COLOR[meta.tone];
  const isHigh = metric.reference_max != null && metric.value != null && metric.value > metric.reference_max;
  const meaning = isHigh ? explanation?.high_means : explanation?.low_means;
  const action = isHigh ? explanation?.actions_high : explanation?.actions_low;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{explanation?.metric_name ?? metric.name}</p>
          <p className="text-xs text-muted">
            {metric.value ?? '—'} {metric.unit ?? ''}
            {metric.reference_min != null && metric.reference_max != null && (
              <span className="text-faint"> · ref {metric.reference_min}–{metric.reference_max}</span>
            )}
          </p>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${color}1f`, color }}>
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
