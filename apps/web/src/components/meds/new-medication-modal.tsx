'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  medicationSchema,
  type MedicationInput,
  MEDICATION_UNITS,
  MEDICATION_FREQUENCY_LABELS,
} from '@vidalog/core';
import { useVidaLogClient, createMedication, queryKeys } from '@vidalog/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input } from '@/components/ui';

export function NewMedicationModal({
  open,
  onClose,
  patientId,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
}) {
  const client = useVidaLogClient();
  const qc = useQueryClient();
  const [times, setTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState('08:00');
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MedicationInput>({
    resolver: zodResolver(medicationSchema),
    defaultValues: { form: 'tablet', frequency: 'daily' },
  });

  function addTime() {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime) && !times.includes(newTime)) {
      setTimes((t) => [...t, newTime].sort());
    }
  }

  async function onSubmit(values: MedicationInput) {
    setSaving(true);
    try {
      await createMedication(client, {
        patient_id: patientId,
        name: values.name,
        dosage: values.dosage || null,
        unit: values.unit || null,
        form: values.form,
        frequency: values.frequency,
        times,
        prescriber: values.prescriber || null,
        started_at: values.startedAt ? values.startedAt.toISOString().slice(0, 10) : null,
        ended_at: values.endedAt ? values.endedAt.toISOString().slice(0, 10) : null,
        notes: values.notes || null,
        active: true,
      });
      qc.invalidateQueries({ queryKey: queryKeys.medications(patientId) });
      toast.success('Medicamento adicionado.');
      reset();
      setTimes([]);
      onClose();
    } catch {
      toast.error('Não foi possível adicionar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl"
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
            <h2 className="mb-4 text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Novo medicamento</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Field label="Nome" htmlFor="m-name" error={errors.name?.message}>
                <Input id="m-name" {...register('name')} placeholder="Ex.: Losartana" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Dose" htmlFor="m-dose"><Input id="m-dose" {...register('dosage')} placeholder="50" /></Field>
                <Field label="Unidade" htmlFor="m-unit">
                  <select id="m-unit" {...register('unit')} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
                    <option value="">—</option>
                    {MEDICATION_UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
                  </select>
                </Field>
                <Field label="Frequência" htmlFor="m-freq">
                  <select id="m-freq" {...register('frequency')} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
                    {Object.entries(MEDICATION_FREQUENCY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </Field>
                <Field label="Médico prescritor" htmlFor="m-presc"><Input id="m-presc" {...register('prescriber')} /></Field>
              </div>

              {/* Horários */}
              <div>
                <p className="mb-1.5 text-sm font-medium text-fg-soft">Horários</p>
                <div className="flex items-center gap-2">
                  <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg" />
                  <button type="button" onClick={addTime} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm text-fg-soft hover:bg-surface-2">
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>
                {times.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {times.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs text-primary">
                        {t}
                        <button type="button" onClick={() => setTimes((arr) => arr.filter((x) => x !== t))} aria-label="Remover"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Início" htmlFor="m-start"><Input id="m-start" type="date" {...register('startedAt')} /></Field>
                <Field label="Fim (opcional)" htmlFor="m-end"><Input id="m-end" type="date" {...register('endedAt')} /></Field>
              </div>
              <Field label="Observações" htmlFor="m-notes"><Input id="m-notes" {...register('notes')} /></Field>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">Cancelar</button>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Adicionar'}</Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
