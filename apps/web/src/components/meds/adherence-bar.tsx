'use client';

import { motion } from 'framer-motion';

/** Barra de adesão dos últimos 7 dias (% de tomadas/previstas), animada. */
export function AdherenceBar({ percent }: { percent: number | null }) {
  if (percent == null) {
    return <p className="text-xs text-muted">Sem horários definidos para calcular adesão.</p>;
  }
  const color = percent >= 80 ? '#10B981' : percent >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">Adesão · 7 dias</span>
        <span className="font-semibold" style={{ color }}>{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
