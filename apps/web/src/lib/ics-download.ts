import { buildICalString, type Appointment, type ICalAppointment } from '@hubpatients/core';

/** Baixa um .ics de uma consulta única (abre no Google/Apple/Outlook). */
export function downloadAppointmentIcs(a: Appointment): void {
  const ical: ICalAppointment = {
    id: a.id,
    doctor_name: a.doctor_name,
    specialty: a.specialty,
    scheduled_at: a.scheduled_at,
    kind: a.kind,
    location: a.location,
    meeting_link: a.meeting_link,
  };
  const blob = new Blob([buildICalString([ical])], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `consulta-${a.id.slice(0, 8)}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
