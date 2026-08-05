import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Droplet,
  EyeOff,
  FlaskConical,
  HeartPulse,
  Link2Off,
  Pill,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { createSupabaseAnonClient } from '@hubpatients/supabase';
import {
  ALLERGY_SEVERITY,
  BIOLOGICAL_SEX_LABELS,
  DISCLAIMERS,
  DOCTOR_REDIRECT,
  EXAM_CATEGORY_LABELS,
  MEDICATION_FORM_LABELS,
  MEDICATION_FREQUENCY_LABELS,
  VITAL_TYPES,
} from '@hubpatients/core';
import { getSupabaseEnv } from '@/lib/env';

/**
 * Modo Consulta — página PÚBLICA (`/consulta/<token>`).
 *
 * Quem abre é o médico, sem login. A autenticação é o próprio segredo do link,
 * validado no banco pela RPC `api_me_bundle_v2` (SECURITY DEFINER, concedida
 * apenas ao papel `anon`), que confere revogação, expiração e rate limit e
 * devolve somente os escopos autorizados.
 *
 * O segredo NUNCA chega ao navegador do médico via JavaScript: a leitura toda
 * acontece no servidor e o HTML já sai renderizado (bom para impressão também).
 *
 * Estes são REGISTROS PESSOAIS informados pelo paciente. Não é prontuário
 * médico, não é laudo, não há diagnóstico nem prescrição.
 */

export const metadata: Metadata = {
  title: 'Resumo de saúde compartilhado — HubPatients',
  description: 'Resumo temporário compartilhado pelo próprio paciente.',
  // Conteúdo sensível e efêmero: fora de buscadores e sem vazar o link por referer.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  referrer: 'no-referrer',
};

// Nunca cachear: o acesso pode ser revogado a qualquer instante.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const TOKEN_PATTERN = /^vlk_[A-Za-z0-9_-]{43,128}$/;

const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: #ffffff !important; }
  .print-card { break-inside: avoid; border-color: #d4d4d4 !important; box-shadow: none !important; }
}
`;

const PRINT_SCRIPT = `
document.addEventListener('click', function (e) {
  var t = e.target;
  if (t && t.closest && t.closest('[data-print]')) window.print();
});
`;

type Bundle = Record<string, unknown>;

/**
 * Seções clínicas que um link pode carregar, e como saber se cada uma veio.
 *
 * A RPC `api_me_bundle_v2` monta o pacote escopo a escopo: a chave só existe se
 * o paciente autorizou aquela categoria, e uma categoria autorizada mas sem
 * registros vem como `[]` (o `coalesce` da migração 0035). Ou seja, o servidor
 * JÁ distingue "não compartilhado" de "compartilhado e vazio" — a página é que
 * jogava as duas coisas no mesmo balde, escondendo a seção nos dois casos.
 *
 * A diferença é clínica. "Nenhuma alergia registrada" é uma resposta; seção
 * ausente sem explicação é lida como a mesma resposta, e não é. O médico que
 * procura alergias e não acha a seção conclui que não há.
 *
 * `read:profile` fica de fora desta lista de propósito: a migração 0039 proíbe
 * esse escopo no Modo Consulta, então listá-lo como "não compartilhado" seria
 * cobrar do paciente uma escolha que ele nunca teve.
 */
const SECOES_CLINICAS = [
  { chave: 'allergies', titulo: 'Alergias' },
  { chave: 'medications', titulo: 'Medicamentos em uso' },
  { chave: 'vitals', titulo: 'Sinais vitais' },
  { chave: 'exams', titulo: 'Exames' },
] as const;

/** Compartilhado = a chave existe no pacote, ainda que a lista venha vazia. */
function foiCompartilhado(bundle: Bundle, chave: string): boolean {
  return Object.prototype.hasOwnProperty.call(bundle, chave);
}

type LoadResult =
  | { kind: 'ok'; bundle: Bundle }
  | { kind: 'invalid' }
  | { kind: 'rate-limited' }
  | { kind: 'unavailable' };

async function loadBundle(token: string): Promise<LoadResult> {
  if (!TOKEN_PATTERN.test(token)) return { kind: 'invalid' };

  // `getSupabaseEnv` lança em produção quando falta configuração (fail-closed).
  // Aqui isso vira uma mensagem amigável em vez de uma tela de erro 500.
  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch {
    return { kind: 'unavailable' };
  }
  if (!env.configured) return { kind: 'unavailable' };

  const supabase = createSupabaseAnonClient(env.url, env.anonKey);
  type PatRpc = (
    functionName: string,
    params: { p_token: string },
  ) => PromiseLike<{ data: unknown; error: unknown | null }>;
  const callPatRpc = supabase.rpc.bind(supabase) as unknown as PatRpc;

  let data: unknown;
  try {
    const result = await callPatRpc('api_me_bundle_v2', { p_token: token });
    // Erro do banco = credencial inválida/expirada/revogada. Nunca detalhamos
    // o motivo: a mensagem genérica evita sondagem de tokens.
    if (result.error) return { kind: 'invalid' };
    data = result.data;
  } catch {
    return { kind: 'unavailable' };
  }

  const record = asRecord(data);
  if (!record) return { kind: 'invalid' };
  if (record._error === 'rate_limit_exceeded') return { kind: 'rate-limited' };
  return { kind: 'ok', bundle: record };
}

export default async function ConsultaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await loadBundle(token);

  if (result.kind !== 'ok') {
    return <AccessClosed reason={result.kind} />;
  }

  const bundle = result.bundle;
  const patient = asRecord(bundle.patient);
  const medications = asRecords(bundle.medications);
  const vitals = asRecords(bundle.vitals);
  const allergies = asRecords(bundle.allergies);
  const exams = asRecords(bundle.exams);
  const generatedAt = str(bundle, 'generatedAt');

  const patientName = patient ? str(patient, 'name') : null;
  const compartilhadas = SECOES_CLINICAS.filter((s) => foiCompartilhado(bundle, s.chave));
  const omitidas = SECOES_CLINICAS.filter((s) => !foiCompartilhado(bundle, s.chave));
  const nothingShared = !patient && compartilhadas.length === 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">HubPatients</p>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Resumo de saúde compartilhado
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {patientName ? (
              <>
                Compartilhado por <span className="font-medium text-fg-soft">{patientName}</span>
              </>
            ) : (
              'Compartilhado pelo próprio paciente'
            )}
            {generatedAt ? ` · gerado em ${formatDateTime(generatedAt)}` : ''}
          </p>
        </div>
        <button
          type="button"
          data-print
          className="no-print inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-fg-soft hover:bg-surface-2"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </header>

      {/* Aviso ético — permanente e não dispensável. */}
      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-400/40 bg-amber-500/[0.08] px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-attention-ink" />
        <p className="text-xs leading-relaxed text-fg-soft">
          <strong className="font-semibold text-fg">
            Dados autorreferidos pelo paciente — não constitui laudo médico.
          </strong>{' '}
          As informações abaixo foram registradas pela própria pessoa no aplicativo, sem validação
          clínica. {DISCLAIMERS.notDiagnosis}
        </p>
      </div>

      {nothingShared ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
          Nada foi compartilhado neste acesso.
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          {patient && <PatientCard patient={patient} />}
          {foiCompartilhado(bundle, 'allergies') && <AllergiesCard allergies={allergies} />}
          {foiCompartilhado(bundle, 'medications') && (
            <MedicationsCard medications={medications} />
          )}
          {foiCompartilhado(bundle, 'vitals') && <VitalsCard vitals={vitals} />}
          {foiCompartilhado(bundle, 'exams') && <ExamsCard exams={exams} />}
        </div>
      )}

      {omitidas.length > 0 && !nothingShared && <OmittedNotice titulos={omitidas.map((s) => s.titulo)} />}

      <footer className="mt-8 space-y-2 border-t border-line pt-5">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Acesso temporário e somente de leitura, criado pelo paciente. Ele expira sozinho e pode
          ser encerrado a qualquer momento — quando isso acontecer, esta página deixa de abrir.
        </p>
        <p className="text-xs text-muted">{DOCTOR_REDIRECT}</p>
      </footer>

      <script dangerouslySetInnerHTML={{ __html: PRINT_SCRIPT }} />
    </main>
  );
}

/* ─────────────────────────── Seções do resumo ─────────────────────────── */

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="print-card rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Resposta confirmada do servidor: a categoria veio, e veio sem registros. */
function SemRegistros({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

/** "a, b e c" — sem `Intl.ListFormat`, para a formatação não variar por navegador. */
function listar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/**
 * Aviso de omissão deliberada.
 *
 * O paciente tem direito de não compartilhar (LGPD art. 9º: consentimento é
 * específico e granular), e por isso o CONTEÚDO não aparece de forma alguma
 * aqui — nem o nome de um registro, nem quantos existem. O que este bloco
 * revela é só o desenho da ferramenta: que o resumo é montado por categorias e
 * que estas não entraram.
 *
 * Sem esse aviso, a omissão fica indistinguível de "não tem", e é o médico —
 * não o paciente — quem paga o erro. Com ele, o médico faz a pergunta que
 * sempre coube a ele fazer. O texto é deliberadamente sobre o app e não sobre a
 * pessoa: nada de "o paciente ocultou".
 */
function OmittedNotice({ titulos }: { titulos: string[] }) {
  return (
    <section className="print-card mt-5 flex items-start gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 py-3">
      <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <p className="text-xs leading-relaxed text-fg-soft">
        <strong className="font-semibold text-fg">
          Este resumo não inclui {listar(titulos)}.
        </strong>{' '}
        Cada link mostra apenas as categorias que o paciente marca no aplicativo. A ausência de
        uma categoria não é informação clínica e não quer dizer que não haja registros — pergunte
        diretamente ao paciente.
      </p>
    </section>
  );
}

function PatientCard({ patient }: { patient: Record<string, unknown> }) {
  const birthDate = str(patient, 'birthDate');
  const gender = str(patient, 'gender');
  const bloodType = str(patient, 'bloodType');
  const genderLabel =
    gender && gender in BIOLOGICAL_SEX_LABELS
      ? BIOLOGICAL_SEX_LABELS[gender as keyof typeof BIOLOGICAL_SEX_LABELS]
      : null;

  return (
    <Section icon={ClipboardList} title="Identificação">
      <dl className="grid gap-2 sm:grid-cols-3">
        <Field label="Nome" value={str(patient, 'name')} />
        <Field
          label="Nascimento"
          value={
            birthDate
              ? `${formatDate(birthDate)}${ageFrom(birthDate) != null ? ` (${ageFrom(birthDate)} anos)` : ''}`
              : null
          }
        />
        <Field label="Sexo biológico" value={genderLabel} />
        <Field
          label="Tipo sanguíneo"
          value={bloodType && bloodType !== 'unknown' ? bloodType : null}
        />
      </dl>
    </Section>
  );
}

function AllergiesCard({ allergies }: { allergies: Record<string, unknown>[] }) {
  return (
    <Section
      icon={AlertTriangle}
      title="Alergias"
      subtitle="Relatadas pelo paciente — confirme antes de qualquer conduta."
    >
      {allergies.length === 0 ? (
        <SemRegistros>
          O paciente compartilhou esta categoria e não há nenhuma alergia registrada por ele.
        </SemRegistros>
      ) : (
        <ul className="space-y-2">
          {allergies.map((a, i) => {
            const severity = str(a, 'criticality');
            const meta =
              severity && severity in ALLERGY_SEVERITY
                ? ALLERGY_SEVERITY[severity as keyof typeof ALLERGY_SEVERITY]
                : null;
            const severe = meta?.tone === 'alert';
            return (
              <li
                key={`${str(a, 'substance') ?? 'alergia'}-${i}`}
                className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl border px-3 py-2 ${
                  severe ? 'border-rose-500/40 bg-rose-500/[0.07]' : 'border-line bg-surface-2'
                }`}
              >
                <span className="text-sm font-semibold text-fg">
                  {str(a, 'substance') ?? 'Substância não informada'}
                </span>
                {meta && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      severe
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {meta.label}
                  </span>
                )}
                {str(a, 'reaction') && (
                  <span className="text-xs text-muted">Reação: {str(a, 'reaction')}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function MedicationsCard({ medications }: { medications: Record<string, unknown>[] }) {
  return (
    <Section icon={Pill} title="Medicamentos em uso" subtitle="Somente os marcados como ativos.">
      {medications.length === 0 ? (
        <SemRegistros>
          O paciente compartilhou esta categoria e não há nenhum medicamento ativo registrado por
          ele.
        </SemRegistros>
      ) : (
        <ul className="divide-y divide-line/60">
          {medications.map((m, i) => {
            const form = str(m, 'form');
            const frequency = str(m, 'frequency');
            const detail = [
              str(m, 'dosage'),
              form && form in MEDICATION_FORM_LABELS
                ? MEDICATION_FORM_LABELS[form as keyof typeof MEDICATION_FORM_LABELS]
                : null,
              frequency && frequency in MEDICATION_FREQUENCY_LABELS
                ? MEDICATION_FREQUENCY_LABELS[frequency as keyof typeof MEDICATION_FREQUENCY_LABELS]
                : null,
            ]
              .filter((part): part is string => Boolean(part))
              .join(' · ');
            return (
              <li key={`${str(m, 'name') ?? 'med'}-${i}`} className="py-2 first:pt-0 last:pb-0">
                <p className="text-sm font-semibold text-fg">{str(m, 'name') ?? 'Sem nome'}</p>
                {detail && <p className="text-xs text-muted">{detail}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function VitalsCard({ vitals }: { vitals: Record<string, unknown>[] }) {
  // A RPC devolve até 100 medições, mais recentes primeiro. Mostramos a última
  // de cada tipo (visão rápida) e um histórico curto abaixo.
  const latestByType = new Map<string, Record<string, unknown>>();
  for (const v of vitals) {
    const type = str(v, 'type');
    if (!type || latestByType.has(type)) continue;
    latestByType.set(type, v);
  }
  const recent = vitals.slice(0, 12);

  return (
    <Section icon={HeartPulse} title="Sinais vitais" subtitle="Medições feitas em casa pelo paciente.">
      {vitals.length === 0 ? (
        <SemRegistros>
          O paciente compartilhou esta categoria e não há nenhuma medição registrada por ele.
        </SemRegistros>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from(latestByType.entries()).map(([type, v]) => (
              <div key={type} className="rounded-xl border border-line bg-surface-2 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted">{vitalLabel(type)}</p>
                <p className="text-lg font-bold text-fg">{vitalValue(v, type)}</p>
                <p className="text-[11px] text-faint">
                  {formatDateTime(str(v, 'effectiveDateTime'))}
                </p>
              </div>
            ))}
          </div>

          {recent.length > 1 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-muted">
                    <th className="py-1.5 pr-3 font-medium">Data</th>
                    <th className="py-1.5 pr-3 font-medium">Medida</th>
                    <th className="py-1.5 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {recent.map((v, i) => {
                    const type = str(v, 'type') ?? '';
                    return (
                      <tr key={`${type}-${i}`}>
                        <td className="whitespace-nowrap py-1.5 pr-3 text-muted">
                          {formatDateTime(str(v, 'effectiveDateTime'))}
                        </td>
                        <td className="py-1.5 pr-3 text-fg-soft">{vitalLabel(type)}</td>
                        <td className="whitespace-nowrap py-1.5 font-medium text-fg">
                          {vitalValue(v, type)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function ExamsCard({ exams }: { exams: Record<string, unknown>[] }) {
  const sorted = [...exams].sort((a, b) => {
    const da = Date.parse(str(a, 'effectiveDateTime') ?? '');
    const db = Date.parse(str(b, 'effectiveDateTime') ?? '');
    return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0);
  });

  return (
    <Section
      icon={FlaskConical}
      title="Exames recentes"
      subtitle="Apenas os registros — os arquivos não são compartilhados por este link."
    >
      {sorted.length === 0 ? (
        <SemRegistros>
          O paciente compartilhou esta categoria e não há nenhum exame registrado por ele.
        </SemRegistros>
      ) : (
        <ul className="divide-y divide-line/60">
          {sorted.slice(0, 20).map((e, i) => {
            const category = str(e, 'category');
            const status = str(e, 'status');
            return (
              <li
                key={`${str(e, 'title') ?? 'exame'}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">{str(e, 'title') ?? 'Exame'}</p>
                  <p className="text-xs text-muted">
                    {category && category in EXAM_CATEGORY_LABELS
                      ? EXAM_CATEGORY_LABELS[category as keyof typeof EXAM_CATEGORY_LABELS]
                      : 'Exame'}
                    {status && status !== 'processed' ? ' · ainda em processamento' : ''}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(str(e, 'effectiveDateTime'))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm font-medium text-fg">{value ?? '—'}</dd>
    </div>
  );
}

/** Link inválido, expirado, revogado ou com excesso de acessos. */
function AccessClosed({ reason }: { reason: 'invalid' | 'rate-limited' | 'unavailable' }) {
  const content = {
    invalid: {
      icon: Link2Off,
      title: 'Este link não está mais disponível',
      body:
        'Ele pode ter expirado ou ter sido encerrado pelo paciente. Peça um novo acesso — leva alguns segundos para gerar.',
    },
    'rate-limited': {
      icon: Droplet,
      title: 'Muitos acessos em pouco tempo',
      body: 'Aguarde cerca de um minuto e atualize a página.',
    },
    unavailable: {
      icon: AlertTriangle,
      title: 'Não foi possível abrir agora',
      body: 'Houve um problema temporário no serviço. Tente novamente em instantes.',
    },
  }[reason];
  const Icon = content.icon;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-surface-2 text-muted">
        <Icon className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
        {content.title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{content.body}</p>
      <p className="mt-6 text-xs text-faint">
        HubPatients — o paciente controla quem vê seus registros e por quanto tempo.
      </p>
    </main>
  );
}

/* ──────────────────────── Leitura defensiva do JSON ──────────────────── */

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const out: Record<string, unknown>[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (record) out.push(record);
  }
  return out;
}

function str(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function num(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/* ───────────────────────────── Formatação ────────────────────────────── */

const TZ = 'America/Sao_Paulo';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

function ageFrom(birthDate: string): number | null {
  const ms = Date.parse(birthDate);
  if (!Number.isFinite(ms)) return null;
  const born = new Date(ms);
  const today = new Date();
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - born.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function vitalLabel(type: string): string {
  if (type in VITAL_TYPES) return VITAL_TYPES[type as keyof typeof VITAL_TYPES].label;
  return 'Medição';
}

function trimNumber(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

function vitalValue(vital: Record<string, unknown>, type: string): string {
  const primary = num(vital, 'value');
  const secondary = num(vital, 'valueSecondary');
  const unit = str(vital, 'unit') ?? (type in VITAL_TYPES ? VITAL_TYPES[type as keyof typeof VITAL_TYPES].unit : '');
  if (primary == null) return '—';
  const base = secondary != null ? `${trimNumber(primary)}/${trimNumber(secondary)}` : trimNumber(primary);
  return unit ? `${base} ${unit}` : base;
}
