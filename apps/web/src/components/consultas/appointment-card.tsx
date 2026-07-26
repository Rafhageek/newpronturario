'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, CalendarPlus, ChevronDown, MapPin, Paperclip, Stethoscope, Video } from 'lucide-react';
import type { Appointment, Exam, UpdateRow } from '@hubpatients/core';
import { APPOINTMENT_KIND_LABELS, APPOINTMENT_STATUS_LABELS } from '@hubpatients/core';
import { confirmAction } from '@/lib/confirm';
import { downloadAppointmentIcs } from '@/lib/ics-download';
import { statusVars, type StatusKind } from '@/components/ui/status-chip';

/**
 * Situação da consulta → papel de status do sistema. As cores fixas anteriores
 * (`#38BDF8` 2,9:1 · `#10B981` 2,41:1 · `#94A3B8` 2,1:1) reprovavam em texto no
 * tema claro e não mudavam no escuro.
 */
const STATUS_TONE = {
  scheduled: 'info',
  completed: 'ok',
  cancelled: 'neutro',
} as const satisfies Record<string, StatusKind>;

export function AppointmentCard({
  appointment,
  exams,
  onUpdate,
}: {
  appointment: Appointment;
  exams: Exam[];
  onUpdate: (patch: UpdateRow<'appointments'>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(appointment.notes ?? '');
  const tone = statusVars(STATUS_TONE[appointment.status]);
  const when = new Date(appointment.scheduled_at);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-fg">
            {appointment.doctor_name}
            {appointment.doctor_crm && <span className="ml-1.5 text-xs font-normal text-muted">CRM {appointment.doctor_crm}</span>}
          </p>
          <p className="text-xs text-muted">{appointment.specialty ?? 'Consulta'}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              {appointment.kind === 'telehealth' ? <Video className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
              {when.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span>· {APPOINTMENT_KIND_LABELS[appointment.kind]}</span>
            {appointment.location && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {appointment.location}</span>
            )}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-caption font-semibold"
          style={{ color: tone.ink, background: tone.tint }}
        >
          {APPOINTMENT_STATUS_LABELS[appointment.status]}
        </span>
      </div>

      {/* Ações */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {appointment.kind === 'telehealth' && appointment.meeting_link && appointment.status === 'scheduled' && (
          // Era um degradê sky→cyan com texto branco: 2,9:1 na ponta clara.
          <a href={appointment.meeting_link} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
            <Video className="h-4 w-4" /> Entrar na chamada
          </a>
        )}
        {appointment.status === 'scheduled' && (
          <>
            <button onClick={() => onUpdate({ status: 'completed' })} className="h-9 rounded-xl bg-status-ok-tint px-3 text-xs font-semibold text-status-ok-ink hover:brightness-95">Marcar realizada</button>
            <button onClick={() => downloadAppointmentIcs(appointment)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs text-fg-soft hover:bg-surface-2" aria-label="Adicionar esta consulta à agenda do celular">
              <CalendarPlus className="h-3.5 w-3.5" /> Adicionar à agenda
            </button>
            <button onClick={() => { if (confirmAction('Cancelar esta consulta?')) onUpdate({ status: 'cancelled' }); }} className="h-9 rounded-xl border border-line px-3 text-xs text-fg-soft hover:bg-surface-2">Cancelar</button>
          </>
        )}
        <button onClick={() => setOpen((o) => !o)} className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
          Pós-consulta <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">Anotações da consulta</p>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-line-strong bg-surface-2 p-3 text-sm text-fg placeholder:text-muted focus:border-primary focus:outline-none" placeholder="O que o médico orientou, próximos passos…" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <Paperclip className="h-3.5 w-3.5" /> Exame:
                  <select
                    value={appointment.exam_id ?? ''}
                    onChange={(e) => onUpdate({ exam_id: e.target.value || null })}
                    className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs text-fg"
                  >
                    <option value="">Nenhum</option>
                    {exams.map((ex) => (<option key={ex.id} value={ex.id}>{ex.title}</option>))}
                  </select>
                </label>
                <button onClick={() => onUpdate({ notes: notes || null })} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-status-info-tint px-3.5 text-xs font-semibold text-status-info-ink hover:brightness-95">
                  <Stethoscope className="h-3.5 w-3.5" /> Salvar anotações
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
