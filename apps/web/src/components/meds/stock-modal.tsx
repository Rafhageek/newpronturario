'use client';

import { useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Medication } from '@hubpatients/core';
import { formatStockStatus } from '@hubpatients/core';
import { useUpdateStock, useMarkRefill } from '@hubpatients/supabase';
import { Button, Field, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

export function StockModal({
  open,
  onClose,
  medication,
  patientId,
}: {
  open: boolean;
  onClose: () => void;
  medication: Medication;
  patientId: string;
}) {
  const update = useUpdateStock(patientId, medication.id);
  const refill = useMarkRefill(patientId, medication.id);

  const [tracking, setTracking] = useState(medication.stock_count != null);
  const [count, setCount] = useState(medication.stock_count?.toString() ?? '');
  const [unit, setUnit] = useState(medication.stock_unit ?? 'comprimidos');
  const [packageSize, setPackageSize] = useState(medication.package_size?.toString() ?? '');
  const [threshold, setThreshold] = useState(String(medication.stock_low_threshold_days ?? 5));
  const [refillQty, setRefillQty] = useState('');

  async function save() {
    try {
      await update.mutateAsync({
        stockCount: tracking ? Number(count || 0) : null,
        stockUnit: unit || 'comprimidos',
        packageSize: packageSize ? Number(packageSize) : null,
        stockLowThresholdDays: Number(threshold || 5),
      });
      toast.success(tracking ? 'Estoque atualizado.' : 'Controle de estoque desativado.');
      onClose();
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  async function doRefill(units: number) {
    if (!units || units <= 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }
    try {
      await refill.mutateAsync(units);
      toast.success('Estoque reposto. 👍');
      onClose();
    } catch {
      toast.error('Não foi possível repor.');
    }
  }

  const pkg = Number(packageSize) || 0;

  return (
    <Modal open={open} onClose={onClose} title="Controle de estoque" className="max-w-md">
      <p className="-mt-1 text-sm font-medium text-fg">{medication.name}</p>
      <p className="text-xs text-muted">{formatStockStatus(medication)}</p>

      {/* Reposição rápida (só quando já rastreia) */}
      {medication.stock_count != null && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-fg">
            <Package className="h-4 w-4 text-primary" /> Comprei mais
          </p>
          <div className="flex flex-wrap items-end gap-2">
            {pkg > 0 && (
              <button
                onClick={() => doRefill(pkg)}
                disabled={refill.isPending}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-sky-500/15 px-3.5 text-sm font-semibold text-primary hover:bg-sky-500/25"
              >
                <Plus className="h-4 w-4" /> 1 caixa ({pkg})
              </button>
            )}
            <label className="text-xs text-muted">
              Ou quantidade
              <input
                type="number"
                inputMode="numeric"
                value={refillQty}
                onChange={(e) => setRefillQty(e.target.value)}
                className="mt-1 block h-11 w-28 rounded-xl border border-line bg-surface px-3 text-sm text-fg"
              />
            </label>
            <button
              onClick={() => doRefill(Number(refillQty))}
              disabled={refill.isPending}
              className="inline-flex h-11 items-center rounded-xl border border-line px-3.5 text-sm font-semibold text-fg-soft hover:bg-surface-2"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Configuração do estoque */}
      <div className="mt-4 space-y-4">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-fg">Acompanhar o estoque deste medicamento</span>
          <button
            role="switch"
            aria-checked={tracking}
            onClick={() => setTracking((t) => !t)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${tracking ? 'bg-primary' : 'bg-muted/40'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${tracking ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </label>

        {tracking && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantos você tem agora?" htmlFor="st-count">
              <Input id="st-count" type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Ex.: 30" />
            </Field>
            <Field label="Unidade" htmlFor="st-unit">
              <Input id="st-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="comprimidos" />
            </Field>
            <Field label="Quantos vêm na caixa?" htmlFor="st-pkg">
              <Input id="st-pkg" type="number" inputMode="numeric" value={packageSize} onChange={(e) => setPackageSize(e.target.value)} placeholder="Ex.: 30" />
            </Field>
            <Field label="Avisar faltando quantos dias?" htmlFor="st-th">
              <Input id="st-th" type="number" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">
          Fechar
        </button>
        <Button onClick={save} disabled={update.isPending}>{update.isPending ? 'Salvando…' : 'Salvar'}</Button>
      </div>
    </Modal>
  );
}
