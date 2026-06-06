'use client';

import { Check, Clock, Stethoscope } from 'lucide-react';
import type { Medication, MedicationIntake } from '@vidalog/core';
import { computeAdherence, MEDICATION_FREQUENCY_LABELS, MEDICATION_FORM_LABELS } from '@vidalog/core';
import { AdherenceBar } from './adherence-bar';

export function MedicationCard({
  medication,
  intakes,
  onRegister,
}: {
  medication: Medication;
  intakes: MedicationIntake[];
  onRegister: (time: string) => void;
  registering?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);

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
                      ? 'cursor-default bg-emerald-500/15 text-emerald-300'
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
    </div>
  );
}
