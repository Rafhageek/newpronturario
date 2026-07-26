'use client';

import {
  MEASURE_META,
  REFERENCE_BAND_NOTE,
  bandRangeText,
  countInsideBand,
  referenceBandFor,
  type MeasureKind,
  type ReferenceBand,
} from './reference-band';

/**
 * Resumo textual do gráfico.
 *
 * Gráfico em SVG não é lido por leitor de tela. A solução consagrada (padrão de
 * acessibilidade do Highcharts e dos Audio Graphs da Apple) é oferecer, ao lado
 * do desenho, **um resumo em texto + a tabela equivalente**.
 *
 * A frase é 100% factual — contagem, mínimo, máximo e média. Nunca diz se o
 * valor é "normal", "alterado" ou "ruim", e nunca sugere conduta: o app exibe e
 * organiza, quem interpreta é o médico.
 */

export interface SummarySeries {
  /** Nome da série ("Sistólica", "Glicemia"…). */
  label: string;
  values: (number | null | undefined)[];
  unit?: string;
  decimals?: number;
  /** Tipo da medida — usado para achar a faixa de referência. */
  kind?: MeasureKind | null;
  /** Faixa já resolvida (usar quando ela depende de contexto, ex.: peso × altura). */
  band?: ReferenceBand | null;
  /** Substantivo da contagem (padrão: "medição"/"medições"). */
  noun?: { one: string; many: string };
}

interface SeriesStatsLite {
  count: number;
  min: number;
  max: number;
  avg: number;
}

/** Número em PT-BR (vírgula decimal). Sem `Intl` — mesma regra do mobile (Hermes). */
export function fmtNumber(n: number, decimals = 0): string {
  const fixed = n.toFixed(decimals);
  return decimals > 0 ? fixed.replace('.', ',') : fixed;
}

function statsOf(values: (number | null | undefined)[]): SeriesStatsLite | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const first = nums[0];
  if (first == null) return null;
  let min = first;
  let max = first;
  let sum = 0;
  for (const v of nums) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { count: nums.length, min, max, avg: sum / nums.length };
}

function resolveBand(s: SummarySeries): ReferenceBand | null {
  if (s.band !== undefined) return s.band;
  return s.kind ? referenceBandFor(s.kind) : null;
}

/** Humor/energia são "registros" do diário; o resto são "medições". */
function defaultNoun(kind: MeasureKind | null | undefined) {
  return kind === 'humor' || kind === 'energia'
    ? { one: 'registro', many: 'registros' }
    : { one: 'medição', many: 'medições' };
}

/** "Sistólica" → "sistólica" (mas preserva siglas como "IMC"). */
function softLower(label: string): string {
  if (label === label.toUpperCase()) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function seriesName(title: string, label: string): string {
  const a = label.trim().toLowerCase();
  const b = title.trim().toLowerCase();
  if (!a || a === b) return title;
  return `${title} — ${softLower(label.trim())}`;
}

/**
 * Uma frase por série, no padrão:
 * "Pressão arterial — sistólica (mmHg), últimos 30 dias: 28 medições,
 *  menor 112, maior 158, média 131,3."
 * Quando há faixa de referência, uma 2ª frase informa a faixa e quantas
 * medições caíram dentro dela (contagem factual, sem julgamento).
 */
export function buildSummarySentences({
  title,
  periodLabel,
  series,
  includeBand = true,
}: {
  title: string;
  periodLabel?: string;
  series: SummarySeries[];
  includeBand?: boolean;
}): string[] {
  const out: string[] = [];

  series.forEach((s) => {
    const st = statsOf(s.values);
    const name = seriesName(title, s.label);
    const unit = s.unit ?? (s.kind ? MEASURE_META[s.kind].unit : '');
    const decimals = s.decimals ?? (s.kind ? MEASURE_META[s.kind].decimals : 0);
    const head = `${name}${unit ? ` (${unit})` : ''}${periodLabel ? `, ${periodLabel}` : ''}`;

    const noun = s.noun ?? defaultNoun(s.kind);
    // A média sempre com pelo menos 1 casa: arredondar 3,4 para "3" distorce.
    const avgDecimals = Math.max(decimals, 1);

    if (!st) {
      out.push(`${head}: nenhum registro no período.`);
      return;
    }

    out.push(
      `${head}: ${st.count} ${st.count === 1 ? noun.one : noun.many}, ` +
        `menor ${fmtNumber(st.min, decimals)}, ` +
        `maior ${fmtNumber(st.max, decimals)}, ` +
        `média ${fmtNumber(st.avg, avgDecimals)}.`,
    );

    if (!includeBand) return;
    const band = resolveBand(s);
    if (!band) return;
    const { inside, total } = countInsideBand(s.values, band);
    out.push(
      `Faixa de referência exibida no gráfico: ${bandRangeText(band)} — ` +
        `${inside} de ${total} ${total === 1 ? `${noun.one} ficou` : `${noun.many} ficaram`} dentro dela. ` +
        'A faixa é uma referência geral, não um diagnóstico.',
    );
  });

  return out;
}

/** Tudo em uma string só (para `accessibilityLabel`, `aria-label`, tooltip…). */
export function buildSummaryText(args: Parameters<typeof buildSummarySentences>[0]): string {
  return buildSummarySentences(args).join(' ');
}

export interface ChartSummaryProps {
  /** Nome do gráfico ("Pressão arterial"). */
  title: string;
  /** "últimos 30 dias" — entra na frase como está. */
  periodLabel?: string;
  series: SummarySeries[];
  /** Rótulos do eixo X (datas) para a tabela equivalente. */
  labels?: string[];
  /** Cabeçalho da 1ª coluna da tabela. */
  labelHeader?: string;
  /**
   * Renderiza a tabela equivalente escondida (`sr-only`). Desligue quando a
   * página já mostra uma tabela com os mesmos dados — duplicar 90 linhas para
   * o leitor de tela atrapalha em vez de ajudar.
   */
  includeTable?: boolean;
  /** Menciona a faixa de referência na frase (padrão: sim). */
  includeBand?: boolean;
  id?: string;
  className?: string;
}

/**
 * `<p>` visível (ajuda todo mundo, não só leitor de tela) + `<table>` equivalente
 * apenas para leitores de tela (`sr-only`, utilitário nativo do Tailwind v4).
 */
export function ChartSummary({
  title,
  periodLabel,
  series,
  labels,
  labelHeader = 'Data',
  includeTable = true,
  includeBand = true,
  id,
  className = '',
}: ChartSummaryProps) {
  const sentences = buildSummarySentences({ title, periodLabel, series, includeBand });
  if (sentences.length === 0) return null;

  const rowCount = series.reduce((max, s) => Math.max(max, s.values.length), 0);
  const showTable = includeTable && rowCount > 0;

  return (
    <div className={className}>
      {/* Esta frase é a versão acessível do gráfico — quem carrega a informação
          é ela, não o SVG. Por isso vai em corpo pequeno (15px), não em 12px. */}
      <p id={id} className="text-body-sm text-fg-soft">
        {sentences.join(' ')}
      </p>

      {showTable && (
        <table className="sr-only">
          <caption>
            {title}
            {periodLabel ? `, ${periodLabel}` : ''} — dados do gráfico em tabela.{' '}
            {series.some((s) => resolveBand(s)) ? REFERENCE_BAND_NOTE : ''}
          </caption>
          <thead>
            <tr>
              <th scope="col">{labelHeader}</th>
              {series.map((s) => {
                const unit = s.unit ?? (s.kind ? MEASURE_META[s.kind].unit : '');
                return (
                  <th key={s.label} scope="col">
                    {s.label}
                    {unit ? ` (${unit})` : ''}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, i) => (
              <tr key={i}>
                <th scope="row">{labels?.[i] ?? String(i + 1)}</th>
                {series.map((s) => {
                  const v = s.values[i];
                  const decimals = s.decimals ?? (s.kind ? MEASURE_META[s.kind].decimals : 0);
                  return (
                    <td key={s.label}>
                      {typeof v === 'number' && Number.isFinite(v) ? fmtNumber(v, decimals) : 'sem registro'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ───────────────────────── Derivação automática ─────────────────────────
// Permite plugar o resumo em cards que já passam `tableColumns`/`tableRows`,
// sem mexer nas páginas que os consomem.

// Sem regex de marcas combinantes (evita `no-misleading-character-class` e
// mantém o arquivo 100% legível): mapa explícito dos acentos do PT-BR.
const ACCENTED = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
const PLAIN = 'aaaaaeeeeiiiiooooouuuucn';

function norm(s: string): string {
  let out = '';
  for (const ch of s.toLowerCase()) {
    const i = ACCENTED.indexOf(ch);
    out += i >= 0 ? (PLAIN[i] ?? ch) : ch;
  }
  return out.trim();
}

/** Rótulos de coluna que são, na verdade, a unidade da medida. */
const UNIT_LABELS = new Set(['mg/dl', 'kg', 'mmhg', 'bpm', 'cm', 'kcal', 'mmol/l', 'ml', '%', 'kg/m2', 'kg/m²']);

/**
 * Descobre a medida a partir do rótulo da coluna + título do card.
 * A coluna tem prioridade: num card "Peso e IMC", a coluna "kg" é peso e a
 * coluna "IMC" é IMC — senão o resumo colaria a faixa errada nos dados.
 */
export function inferMeasureKind(title: string, columnLabel = ''): MeasureKind | null {
  const c = norm(columnLabel);
  const t = norm(title);
  const both = `${t} ${c}`;

  // 1) A coluna é a própria unidade.
  if (c === 'kg') return 'peso';
  if (c === 'kg/m2' || c === 'kg/m²') return 'imc';
  if (c === 'mg/dl' || c === 'mmol/l') return 'glicemia';
  if (c === 'bpm') return 'frequencia_cardiaca';

  // 2) Nome da medida.
  if (both.includes('sistol')) return 'pressao_sistolica';
  if (both.includes('diastol')) return 'pressao_diastolica';
  if (both.includes('glicem')) return 'glicemia';
  if (both.includes('humor')) return 'humor';
  if (both.includes('energia')) return 'energia';
  if (both.includes('batimento') || both.includes('frequencia cardiaca')) return 'frequencia_cardiaca';

  // 3) Peso × IMC: coluna primeiro, título depois.
  if (c.includes('imc')) return 'imc';
  if (c.includes('peso')) return 'peso';
  if (t.includes('peso')) return 'peso';
  if (t.includes('imc')) return 'imc';
  return null;
}

export interface TableLikeColumn {
  key: string;
  label: string;
}

function toNumber(v: string | number | null | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const cleaned = v.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converte as colunas numéricas de uma tabela em séries para o resumo.
 * A 1ª coluna é tratada como eixo (datas) e vira os rótulos das linhas.
 */
export function seriesFromTableRows(
  title: string,
  columns: TableLikeColumn[],
  rows: Record<string, string | number>[],
  opts?: { bandOverrides?: Partial<Record<MeasureKind, ReferenceBand | null>> },
): { series: SummarySeries[]; labels: string[] } {
  const [labelColumn, ...valueColumns] = columns;
  const labels = labelColumn ? rows.map((r) => String(r[labelColumn.key] ?? '')) : [];

  const series: SummarySeries[] = [];
  valueColumns.forEach((col) => {
    const values = rows.map((r) => toNumber(r[col.key]));
    if (!values.some((v) => v != null)) return; // coluna não numérica

    const isUnitLabel = UNIT_LABELS.has(norm(col.label));
    const kind = inferMeasureKind(title, col.label);
    const meta = kind ? MEASURE_META[kind] : null;
    const override = kind ? opts?.bandOverrides?.[kind] : undefined;

    series.push({
      label: isUnitLabel ? title : col.label,
      values,
      unit: isUnitLabel ? col.label : (meta?.unit ?? ''),
      decimals: meta?.decimals ?? 0,
      kind,
      ...(override !== undefined ? { band: override } : {}),
    });
  });

  return { series, labels };
}

/** Extrai "últimos 30 dias" de um aria-label já existente no card. */
export function extractPeriodLabel(text: string): string | undefined {
  const m = /(últimos?\s+\d+\s+dias?|último\s+ano|últimos?\s+\d+\s+meses)/i.exec(text);
  return m?.[0]?.toLowerCase();
}
