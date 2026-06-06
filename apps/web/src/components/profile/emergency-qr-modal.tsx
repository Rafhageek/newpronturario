'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { QrCode, X } from 'lucide-react';

export function EmergencyQrModal({
  open,
  onClose,
  name,
  bloodType,
  allergies,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  bloodType?: string | null;
  allergies: string[];
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface p-6 text-center shadow-2xl"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
              Cartão de Emergência
            </h2>
            <p className="mt-1 text-xs text-muted">Acesso rápido a dados vitais (gratuito, sempre).</p>

            <div className="mx-auto mt-5 flex h-44 w-44 items-center justify-center rounded-2xl border-2 border-dashed border-line bg-surface-2">
              <QrCode className="h-20 w-20 text-muted" />
            </div>
            <p className="mt-2 text-[11px] text-muted">QR público chega na Fase 5</p>

            <div className="mt-5 space-y-1.5 rounded-xl border border-line bg-surface p-4 text-left text-sm">
              <Row label="Nome" value={name} />
              <Row label="Tipo sanguíneo" value={bloodType && bloodType !== 'unknown' ? bloodType : '—'} />
              <Row label="Alergias graves" value={allergies.length ? allergies.join(', ') : 'Nenhuma'} alert={allergies.length > 0} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={`text-right font-medium ${alert ? 'text-rose-300' : 'text-fg'}`}>{value}</span>
    </div>
  );
}
