'use client';

import { QrCode } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

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
    <Modal
      open={open}
      onClose={onClose}
      title="Cartão de Emergência"
      description="Acesso rápido a dados vitais (gratuito, sempre)."
      className="max-w-sm"
    >
      <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl border-2 border-dashed border-line bg-surface-2">
        <QrCode className="h-20 w-20 text-muted" />
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">QR público chega na Fase 5</p>

      <div className="mt-5 space-y-1.5 rounded-xl border border-line bg-surface p-4 text-left text-sm">
        <Row label="Nome" value={name} />
        <Row label="Tipo sanguíneo" value={bloodType && bloodType !== 'unknown' ? bloodType : '—'} />
        <Row label="Alergias graves" value={allergies.length ? allergies.join(', ') : 'Nenhuma'} alert={allergies.length > 0} />
      </div>
    </Modal>
  );
}

function Row({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={`text-right font-medium ${alert ? 'text-rose-700 dark:text-rose-300' : 'text-fg'}`}>{value}</span>
    </div>
  );
}
