// ============================================================================
// HubPatients — Edge Function: clinical-report
//
// Gera um RESUMO IMPRIMÍVEL (HTML A4, 1 página) dos registros do paciente para
// levar à consulta. O usuário salva em PDF pelo próprio navegador (Ctrl+P /
// ⌘+P) — não instalamos biblioteca de PDF: menos dependência, menos superfície
// de ataque e resultado mais confiável em qualquer aparelho.
//
// ÉTICA (inegociável): isto NÃO é laudo.
//   * Sem cabeçalho institucional, sem CRM, sem assinatura, sem carimbo.
//   * Sem interpretação clínica: nada é classificado como normal/alterado,
//     nenhuma cor de alerta, nenhuma faixa de referência, nenhum diagnóstico.
//   * Só o dado, a data e a série, exatamente como o paciente registrou.
//   * Rodapé obrigatório em toda página.
//
// SEGURANÇA
//   * NUNCA usa service_role. Usa ANON key + JWT do usuário → a RLS decide o
//     que sai (titular ou cuidador com permissão aceita).
//   * Chama `clinical_timeline` (migração 0034), que registra o acesso em
//     `audit_log` — é a trilha de auditoria LGPD desta exportação.
//   * O JWT NUNCA vai na query string (apareceria em log de requisição do
//     gateway e no histórico do navegador). No mobile ele viaja no FRAGMENTO
//     (`#t=...`), que o navegador não envia ao servidor; a página de bootstrap
//     lê o fragmento, faz um POST com o header Authorization e apaga o
//     fragmento da barra de endereço.
//   * Nada de PHI é logado. Respostas sempre `Cache-Control: private, no-store`.
//
// USO
//   POST  /functions/v1/clinical-report            (web — header Authorization)
//         body: { patientId?, days?: 30|90, sections?: string[],
//                 print?: boolean, fragment?: boolean }
//         → text/html (documento completo, ou fragmento se fragment=true)
//   GET   /functions/v1/clinical-report#t=<jwt>&p=<patientId>&days=90&sections=a,b&print=1
//         (mobile — abre no navegador do sistema) → página de bootstrap que
//         converte o fragmento no POST acima
//
// Deploy: supabase functions deploy clinical-report --no-verify-jwt
//   (o --no-verify-jwt é necessário porque o GET do bootstrap não leva header;
//    a autenticação de verdade acontece no POST, dentro desta função.)
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TZ = 'America/Sao_Paulo';

/** Frase obrigatória — repetida no rodapé de TODA página impressa. */
const FOOTER_NOTE =
  'Dados autorreferidos pelo paciente. Não constitui laudo nem substitui avaliação profissional.';

/* ───────────────────────────── Seções ───────────────────────────── */

const SECTION_KEYS = [
  'alergias',
  'medicamentos',
  'vitais',
  'exames',
  'diario',
  'linha_do_tempo',
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const DEFAULT_SECTIONS: SectionKey[] = [
  'alergias',
  'medicamentos',
  'vitais',
  'exames',
  'diario',
];

// Limites por seção. Existem para caber em UMA página A4 com fonte ≥12pt
// (o público é idoso — legibilidade vem antes de completude). Quando corta,
// o relatório diz quantos registros ficaram de fora.
const CAP = {
  alergias: 6,
  medicamentos: 10,
  vitaisTipos: 6,
  vitaisPorTipo: 5,
  exames: 6,
  diario: 6,
  timeline: 10,
} as const;

/* ───────────────────────── Rótulos (pt-BR) ───────────────────────── */
// Inlined de propósito: Edge Functions não resolvem o workspace do monorepo
// (mesmo padrão de calendar-feed).

const VITAL_LABELS: Record<string, string> = {
  blood_pressure: 'Pressão arterial',
  glucose: 'Glicemia',
  weight: 'Peso',
  heart_rate: 'Frequência cardíaca',
  temperature: 'Temperatura',
  oxygen_saturation: 'Saturação de oxigênio',
};
const VITAL_ORDER = [
  'blood_pressure',
  'glucose',
  'weight',
  'heart_rate',
  'temperature',
  'oxygen_saturation',
];
const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'todos os dias',
  weekly: 'uma vez por semana',
  as_needed: 'se necessário',
};
const FORM_LABELS: Record<string, string> = {
  tablet: 'comprimido',
  capsule: 'cápsula',
  liquid: 'líquido',
  injection: 'injeção',
  drops: 'gotas',
  inhaler: 'inalador',
  cream: 'creme',
  other: 'outro',
};
// Gravidade é o que o PACIENTE registrou ao cadastrar a alergia — é dado,
// não classificação feita pelo app.
const SEVERITY_LABELS: Record<string, string> = {
  mild: 'leve',
  moderate: 'moderada',
  severe: 'grave',
};
const EXAM_CATEGORY_LABELS: Record<string, string> = {
  lab: 'laboratorial',
  imaging: 'imagem',
  cardio: 'cardiológico',
};

/* ─────────────────────────── Tipos das linhas ─────────────────────────── */

interface ProfileRow {
  full_name: string | null;
  date_of_birth: string | null;
}
interface AllergyRow {
  substance: string;
  severity: string;
  reaction: string | null;
}
interface MedicationRow {
  name: string;
  dosage: string | null;
  unit: string | null;
  form: string;
  frequency: string;
  times: string[] | null;
  started_at: string | null;
  prescriber: string | null;
}
interface VitalRow {
  type: string;
  measured_at: string;
  value_primary: number | string;
  value_secondary: number | string | null;
  unit: string;
}
interface ExamRow {
  title: string;
  exam_date: string | null;
  lab_name: string | null;
  category: string;
  created_at: string;
}
interface DiaryRow {
  entry_date: string;
  mood: number | null;
  energy: number | null;
  pain: number | null;
  symptoms: string[] | null;
  note: string | null;
}
interface TimelineRow {
  event_type: string;
  occurred_at: string;
  title: string | null;
  summary: string | null;
  date_only: boolean;
}

/* ──────────────────────────── Utilidades ──────────────────────────── */

/** Escapa TUDO que vem do banco antes de entrar no HTML (XSS). */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Corta texto longo sem quebrar o layout de 1 página. */
function clip(value: string | null | undefined, max: number): string {
  const text = (value ?? '').trim().replace(/\s+/g, ' ');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const DATETIME_FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const SHORT_FMT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
});

/** Colunas `date` ('AAAA-MM-DD') — formatadas sem passar por fuso. */
function fmtDay(value: string | null | undefined): string {
  if (!value) return '';
  const parts = value.slice(0, 10).split('-');
  const [y, m, d] = [parts[0], parts[1], parts[2]];
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}
function fmtDayShort(value: string | null | undefined): string {
  if (!value) return '';
  const parts = value.slice(0, 10).split('-');
  const [m, d] = [parts[1], parts[2]];
  if (!m || !d) return '';
  return `${d}/${m}`;
}
/** Colunas `timestamptz` — exibidas no horário de Brasília. */
function fmtStamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : DATETIME_FMT.format(d);
}
function fmtStampDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : DATE_FMT.format(d);
}
function fmtStampShort(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : SHORT_FMT.format(d);
}

/** numeric do Postgres chega como número ou string — normaliza p/ pt-BR. */
function fmtNumber(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

function ageFrom(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const parts = dob.slice(0, 10).split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - y;
  const monthNow = today.getUTCMonth() + 1;
  if (monthNow < m || (monthNow === m && today.getUTCDate() < d)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Rate limit best-effort por usuário (a instância de edge é efêmera). */
const RL = new Map<string, { count: number; reset: number }>();
function rateLimited(userId: string, max = 20, windowMs = 60 * 60_000): boolean {
  const now = Date.now();
  const entry = RL.get(userId);
  if (!entry || now > entry.reset) {
    RL.set(userId, { count: 1, reset: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

/* ─────────────────────────── Cabeçalhos HTTP ─────────────────────────── */

function htmlHeaders(nonce: string): Record<string, string> {
  return {
    ...CORS,
    'content-type': 'text/html; charset=utf-8',
    // PHI: nunca guardar em navegador, CDN ou proxy.
    'cache-control': 'private, no-store, max-age=0',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'content-security-policy':
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; " +
      `img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'`,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/* ──────────────────────────────── CSS ──────────────────────────────── */
// Tudo inline e autocontido: nenhuma fonte, imagem ou folha externa (o PDF
// precisa sair igual mesmo offline). Corpo em 12pt — piso de legibilidade.

const STYLES = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, "Segoe UI", Roboto, sans-serif;
    color: #14110d; font-size: 12pt; line-height: 1.42;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet { max-width: 186mm; margin: 0 auto; padding: 6mm 4mm 4mm; }
  @media screen { .sheet { padding: 10mm; } body { background: #f5f4f1; } .sheet { background: #fff; } }

  h1 { font-size: 16pt; line-height: 1.2; margin: 0; font-weight: 700; letter-spacing: -0.01em; }
  .who { font-size: 13pt; font-weight: 700; margin: 2mm 0 0; }
  .meta { font-size: 11pt; color: #45403a; margin: 1mm 0 0; }
  .rule { border: 0; border-top: 1.5pt solid #14110d; margin: 3mm 0 0; }

  .notice {
    font-size: 10.5pt; line-height: 1.35; color: #45403a;
    border: 0.8pt solid #b9b3a8; border-radius: 2mm;
    padding: 2mm 2.5mm; margin: 3mm 0 0;
  }

  section { margin: 4mm 0 0; page-break-inside: avoid; break-inside: avoid; }
  h2 {
    font-size: 12pt; margin: 0 0 1.5mm; font-weight: 700;
    border-bottom: 0.8pt solid #cfc9be; padding-bottom: 0.8mm;
  }
  .item { margin: 0 0 1.2mm; }
  .item:last-child { margin-bottom: 0; }
  .k { font-weight: 700; }
  .d { color: #45403a; }
  .serie { color: #14110d; }
  .serie .sep { color: #8d867a; padding: 0 0.6mm; }
  .count { color: #6b655c; font-size: 10.5pt; }
  .empty { color: #6b655c; font-style: italic; margin: 0; }
  .more { color: #6b655c; font-size: 10.5pt; margin: 1.2mm 0 0; }
  ul { margin: 0; padding: 0; list-style: none; }

  footer { margin: 5mm 0 0; border-top: 0.8pt solid #cfc9be; padding-top: 2mm; }
  footer p { margin: 0; font-size: 11pt; font-weight: 700; }
  footer .src { font-weight: 400; font-size: 10.5pt; color: #45403a; margin-top: 1mm; }

  /* Repete a frase obrigatória no rodapé de TODA página impressa (o relatório
     cabe em uma, mas com fonte ampliada pode passar para duas). */
  @media print {
    .no-print { display: none !important; }
    .sheet { padding-bottom: 10mm; }
    .running-note {
      position: fixed; bottom: 0; left: 0; right: 0;
      font-size: 9pt; color: #45403a; text-align: center;
      border-top: 0.5pt solid #cfc9be; padding-top: 1mm; background: #fff;
    }
  }
  @media screen { .running-note { display: none; } }

  .toolbar { margin: 0 0 4mm; display: flex; gap: 3mm; flex-wrap: wrap; align-items: center; }
  .toolbar button {
    font: inherit; font-size: 12pt; font-weight: 700; cursor: pointer;
    background: #14110d; color: #fff; border: 0; border-radius: 3mm;
    padding: 3mm 5mm; min-height: 12mm;
  }
  .toolbar span { font-size: 11pt; color: #45403a; }
`;

/* ───────────────────────── Montagem das seções ───────────────────────── */

interface ReportData {
  profile: ProfileRow | null;
  allergies: AllergyRow[];
  medications: MedicationRow[];
  vitals: VitalRow[];
  exams: ExamRow[];
  diary: DiaryRow[];
  timeline: TimelineRow[];
}

function sectionAlergias(rows: AllergyRow[]): string {
  const shown = rows.slice(0, CAP.alergias);
  const body = shown.length
    ? `<ul>${shown
        .map((a) => {
          const severity = SEVERITY_LABELS[a.severity] ?? a.severity;
          const reaction = clip(a.reaction, 70);
          return `<li class="item"><span class="k">${esc(a.substance)}</span> <span class="d">— gravidade registrada: ${esc(severity)}${
            reaction ? ` · reação: ${esc(reaction)}` : ''
          }</span></li>`;
        })
        .join('')}</ul>`
    : '<p class="empty">Nenhuma alergia registrada.</p>';
  const more =
    rows.length > shown.length
      ? `<p class="more">e mais ${rows.length - shown.length} registrada(s) no app.</p>`
      : '';
  return `<section><h2>Alergias</h2>${body}${more}</section>`;
}

function sectionMedicamentos(rows: MedicationRow[]): string {
  const shown = rows.slice(0, CAP.medicamentos);
  const body = shown.length
    ? `<ul>${shown
        .map((m) => {
          const dose = [m.dosage, m.unit].filter(Boolean).join(' ').trim();
          const times = (m.times ?? [])
            .map((t) => String(t).slice(0, 5))
            .filter((t) => /^\d{2}:\d{2}$/.test(t))
            .slice(0, 6);
          const detail = [
            dose ? esc(dose) : '',
            esc(FORM_LABELS[m.form] ?? m.form),
            esc(FREQUENCY_LABELS[m.frequency] ?? m.frequency),
            times.length ? `às ${esc(times.join(', '))}` : '',
            m.started_at ? `desde ${esc(fmtDay(m.started_at))}` : '',
            m.prescriber ? `prescrito por ${esc(clip(m.prescriber, 40))}` : '',
          ]
            .filter(Boolean)
            .join(' · ');
          return `<li class="item"><span class="k">${esc(m.name)}</span> <span class="d">— ${detail}</span></li>`;
        })
        .join('')}</ul>`
    : '<p class="empty">Nenhum medicamento em uso registrado.</p>';
  const more =
    rows.length > shown.length
      ? `<p class="more">e mais ${rows.length - shown.length} em uso no app.</p>`
      : '';
  return `<section><h2>Medicamentos em uso</h2>${body}${more}</section>`;
}

function sectionVitais(rows: VitalRow[], days: number): string {
  // Agrupa por tipo mantendo a ordem (mais recente primeiro).
  const byType = new Map<string, VitalRow[]>();
  for (const row of rows) {
    const list = byType.get(row.type);
    if (list) list.push(row);
    else byType.set(row.type, [row]);
  }

  const types = VITAL_ORDER.filter((t) => byType.has(t))
    .concat([...byType.keys()].filter((t) => !VITAL_ORDER.includes(t)))
    .slice(0, CAP.vitaisTipos);

  if (types.length === 0) {
    return `<section><h2>Medidas registradas</h2><p class="empty">Nenhuma medida registrada nos últimos ${days} dias.</p></section>`;
  }

  const items = types
    .map((type) => {
      const list = byType.get(type) ?? [];
      const shown = list.slice(0, CAP.vitaisPorTipo);
      const unit = shown[0]?.unit ?? '';
      const serie = shown
        .map((v) => {
          const primary = fmtNumber(v.value_primary);
          const secondary = v.value_secondary == null ? '' : fmtNumber(v.value_secondary);
          const value = secondary ? `${primary}/${secondary}` : primary;
          return `${esc(fmtStampShort(v.measured_at))} <span class="k">${esc(value)}</span>`;
        })
        .join('<span class="sep">·</span> ');
      const label = VITAL_LABELS[type] ?? type;
      const count = `${list.length} registro${list.length === 1 ? '' : 's'} no período`;
      return `<li class="item"><span class="k">${esc(label)}</span>${
        unit ? ` <span class="d">(${esc(unit)})</span>` : ''
      } <span class="count">— ${esc(count)}</span><br /><span class="serie">${serie}</span></li>`;
    })
    .join('');

  return `<section><h2>Medidas registradas</h2><ul>${items}</ul></section>`;
}

function sectionExames(rows: ExamRow[], days: number): string {
  const shown = rows.slice(0, CAP.exames);
  const body = shown.length
    ? `<ul>${shown
        .map((e) => {
          const when = e.exam_date ? fmtDay(e.exam_date) : `${fmtStampDate(e.created_at)} (data do envio)`;
          const detail = [
            esc(EXAM_CATEGORY_LABELS[e.category] ?? e.category),
            e.lab_name ? esc(clip(e.lab_name, 40)) : '',
          ]
            .filter(Boolean)
            .join(' · ');
          return `<li class="item"><span class="k">${esc(when)}</span> <span class="d">— ${esc(
            clip(e.title, 70),
          )}${detail ? ` · ${detail}` : ''}</span></li>`;
        })
        .join('')}</ul>`
    : `<p class="empty">Nenhum exame registrado nos últimos ${days} dias.</p>`;
  const more =
    rows.length > shown.length
      ? `<p class="more">e mais ${rows.length - shown.length} no período.</p>`
      : '';
  return `<section><h2>Exames no período</h2>${body}${more}</section>`;
}

function sectionDiario(rows: DiaryRow[], days: number): string {
  const shown = rows.slice(0, CAP.diario);
  const body = shown.length
    ? `<ul>${shown
        .map((d) => {
          const marks = [
            d.pain != null ? `dor ${d.pain}/10` : '',
            d.mood != null ? `humor ${d.mood}/5` : '',
            d.energy != null ? `energia ${d.energy}/5` : '',
          ]
            .filter(Boolean)
            .join(' · ');
          const symptoms = (d.symptoms ?? []).filter(Boolean).slice(0, 6).join(', ');
          const note = clip(d.note, 90);
          const detail = [marks, symptoms ? esc(clip(symptoms, 70)) : '', note ? `“${esc(note)}”` : '']
            .filter(Boolean)
            .join(' · ');
          return `<li class="item"><span class="k">${esc(fmtDayShort(d.entry_date))}</span> <span class="d">— ${detail}</span></li>`;
        })
        .join('')}</ul>`
    : `<p class="empty">Nenhuma anotação no diário nos últimos ${days} dias.</p>`;
  const more =
    rows.length > shown.length
      ? `<p class="more">e mais ${rows.length - shown.length} anotação(ões) no período.</p>`
      : '';
  return `<section><h2>Diário — o que o paciente anotou</h2>${body}${more}</section>`;
}

function sectionTimeline(rows: TimelineRow[]): string {
  const shown = rows.slice(0, CAP.timeline);
  const body = shown.length
    ? `<ul>${shown
        .map((t) => {
          const when = t.date_only ? fmtStampDate(t.occurred_at) : fmtStamp(t.occurred_at);
          const title = clip(t.title, 46);
          const summary = clip(t.summary, 52);
          return `<li class="item"><span class="k">${esc(when)}</span> <span class="d">— ${esc(title)}${
            summary ? `: ${esc(summary)}` : ''
          }</span></li>`;
        })
        .join('')}</ul>`
    : '<p class="empty">Nenhum registro no período.</p>';
  return `<section><h2>Últimos registros</h2>${body}</section>`;
}

/* ─────────────────────── Documento / fragmento ─────────────────────── */

function buildReportBody(
  data: ReportData,
  sections: SectionKey[],
  days: number,
  fromISO: string,
): string {
  const name = clip(data.profile?.full_name, 60) || 'Paciente';
  const age = ageFrom(data.profile?.date_of_birth);
  const generatedAt = fmtStamp(new Date().toISOString());
  const period = `${fmtStampDate(fromISO)} a ${fmtStampDate(new Date().toISOString())}`;

  const rendered: string[] = [];
  for (const key of sections) {
    if (key === 'alergias') rendered.push(sectionAlergias(data.allergies));
    else if (key === 'medicamentos') rendered.push(sectionMedicamentos(data.medications));
    else if (key === 'vitais') rendered.push(sectionVitais(data.vitals, days));
    else if (key === 'exames') rendered.push(sectionExames(data.exams, days));
    else if (key === 'diario') rendered.push(sectionDiario(data.diary, days));
    else if (key === 'linha_do_tempo') rendered.push(sectionTimeline(data.timeline));
  }

  return `<style>${STYLES}</style>
<div class="sheet">
  <div class="toolbar no-print">
    <button type="button" id="hp-print">Imprimir ou salvar em PDF</button>
    <span>Na janela que abrir, escolha “Salvar como PDF”.</span>
  </div>

  <h1>Meus registros — resumo para a consulta</h1>
  <p class="who">${esc(name)}${age != null ? ` · ${age} anos` : ''}</p>
  <p class="meta">Período: últimos ${days} dias (${esc(period)}) · Gerado em ${esc(generatedAt)}</p>
  <hr class="rule" />

  <p class="notice">
    Este resumo foi montado pelo próprio paciente, no aplicativo, a partir do que ele registrou.
    Os valores aparecem como foram anotados: sem interpretação, sem classificação e sem faixa de
    referência. Confira sempre com o paciente e com os documentos originais.
  </p>

  ${rendered.join('\n  ')}

  <footer>
    <p>${esc(FOOTER_NOTE)}</p>
    <p class="src">Gerado pelo titular no aplicativo HubPatients. Não é documento emitido por serviço de saúde.</p>
  </footer>
</div>
<div class="running-note">${esc(FOOTER_NOTE)}</div>`;
}

/** Documento completo e autocontido (usado pela web, que abre em nova aba). */
function buildDocument(body: string, nonce: string, autoPrint: boolean): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow, noarchive" />
<meta name="referrer" content="no-referrer" />
<title>Meus registros — resumo para a consulta</title>
</head>
<body>
${body}
<script nonce="${esc(nonce)}">${clientScript(autoPrint)}</script>
</body>
</html>`;
}

/** Script mínimo: botão de impressão (+ impressão automática se pedida). */
function clientScript(autoPrint: boolean): string {
  return `(function(){
  function p(){ try { window.print(); } catch (e) {} }
  var b = document.getElementById('hp-print');
  if (b) b.addEventListener('click', p);
  ${
    autoPrint
      ? `if (document.readyState === 'complete') { setTimeout(p, 150); }
  else { window.addEventListener('load', function(){ setTimeout(p, 150); }); }`
      : ''
  }
})();`;
}

/**
 * Página de bootstrap do GET (mobile).
 *
 * Não contém NENHUM dado de saúde. Ela existe só para tirar o JWT do fragmento
 * (`#t=...`) — que o navegador nunca envia ao servidor —, apagá-lo da barra de
 * endereço e buscar o relatório por POST com o header Authorization.
 */
function buildBootstrap(nonce: string): string {
  const script = `(function(){
  var el = document.getElementById('hp-status');
  function fail(msg){ if (el) el.textContent = msg; }
  var hash = location.hash.slice(1);
  var q = new URLSearchParams(hash);
  var t = q.get('t');
  var patientId = q.get('p') || undefined;
  var days = parseInt(q.get('days') || '30', 10);
  var sections = (q.get('sections') || '').split(',').filter(Boolean);
  var autoPrint = q.get('print') === '1';
  var endpoint = location.href.split('#')[0].split('?')[0];
  // Tira o token da barra de endereço e do histórico antes de qualquer coisa.
  try { history.replaceState(null, '', endpoint); } catch (e) {}
  if (!t) { fail('Link expirado. Volte ao aplicativo e gere o resumo de novo.'); return; }
  fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId: patientId, days: days, sections: sections, fragment: true })
  }).then(function(r){
    if (!r.ok) {
      return r.text().then(function(msg){
        // textContent: o texto entra como texto, nunca como marcação.
        fail(msg && msg.length < 240 ? msg : 'Não foi possível montar o resumo agora. Tente de novo pelo aplicativo.');
        return null;
      });
    }
    return r.text();
  }).then(function(html){
    if (!html) return;
    document.title = 'Meus registros — resumo para a consulta';
    // innerHTML não executa <script>: o conteúdo do relatório é só marcação.
    document.body.innerHTML = html;
    var b = document.getElementById('hp-print');
    function p(){ try { window.print(); } catch (e) {} }
    if (b) b.addEventListener('click', p);
    if (autoPrint) setTimeout(p, 350);
  }).catch(function(){ fail('Sem conexão. Tente de novo pelo aplicativo.'); });
})();`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow, noarchive" />
<meta name="referrer" content="no-referrer" />
<title>Meus registros — resumo para a consulta</title>
<style>${STYLES}
  #hp-status { font-size: 13pt; color: #45403a; padding: 8mm 0; }
</style>
</head>
<body>
<div class="sheet"><p id="hp-status">Preparando seu resumo…</p></div>
<script nonce="${esc(nonce)}">${script}</script>
</body>
</html>`;
}

/* ────────────────────────── Busca dos dados ────────────────────────── */

type Client = ReturnType<typeof createClient>;

/** Sem permissão sobre o paciente pedido (a RPC levanta 42501). */
class ReportForbiddenError extends Error {}
/** A trilha de auditoria falhou — fail-closed: PHI não sai. */
class ReportAuditError extends Error {}

async function loadReportData(
  supabase: Client,
  patientId: string,
  sections: SectionKey[],
  fromISO: string,
  fromDay: string,
): Promise<ReportData> {
  const wants = (key: SectionKey) => sections.includes(key);

  // A RPC `clinical_timeline` (0034) é chamada SEMPRE: além de alimentar a
  // seção "Últimos registros", é ela que grava o acesso em `audit_log` —
  // a trilha de auditoria desta exportação (LGPD). Ela também aplica a mesma
  // política de permissão de cuidador usada na linha do tempo do app.
  const timelinePromise = supabase.rpc('clinical_timeline', {
    p_patient_id: patientId,
    p_limit: 60,
  });

  const profilePromise = supabase
    .from('profiles')
    .select('full_name, date_of_birth')
    .eq('id', patientId)
    .maybeSingle();

  // As demais seções vêm das tabelas (com RLS) porque precisam de campos que a
  // timeline não carrega: posologia, valores numéricos por tipo e recorte do
  // período. Nada aqui usa service_role.
  const allergiesPromise = wants('alergias')
    ? supabase
        .from('allergies')
        .select('substance, severity, reaction')
        .eq('patient_id', patientId)
        .order('severity', { ascending: false })
        .order('substance', { ascending: true })
        .limit(30)
    : null;

  const medicationsPromise = wants('medicamentos')
    ? supabase
        .from('medications')
        .select('name, dosage, unit, form, frequency, times, started_at, prescriber')
        .eq('patient_id', patientId)
        .eq('active', true)
        .order('name', { ascending: true })
        .limit(40)
    : null;

  const vitalsPromise = wants('vitais')
    ? supabase
        .from('vitals')
        .select('type, measured_at, value_primary, value_secondary, unit')
        .eq('patient_id', patientId)
        .gte('measured_at', fromISO)
        .order('measured_at', { ascending: false })
        .limit(400)
    : null;

  // exam_date pode ser nulo (exame enviado sem data) — filtramos depois em JS
  // usando exam_date ?? created_at para não perder esses registros.
  const examsPromise = wants('exames')
    ? supabase
        .from('exams')
        .select('title, exam_date, lab_name, category, created_at')
        .eq('patient_id', patientId)
        .order('exam_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(40)
    : null;

  const diaryPromise = wants('diario')
    ? supabase
        .from('diary_entries')
        .select('entry_date, mood, energy, pain, symptoms, note')
        .eq('patient_id', patientId)
        .gte('entry_date', fromDay)
        .order('entry_date', { ascending: false })
        .limit(60)
    : null;

  const [timeline, profile, allergies, medications, vitals, exams, diary] = await Promise.all([
    timelinePromise,
    profilePromise,
    allergiesPromise,
    medicationsPromise,
    vitalsPromise,
    examsPromise,
    diaryPromise,
  ]);

  // Fail-closed (mesma regra do process-exam): se a RPC que grava a auditoria
  // não passou, nenhum dado de saúde sai daqui.
  if (timeline.error) {
    const code = (timeline.error as { code?: string }).code;
    if (code === '42501') throw new ReportForbiddenError();
    throw new ReportAuditError();
  }

  const fromMs = new Date(fromISO).getTime();

  const examRows = ((exams?.data ?? []) as ExamRow[]).filter((e) => {
    const ref = e.exam_date ? `${e.exam_date.slice(0, 10)}T12:00:00Z` : e.created_at;
    const ms = new Date(ref).getTime();
    return Number.isFinite(ms) && ms >= fromMs;
  });

  const diaryRows = ((diary?.data ?? []) as DiaryRow[]).filter(
    (d) => d.note || (d.symptoms ?? []).length > 0 || d.pain != null || d.mood != null,
  );

  const timelineRows = ((timeline.data ?? []) as TimelineRow[]).filter((t) => {
    const ms = new Date(t.occurred_at).getTime();
    return Number.isFinite(ms) && ms >= fromMs;
  });

  return {
    profile: (profile.data ?? null) as ProfileRow | null,
    allergies: (allergies?.data ?? []) as AllergyRow[],
    medications: (medications?.data ?? []) as MedicationRow[],
    vitals: (vitals?.data ?? []) as VitalRow[],
    exams: examRows,
    diary: diaryRows,
    timeline: timelineRows,
  };
}

/* ──────────────────────────── Entrada HTTP ──────────────────────────── */

function parseSections(raw: unknown): SectionKey[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  const picked = list
    .map((s) => String(s).trim())
    .filter((s): s is SectionKey => (SECTION_KEYS as readonly string[]).includes(s));
  // Sem duplicatas, na ordem canônica (o relatório tem uma ordem clínica útil:
  // alergias primeiro, depois o que o paciente toma, mede e registra).
  const unique = SECTION_KEYS.filter((k) => picked.includes(k));
  return unique.length > 0 ? [...unique] : [...DEFAULT_SECTIONS];
}

function parseDays(raw: unknown): 30 | 90 {
  return Number(raw) === 90 ? 90 : 30;
}

Deno.serve(async (req: Request) => {
  const nonce = crypto.randomUUID();

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // GET → página de bootstrap (sem PHI, sem autenticação). Ela busca o
  // relatório por POST usando o JWT que veio no fragmento da URL.
  if (req.method === 'GET') {
    return new Response(buildBootstrap(nonce), { headers: htmlHeaders(nonce) });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método não suportado.' }, 405);
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const asFragment = body?.fragment === true;
    const autoPrint = body?.print === true;
    const days = parseDays(body?.days);
    const sections = parseSections(body?.sections);

    // O bootstrap mostra o texto do erro direto na tela (via textContent);
    // a web lê o JSON. Nenhuma das mensagens contém dado do paciente.
    const fail = (status: number, message: string): Response =>
      asFragment
        ? new Response(message, {
            status,
            headers: { ...CORS, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
          })
        : json({ error: message }, status);

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return fail(401, 'Sessão expirada. Entre de novo no aplicativo.');
    }

    // ANON key + JWT do usuário: a RLS é quem autoriza cada leitura.
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await supabase.auth.getUser();
    const actorId = userData?.user?.id;
    if (authError || !actorId) {
      return fail(401, 'Sessão expirada. Entre de novo no aplicativo.');
    }

    if (rateLimited(actorId)) {
      return fail(429, 'Muitos resumos gerados agora há pouco. Tente de novo em alguns minutos.');
    }

    // Perfil ativo (dependente/quem o usuário cuida). Se vier lixo, cai no
    // próprio usuário; a autorização real é da RLS e da RPC, não daqui.
    const requested = typeof body?.patientId === 'string' ? body.patientId : '';
    const patientId = UUID_RE.test(requested) ? requested : actorId;

    const from = new Date(Date.now() - days * 86_400_000);
    const fromISO = from.toISOString();
    const fromDay = fromISO.slice(0, 10);

    let data: ReportData;
    try {
      data = await loadReportData(supabase, patientId, sections, fromISO, fromDay);
    } catch (loadError) {
      return loadError instanceof ReportForbiddenError
        ? fail(403, 'Você não tem acesso aos registros deste perfil.')
        : fail(503, 'Não foi possível registrar o acesso aos dados agora. Tente de novo em alguns minutos.');
    }

    const reportBody = buildReportBody(data, sections, days, fromISO);

    // fragment=true → só <style> + marcação, para o bootstrap injetar com
    // innerHTML (scripts não executam por innerHTML; o botão é ligado lá).
    const html = asFragment ? reportBody : buildDocument(reportBody, nonce, autoPrint);

    return new Response(html, { headers: htmlHeaders(nonce) });
  } catch (e) {
    const errorId = crypto.randomUUID();
    // Nunca logar payload, nome, identificadores ou conteúdo do relatório.
    console.error(
      JSON.stringify({
        event: 'clinical_report_failed',
        errorId,
        errorType: e instanceof Error ? e.name : 'UnknownError',
      }),
    );
    return json({ error: 'Erro interno.', id: errorId }, 500);
  }
});
