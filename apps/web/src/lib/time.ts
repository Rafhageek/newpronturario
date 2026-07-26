/** Tempo relativo em pt-BR (sem dependências). */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Data de hoje no FUSO LOCAL, formato YYYY-MM-DD (não usar toISOString, que é UTC). */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * ISO (UTC) de um horário "HH:mm" agendado para HOJE no fuso local.
 * Evita o bug de registrar a dose no dia errado perto da meia-noite.
 */
export function scheduledAtToday(time: string): string {
  const hhmm = time.slice(0, 5); // normaliza "HH:mm:ss" -> "HH:mm"
  return new Date(`${todayLocalISO()}T${hhmm}`).toISOString();
}
