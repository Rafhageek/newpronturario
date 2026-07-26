'use client';

import { HeartPulse } from 'lucide-react';
import type { ExamMetric } from '@hubpatients/core';
import { classifyExamMetric, normalizeMetricKey, THEMATIC_PANELS } from '@hubpatients/core';
import { statusLabel, statusVars, type StatusKind } from '@/components/ui/status-chip';

/**
 * Tom do painel → papel de status do sistema (ver `ui/status-chip.tsx`).
 * O semáforo cru (`#10B981 / #F59E0B / #EF4444`) reprovava em AA e não existia
 * no tema escuro.
 */
const TONE = {
  ok: 'ok',
  attention: 'attention',
  alert: 'alert',
  neutral: 'neutro',
} as const satisfies Record<string, StatusKind>;

function worstTone(metrics: ExamMetric[]): keyof typeof TONE {
  const classifications = metrics.map(classifyExamMetric);
  if (classifications.includes('alert')) return 'alert';
  if (classifications.includes('attention')) return 'attention';
  if (classifications.includes('ok')) return 'ok';
  return 'neutral';
}

export function ThematicPanels({ metrics }: { metrics: ExamMetric[] }) {
  const panels = THEMATIC_PANELS.map((panel) => {
    const matched = metrics.filter((m) => panel.metricKeys.includes(normalizeMetricKey(m.metric_code ?? m.name)));
    return { panel, matched };
  }).filter((p) => p.matched.length > 0);

  if (panels.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {panels.map(({ panel, matched }) => {
        const kind = TONE[worstTone(matched)];
        const { ink, mark } = statusVars(kind);
        return (
          <div key={panel.key} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4" style={{ color: ink }} aria-hidden="true" />
                <p className="text-sm font-semibold text-fg">{panel.label}</p>
              </div>
              {/* O ponto sozinho seria cor-sem-texto (SC 1.4.1): o rótulo vai
                  junto, visível para leitor de tela. */}
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: mark }} />
              <span className="sr-only">{statusLabel(kind)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {matched.map((m) => (
                <span key={m.id} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-soft">
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
