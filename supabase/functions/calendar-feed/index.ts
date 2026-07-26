// ============================================================================
// HubPatients — Edge Function: calendar-feed
//
// Serve um calendário .ics AO VIVO das consultas de um usuário, identificado
// por um TOKEN secreto na query (?token=UUID). Rota pública (o token é a chave).
//
// Segurança: NÃO usa service_role. Lê via a RPC `calendar_feed` (SECURITY
// DEFINER, estreita) com a ANON key — a RPC só devolve LOGÍSTICA e só quando o
// usuário habilitou o sync. Eventos NUNCA contêm diagnósticos/medicações.
//
// Deploy: supabase functions deploy calendar-feed --no-verify-jwt
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const PRODID = '-//HubPatients//Calendar v1//PT-BR';

interface FeedRow {
  id: string;
  doctor_name: string;
  specialty: string | null;
  scheduled_at: string;
  kind: 'in_person' | 'telehealth';
  location: string | null;
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function fmt(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

function vevent(a: FeedRow, stamp: Date): string {
  const start = fmt(a.scheduled_at);
  const end = fmt(new Date(new Date(a.scheduled_at).getTime() + 60 * 60_000));
  const summary = a.specialty
    ? `Consulta com ${a.doctor_name} - ${a.specialty}`
    : `Consulta com ${a.doctor_name}`;
  const location = a.kind === 'telehealth' ? 'Telemedicina' : a.location || '';
  // Privacidade: o link de teleconsulta NÃO vai no feed (poderia vazar acesso a
  // uma sala de consulta). O usuário abre o link pelo app.
  const description =
    a.kind === 'telehealth'
      ? 'Consulta por telemedicina. Abra o link com segurança pelo app HubPatients.'
      : 'Consulta presencial.';
  return [
    'BEGIN:VEVENT',
    `UID:${a.id}@hubpatients.app`,
    `DTSTAMP:${fmt(stamp)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(summary)}`,
    location ? `LOCATION:${escapeICS(location)}` : null,
    `DESCRIPTION:${escapeICS(description)}`,
    'BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Lembrete de consulta\r\nTRIGGER:-P1D\r\nEND:VALARM',
    'BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Lembrete de consulta\r\nTRIGGER:-PT1H\r\nEND:VALARM',
    'END:VEVENT',
  ]
    .filter((l): l is string => l != null)
    .join('\r\n');
}

function buildCalendar(rows: FeedRow[]): string {
  const stamp = new Date();
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:${PRODID}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:HubPatients — Consultas',
      ...rows.map((r) => vevent(r, stamp)),
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n'
  );
}

// Formato do token (UUID) — rejeita lixo antes de tocar o banco.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rate limit best-effort por token (instância de edge é efêmera; é uma barreira
// contra varredura/abuso, não um limite global forte).
const RL = new Map<string, { count: number; reset: number }>();
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
function rateLimited(token: string): boolean {
  const now = Date.now();
  const e = RL.get(token);
  if (!e || now > e.reset) {
    RL.set(token, { count: 1, reset: now + RL_WINDOW_MS });
    return false;
  }
  e.count += 1;
  return e.count > RL_MAX;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  // Dados de saúde: nunca cachear em proxies/CDN. Privado e sem store.
  const headers = {
    'content-type': 'text/calendar; charset=utf-8',
    'content-disposition': 'inline; filename="hubpatients.ics"',
    'Cache-Control': 'private, no-store, max-age=0',
  };

  // Token ausente ou malformado → erro genérico (não logamos o token).
  if (!token || !UUID_RE.test(token)) {
    return new Response('Token ausente ou inválido.', { status: 400 });
  }

  if (rateLimited(token)) {
    return new Response('Muitas requisições.', { status: 429, headers });
  }

  try {
    const supabase = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await supabase.rpc('calendar_feed', { p_token: token });
    if (error) {
      // Token inválido/desabilitado → calendário vazio (não vaza existência).
      return new Response(buildCalendar([]), { headers });
    }
    return new Response(buildCalendar((data ?? []) as FeedRow[]), { headers });
  } catch {
    return new Response(buildCalendar([]), { headers });
  }
});
