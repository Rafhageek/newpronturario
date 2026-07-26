'use client';

import { AlertTriangle } from 'lucide-react';
import { weightAlert } from '@hubpatients/core';
import { statusVars } from '@/components/ui/status-chip';

/**
 * Red-flag gentil de peso (retenção de líquido / perda não intencional).
 *
 * Cor vem dos tokens de status (papel `attention`), não do `amber-500` do
 * Tailwind: aquele dava 2,04:1 — o pior contraste de toda a paleta antiga. Com
 * `ink #895b00` sobre `tint #fff2e2` são 5,35:1, e o ícone + o texto carregam o
 * significado sozinhos caso a cor não chegue (SC 1.4.1).
 */
export function WeightAlertBanner({ weights }: { weights: { date: string; kg: number }[] }) {
  const a = weightAlert(weights);
  if (!a.kind) return null;
  const { ink, mark, tint } = statusVars('attention');
  return (
    <div
      className="mb-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-body-sm"
      style={{ color: ink, borderColor: mark, backgroundColor: tint }}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{a.message}</span>
    </div>
  );
}
