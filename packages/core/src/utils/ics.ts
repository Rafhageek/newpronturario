/**
 * Geração de calendário .ics (VCALENDAR) das consultas.
 *
 * PRIVACIDADE: os eventos contêm SÓ LOGÍSTICA (médico, horário, local/telemedicina).
 * NUNCA diagnósticos, medicações ou observações clínicas — eventos viajam por
 * sync e não devem carregar dados sensíveis.
 */

export interface ICalAppointment {
  id: string;
  doctor_name: string;
  specialty?: string | null;
  scheduled_at: string; // ISO
  kind: 'in_person' | 'telehealth';
  location?: string | null;
  meeting_link?: string | null;
}

const PRODID = '-//HubPatients//Calendar v1//PT-BR';
const DEFAULT_DURATION_MIN = 60;

/** Escapa texto conforme RFC 5545 (barra, ponto-e-vírgula, vírgula, quebra de linha). */
export function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Data ISO → formato UTC do iCalendar: YYYYMMDDTHHMMSSZ. */
export function formatICSDate(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/** Dobra linhas longas (RFC 5545: ~75 octetos). Conservador em 70 chars. */
function foldLine(line: string): string {
  if (line.length <= 72) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const size = i === 0 ? 72 : 71;
    out.push((i === 0 ? '' : ' ') + line.slice(i, i + size));
    i += size;
  }
  return out.join('\r\n');
}

/** Um VEVENT (só logística). */
export function buildICalEvent(appt: ICalAppointment, stamp: Date = new Date()): string {
  const start = formatICSDate(appt.scheduled_at);
  const end = formatICSDate(new Date(new Date(appt.scheduled_at).getTime() + DEFAULT_DURATION_MIN * 60_000));

  const summary = appt.specialty
    ? `Consulta com ${appt.doctor_name} - ${appt.specialty}`
    : `Consulta com ${appt.doctor_name}`;

  const location = appt.kind === 'telehealth' ? 'Telemedicina' : appt.location || '';
  const description =
    appt.kind === 'telehealth'
      ? `Consulta por telemedicina.${appt.meeting_link ? ' Link: ' + appt.meeting_link : ''}`
      : 'Consulta presencial.';

  const lines = [
    'BEGIN:VEVENT',
    `UID:${appt.id}@hubpatients.app`,
    `DTSTAMP:${formatICSDate(stamp)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    foldLine(`SUMMARY:${escapeICS(summary)}`),
    location ? foldLine(`LOCATION:${escapeICS(location)}`) : null,
    foldLine(`DESCRIPTION:${escapeICS(description)}`),
    // Lembretes: 1 dia antes e 1 hora antes.
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete de consulta',
    'TRIGGER:-P1D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete de consulta',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
  ].filter((l): l is string => l != null);

  return lines.join('\r\n');
}

/** VCALENDAR completo com todos os eventos. */
export function buildICalString(appointments: ICalAppointment[], stamp: Date = new Date()): string {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:HubPatients — Consultas',
  ];
  const events = appointments.map((a) => buildICalEvent(a, stamp));
  return [...header, ...events, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
