'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { appointmentSchema, type AppointmentInput, APPOINTMENT_KIND_LABELS, REMINDER_OPTIONS } from '@vidalog/core';
import { useAppointmentMutations } from '@vidalog/supabase';
import { Button, Field, Input } from '@/components/ui';

export function NewAppointmentModal({ open, onClose, patientId }: { open: boolean; onClose: () => void; patientId: string }) {
  const { create } = useAppointmentMutations(patientId);
  const [reminders, setReminders] = useState<number[]>([1440, 60]);
  const [kind, setKind] = useState<'in_person' | 'telehealth'>('in_person');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AppointmentInput>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { kind: 'in_person' },
  });

  async function onSubmit(values: AppointmentInput) {
    try {
      await create.mutateAsync({
        patient_id: patientId,
        doctor_name: values.doctorName,
        doctor_crm: values.doctorCrm || null,
        specialty: values.specialty || null,
        scheduled_at: values.scheduledAt.toISOString(),
        kind: values.kind,
        location: values.location || null,
        meeting_link: values.meetingLink || null,
        reminders,
        notes: values.notes || null,
      });
      toast.success('Consulta agendada.');
      reset();
      setReminders([1440, 60]);
      onClose();
    } catch {
      toast.error('Não foi possível agendar.');
    }
  }

  function toggleReminder(m: number) {
    setReminders((r) => (r.includes(m) ? r.filter((x) => x !== m) : [...r, m]));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl"
            initial={{ scale: 0.95, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }}>
            <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar"><X className="h-4 w-4" /></button>
            <h2 className="mb-4 text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Nova consulta</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Médico" htmlFor="a-doc" error={errors.doctorName?.message}><Input id="a-doc" {...register('doctorName')} placeholder="Dra. Ana" /></Field>
                <Field label="CRM" htmlFor="a-crm"><Input id="a-crm" {...register('doctorCrm')} /></Field>
                <Field label="Especialidade" htmlFor="a-spec"><Input id="a-spec" {...register('specialty')} placeholder="Cardiologia" /></Field>
                <Field label="Tipo" htmlFor="a-kind">
                  <select id="a-kind" {...register('kind')} onChange={(e) => setKind(e.target.value as 'in_person' | 'telehealth')} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
                    {Object.entries(APPOINTMENT_KIND_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </Field>
                <Field label="Data e hora" htmlFor="a-when" error={errors.scheduledAt?.message}><Input id="a-when" type="datetime-local" {...register('scheduledAt')} /></Field>
                {kind === 'telehealth' ? (
                  <Field label="Link da chamada" htmlFor="a-link" error={errors.meetingLink?.message}><Input id="a-link" {...register('meetingLink')} placeholder="https://meet…" /></Field>
                ) : (
                  <Field label="Local" htmlFor="a-loc"><Input id="a-loc" {...register('location')} placeholder="Clínica / endereço" /></Field>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-fg-soft">Lembrete <span className="text-xs font-normal text-muted">(envio na Fase 4)</span></p>
                <div className="flex flex-wrap gap-2">
                  {REMINDER_OPTIONS.map((o) => (
                    <button key={o.minutes} type="button" onClick={() => toggleReminder(o.minutes)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${reminders.includes(o.minutes) ? 'border-sky-400/40 bg-sky-500/20 text-primary' : 'border-line text-muted hover:bg-surface-2'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Observações" htmlFor="a-notes"><Input id="a-notes" {...register('notes')} /></Field>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">Cancelar</button>
                <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Agendando…' : 'Agendar'}</Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
