'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { useAppointments, useAppointmentMutations, useExams } from '@hubpatients/supabase';
import { useActiveProfile } from '@/components/profile-context';
import { AppointmentCard } from '@/components/consultas/appointment-card';
import { NewAppointmentModal } from '@/components/consultas/new-appointment-modal';
import { ClinicalReportButton } from '@/components/clinical/report-button';
import { PageHeader } from '@/components/ui/painel';

export default function ConsultasPage() {
  const { patientId } = useActiveProfile();
  const { data: appointments, isLoading } = useAppointments(patientId || undefined);
  const { data: exams } = useExams(patientId || undefined);
  const { update } = useAppointmentMutations(patientId);

  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [modalOpen, setModalOpen] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: typeof appointments = [];
    const pa: typeof appointments = [];
    (appointments ?? []).forEach((a) => {
      if (a.status === 'scheduled' && new Date(a.scheduled_at).getTime() >= now) up!.push(a);
      else pa!.push(a);
    });
    return { upcoming: up ?? [], past: pa ?? [] };
  }, [appointments]);

  const shown = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="mx-auto max-w-5xl space-y-5 hp-page">
      <PageHeader
        eyebrow="Jornada de cuidado"
        title="Consultas"
        subtitle="Prepare o que levar, acompanhe próximos compromissos e mantenha o histórico reunido."
        icon={CalendarDays}
        tone="indigo"
        right={<button type="button" onClick={() => setModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90">
          <Plus className="h-4 w-4" /> Nova consulta
        </button>}
      />

      {/* Levar os registros para a consulta é o passo mais útil desta tela —
          por isso fica antes da lista, não escondido em um menu. */}
      <ClinicalReportButton patientId={patientId} />

      <div className="flex w-fit rounded-xl border border-line bg-surface p-1">
        <Tab active={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Próximas ({upcoming.length})</Tab>
        <Tab active={tab === 'past'} onClick={() => setTab('past')}>Passadas ({past.length})</Tab>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : shown.length > 0 ? (
        <div className="space-y-3">
          {shown.map((a) => (
            <AppointmentCard key={a.id} appointment={a} exams={exams ?? []} onUpdate={(patch) => update.mutate({ id: a.id, patch })} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line py-16 text-center">
          <CalendarDays className="h-8 w-8 text-faint" />
          <p className="mt-3 text-sm text-muted">{tab === 'upcoming' ? 'Nenhuma consulta agendada.' : 'Nenhuma consulta passada.'}</p>
        </div>
      )}

      <NewAppointmentModal open={modalOpen} onClose={() => setModalOpen(false)} patientId={patientId} />
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${active ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'}`}>
      {children}
    </button>
  );
}
