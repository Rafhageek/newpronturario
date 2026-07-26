'use client';

import { motion } from 'framer-motion';
import { statusVars, type StatusKind } from '@/components/ui/status-chip';

/**
 * Barra de adesão dos últimos 7 dias (% de tomadas/previstas), animada.
 *
 * Aqui o semáforo É legítimo: adesão é uma medida do SISTEMA (tomou / não tomou
 * o remédio), não uma leitura do corpo do paciente. O que estava errado eram as
 * cores — `#10B981 / #F59E0B / #EF4444` davam 2,41 / 2,04 / 3,57:1 no percentual
 * em texto. Agora o número usa o `ink` do status e a barra usa o `mark`.
 */
export function AdherenceBar({ percent }: { percent: number | null }) {
  if (percent == null) {
    return <p className="text-xs text-muted">Sem horários definidos para calcular adesão.</p>;
  }
  const kind: StatusKind = percent >= 80 ? 'ok' : percent >= 50 ? 'attention' : 'alert';
  const { ink, mark } = statusVars(kind);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">Adesão · 7 dias</span>
        <span className="font-semibold" style={{ color: ink }}>{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <motion.div
          className="h-full rounded-full"
          style={{ background: mark }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
