import { describe, it, expect } from 'vitest';
import { escapeICS, formatICSDate, buildICalEvent, buildICalString, type ICalAppointment } from './ics';

const STAMP = new Date('2026-06-01T00:00:00Z');

const presencial: ICalAppointment = {
  id: 'a1',
  doctor_name: 'Dra. Ana',
  specialty: 'Cardiologia',
  scheduled_at: '2026-06-10T13:30:00Z',
  kind: 'in_person',
  location: 'Clínica Vida, Rua X, 100',
};
const tele: ICalAppointment = {
  id: 'a2',
  doctor_name: 'Dr. João',
  scheduled_at: '2026-06-11T18:00:00Z',
  kind: 'telehealth',
  meeting_link: 'https://meet.example/abc',
};

describe('escapeICS', () => {
  it('escapa vírgula, ponto-e-vírgula, barra e quebra de linha', () => {
    expect(escapeICS('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
  });
});

describe('formatICSDate', () => {
  it('formata em UTC YYYYMMDDTHHMMSSZ', () => {
    expect(formatICSDate('2026-06-10T13:30:00Z')).toBe('20260610T133000Z');
  });
});

describe('buildICalEvent', () => {
  it('consulta presencial: summary com especialidade, location e duração de 1h', () => {
    const ev = buildICalEvent(presencial, STAMP);
    expect(ev).toContain('UID:a1@hubpatients.app');
    expect(ev).toContain('SUMMARY:Consulta com Dra. Ana - Cardiologia');
    expect(ev).toContain('DTSTART:20260610T133000Z');
    expect(ev).toContain('DTEND:20260610T143000Z'); // +60min
    expect(ev).toContain('LOCATION:Clínica Vida\\, Rua X\\, 100');
    expect(ev).toContain('DESCRIPTION:Consulta presencial.');
    expect(ev).toContain('TRIGGER:-P1D');
    expect(ev).toContain('TRIGGER:-PT1H');
  });

  it('telemedicina: location "Telemedicina" e link na descrição', () => {
    const ev = buildICalEvent(tele, STAMP);
    expect(ev).toContain('LOCATION:Telemedicina');
    expect(ev).toContain('DESCRIPTION:Consulta por telemedicina. Link: https://meet.example/abc');
  });

  it('sem especialidade: summary só com o médico', () => {
    const ev = buildICalEvent({ ...presencial, specialty: null }, STAMP);
    expect(ev).toContain('SUMMARY:Consulta com Dra. Ana');
    expect(ev).not.toContain(' - ');
  });

  it('NÃO vaza dados clínicos: notas/diagnósticos nunca entram', () => {
    const ev = buildICalEvent(
      { ...presencial, ...({ notes: 'suspeita de arritmia', condition: 'hipertensão' } as object) },
      STAMP,
    );
    expect(ev).not.toContain('arritmia');
    expect(ev).not.toContain('hipertensão');
  });
});

describe('buildICalString', () => {
  it('VCALENDAR válido com header e os eventos', () => {
    const cal = buildICalString([presencial, tele], STAMP);
    expect(cal).toContain('BEGIN:VCALENDAR');
    expect(cal).toContain('VERSION:2.0');
    expect(cal).toContain('PRODID:-//HubPatients//Calendar v1//PT-BR');
    expect(cal.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(cal.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(cal).toContain('\r\n'); // CRLF
  });

  it('agenda vazia: VCALENDAR sem eventos', () => {
    const cal = buildICalString([], STAMP);
    expect(cal).toContain('BEGIN:VCALENDAR');
    expect(cal).not.toContain('BEGIN:VEVENT');
  });
});
