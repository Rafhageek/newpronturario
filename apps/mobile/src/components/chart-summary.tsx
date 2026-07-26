import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useColors, fonts } from '@/theme';
import type { ChartZone } from '@/components/charts';

/**
 * Resumo textual de gráfico (equivalente RN de
 * `apps/web/src/components/analise/chart-summary.tsx`).
 *
 * Gráfico em SVG não é lido por leitor de tela. O padrão consagrado (Highcharts
 * a11y, Audio Graphs da Apple) é oferecer um resumo em texto ao lado do desenho
 * — aqui ele fica VISÍVEL (ajuda todo mundo) e é anunciado de uma vez só pelo
 * TalkBack/VoiceOver via `accessibilityLabel`.
 *
 * A frase é só fato: contagem, menor, maior, média. Nunca diz "normal",
 * "alterado" ou "ruim", e nunca sugere conduta — o app exibe e organiza.
 *
 * Sem `Intl` (Hermes): números formatados na mão, com vírgula decimal.
 */

export type MeasureKind =
  | 'pressao_sistolica'
  | 'pressao_diastolica'
  | 'glicemia'
  | 'peso'
  | 'imc'
  | 'frequencia_cardiaca'
  | 'humor'
  | 'energia';

export interface MeasureMeta {
  label: string;
  unit: string;
  decimals: number;
}

export const MEASURE_META: Record<MeasureKind, MeasureMeta> = {
  pressao_sistolica: { label: 'Pressão sistólica', unit: 'mmHg', decimals: 0 },
  pressao_diastolica: { label: 'Pressão diastólica', unit: 'mmHg', decimals: 0 },
  glicemia: { label: 'Glicemia', unit: 'mg/dL', decimals: 0 },
  peso: { label: 'Peso', unit: 'kg', decimals: 1 },
  imc: { label: 'IMC', unit: 'kg/m²', decimals: 1 },
  frequencia_cardiaca: { label: 'Frequência cardíaca', unit: 'bpm', decimals: 0 },
  humor: { label: 'Humor', unit: '', decimals: 0 },
  energia: { label: 'Energia', unit: '', decimals: 0 },
};

export interface ReferenceBand {
  kind: MeasureKind;
  from: number;
  to: number;
  unit: string;
  decimals: number;
  source: string;
}

export const REFERENCE_BAND_NOTE =
  'A faixa é uma referência geral da literatura para orientar a leitura do gráfico — não é diagnóstico nem avaliação do seu resultado. Só seu médico interpreta.';

/**
 * Faixas de referência (mesmos valores e fontes da web):
 * - Pressão: Diretrizes Brasileiras de Hipertensão Arterial 2020 (SBC/SBH/SBN).
 * - Glicemia: consenso internacional de tempo-na-faixa em CGM (Diabetes Care, 2019).
 * - IMC/peso: classificação da OMS para adultos (18,5–24,9 kg/m²).
 * - Frequência cardíaca de repouso: American Heart Association.
 * Escalas subjetivas (humor/energia) e peso sem altura não têm faixa: retorna null.
 */
export function referenceBandFor(
  kind: MeasureKind,
  opts?: { heightCm?: number | null },
): ReferenceBand | null {
  const meta = MEASURE_META[kind];
  const base = { kind, unit: meta.unit, decimals: meta.decimals };
  switch (kind) {
    case 'pressao_sistolica':
      return { ...base, from: 90, to: 130, source: 'Diretrizes Brasileiras de Hipertensão Arterial 2020' };
    case 'pressao_diastolica':
      return { ...base, from: 60, to: 85, source: 'Diretrizes Brasileiras de Hipertensão Arterial 2020' };
    case 'glicemia':
      return { ...base, from: 70, to: 180, source: 'Consenso internacional de tempo-na-faixa em CGM (2019)' };
    case 'imc':
      return { ...base, from: 18.5, to: 24.9, source: 'Classificação de IMC da OMS' };
    case 'frequencia_cardiaca':
      return { ...base, from: 60, to: 100, source: 'Frequência cardíaca de repouso do adulto (AHA)' };
    case 'peso': {
      const h = opts?.heightCm;
      if (!h || h < 80 || h > 250) return null;
      const m = h / 100;
      return {
        ...base,
        from: Math.round(18.5 * m * m * 10) / 10,
        to: Math.round(24.9 * m * m * 10) / 10,
        source: 'Faixa derivada do IMC 18,5–24,9 da OMS',
      };
    }
    case 'humor':
    case 'energia':
      return null;
  }
}

/** Número em PT-BR sem `Intl` (Hermes não tem os formatadores completos). */
export function fmtNumber(n: number, decimals = 0): string {
  const fixed = n.toFixed(decimals);
  return decimals > 0 ? fixed.replace('.', ',') : fixed;
}

/** "70 a 180 mg/dL" */
export function bandRangeText(band: ReferenceBand): string {
  const unit = band.unit ? ` ${band.unit}` : '';
  return `${fmtNumber(band.from, band.decimals)} a ${fmtNumber(band.to, band.decimals)}${unit}`;
}

/** Rótulo curto desenhado dentro do gráfico ("faixa de referência 70–180 mg/dL"). */
export function bandZoneLabel(band: ReferenceBand): string {
  const unit = band.unit ? ` ${band.unit}` : '';
  return `faixa de referência ${fmtNumber(band.from, band.decimals)}–${fmtNumber(band.to, band.decimals)}${unit}`;
}

/** Converte a faixa numa `zone` rotulada do `LineChart`. */
export function bandToZone(band: ReferenceBand | null, color: string): ChartZone | null {
  if (!band) return null;
  return { from: band.from, to: band.to, color, label: bandZoneLabel(band) };
}

export interface SummarySeries {
  label: string;
  values: (number | null | undefined)[];
  unit?: string;
  decimals?: number;
  kind?: MeasureKind | null;
  band?: ReferenceBand | null;
  /** Substantivo da contagem (padrão "medição"/"medições"). */
  noun?: { one: string; many: string };
}

function statsOf(values: (number | null | undefined)[]) {
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
 * Frases-resumo, uma por série:
 * "Pressão arterial — sistólica (mmHg), últimos 30 dias: 28 medições,
 *  menor 112, maior 158, média 131,3."
 * Com faixa de referência, uma 2ª frase diz a faixa e quantas medições
 * caíram dentro dela (contagem factual, sem julgamento).
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
    const noun = s.noun ?? defaultNoun(s.kind);
    const head = `${name}${unit ? ` (${unit})` : ''}${periodLabel ? `, ${periodLabel}` : ''}`;
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
    let inside = 0;
    let total = 0;
    s.values.forEach((v) => {
      if (typeof v !== 'number' || Number.isNaN(v)) return;
      total += 1;
      if (v >= band.from && v <= band.to) inside += 1;
    });
    out.push(
      `Faixa de referência exibida no gráfico: ${bandRangeText(band)} — ` +
        `${inside} de ${total} ${total === 1 ? `${noun.one} ficou` : `${noun.many} ficaram`} dentro dela. ` +
        'A faixa é uma referência geral, não um diagnóstico.',
    );
  });

  return out;
}

/** Tudo numa string só — pronto para `accessibilityLabel` / prop `summary` do LineChart. */
export function buildSummaryText(args: Parameters<typeof buildSummarySentences>[0]): string {
  return buildSummarySentences(args).join(' ');
}

export interface ChartSummaryProps {
  title: string;
  /** "últimos 30 dias" — entra na frase como está. */
  periodLabel?: string;
  series: SummarySeries[];
  /** Também explica a faixa por extenso (nota "não é diagnóstico"). */
  showBandNote?: boolean;
  includeBand?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bloco de texto que substitui o gráfico para quem usa leitor de tela.
 * O gráfico em si deve ficar escondido do leitor (`LineChart` já faz isso).
 */
export function ChartSummary({
  title,
  periodLabel,
  series,
  showBandNote = false,
  includeBand = true,
  style,
}: ChartSummaryProps) {
  const colors = useColors();
  const sentences = buildSummarySentences({ title, periodLabel, series, includeBand });
  if (sentences.length === 0) return null;

  const text = sentences.join(' ');
  const bands = series.map(resolveBand).filter((b): b is ReferenceBand => b != null);
  const note = showBandNote && bands.length > 0 ? REFERENCE_BAND_NOTE : null;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={note ? `${text} ${note}` : text}
      style={style}
    >
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.fgSoft }}>{text}</Text>
      {note ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 4 }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}
