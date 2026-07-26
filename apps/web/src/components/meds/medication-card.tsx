'use client';

import { Check, Clock, FileText, Package, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import type { Medication, MedicationIntake } from '@hubpatients/core';
import {
  computeAdherence,
  MEDICATION_FREQUENCY_LABELS,
  MEDICATION_FORM_LABELS,
  formatStockStatus,
  daysRemainingForMed,
  resolveBulaUrl,
  ANVISA_EXIT_NOTICE,
} from '@hubpatients/core';
import { AdherenceBar } from './adherence-bar';

function openBula(medication: Medication) {
  toast.info(ANVISA_EXIT_NOTICE);
  window.open(resolveBulaUrl(medication), '_blank', 'noopener,noreferrer');
}

export function MedicationCard({
  medication,
  intakes,
  onRegister,
  onStock,
}: {
  medication: Medication;
  intakes: MedicationIntake[];
  onRegister: (time: string) => void;
  onStock?: () => void;
  registering?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const stockDays = daysRemainingForMed(medication);
  const stockUrgent =
    medication.stock_count != null && stockDays != null && stockDays <= medication.stock_low_threshold_days;

  // adesão 7 dias
  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const takenLast7 = intakes.filter((i) => i.status === 'taken' && i.taken_at && new Date(i.taken_at) >= sevenAgo).length;
  const expected = medication.times.length * 7;
  const adherence = computeAdherence(takenLast7, expected);

  // dose tomada hoje neste horário?
  const takenToday = (time: string) =>
    intakes.some(
      (i) => i.status === 'taken' && i.scheduled_for?.slice(0, 10) === today && i.scheduled_for?.slice(11, 16) === time,
    );

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-fg">
            {medication.name}
            {medication.dosage && <span className="ml-1.5 text-sm font-normal text-muted">{medication.dosage}{medication.unit ?? ''}</span>}
          </p>
          <p className="text-xs text-muted">
            {MEDICATION_FREQUENCY_LABELS[medication.frequency]} · {MEDICATION_FORM_LABELS[medication.form]}
          </p>
          {medication.prescriber && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
              <Stethoscope className="h-3 w-3" /> {medication.prescriber}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <AdherenceBar percent={adherence} />
      </div>

      {/* Estoque */}
      <div
        className={`mt-3 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
          stockUrgent ? 'border-rose-500/40 bg-rose-500/10' : 'border-line bg-surface-2'
        }`}
      >
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            stockUrgent ? 'text-rose-700 dark:text-rose-300' : 'text-fg-soft'
          }`}
        >
          <Package className="h-3.5 w-3.5" /> {formatStockStatus(medication)}
        </span>
        {onStock && (
          <button
            onClick={onStock}
            className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-primary hover:bg-sky-500/15"
          >
            {medication.stock_count == null ? 'Acompanhar' : 'Comprei mais'}
          </button>
        )}
      </div>

      {medication.times.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted">Doses de hoje</p>
          <div className="flex flex-wrap gap-2">
            {medication.times.map((t) => {
              const done = takenToday(t);
              return (
                <button
                  key={t}
                  onClick={() => !done && onRegister(t)}
                  disabled={done}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    done
                      ? 'cursor-default bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-sky-500/15 text-primary hover:bg-sky-500/25'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  {t.slice(0, 5)}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted">Sem horários definidos. Adicione para registrar tomadas.</p>
      )}

      {/* Bula oficial Anvisa */}
      <div className="mt-4 border-t border-line pt-3">
        <button
          onClick={() => openBula(medication)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          aria-label={`Ver a bula de ${medication.name} no Bulário oficial da Anvisa (abre em nova aba)`}
        >
          <FileText className="h-3.5 w-3.5" /> Ver bula oficial Anvisa ↗
        </button>
      </div>
    </div>
  );
}
