'use client';

import { HeartPulse } from 'lucide-react';
import type { ExamMetric } from '@vidalog/core';
import { normalizeMetricKey, THEMATIC_PANELS } from '@vidalog/core';

const TONE = { ok: '#10B981', attention: '#F59E0B', alert: '#EF4444' } as const;

function worstTone(metrics: ExamMetric[]): keyof typeof TONE {
  if (metrics.some((m) => m.flag === 'alert')) return 'alert';
  if (metrics.some((m) => m.flag === 'attention')) return 'attention';
  return 'ok';
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
        const tone = worstTone(matched);
        const color = TONE[tone];
        return (
          <div key={panel.key} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4" style={{ color }} />
                <p className="text-sm font-semibold text-fg">{panel.label}</p>
              </div>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
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
