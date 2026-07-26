'use client';

import type { ReactElement } from 'react';
import { ReferenceArea, ReferenceLine } from 'recharts';

/**
 * Faixas de referência dos gráficos clínicos.
 *
 * REGRA DO PRODUTO: o app **exibe e organiza, nunca interpreta**. A faixa é um
 * enquadramento VISUAL de leitura (igual à régua impressa de um laudo) — não é
 * diagnóstico, não classifica o resultado como "normal/alterado" e não sugere
 * conduta. Por isso a faixa é desenhada em cinza-azulado NEUTRO (nunca verde /
 * amarelo / vermelho, que carregam julgamento) e sempre acompanhada de rótulo
 * textual + hachura, para não depender só de cor (WCAG 1.4.1).
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
  /** Nome legível da medida (usado nas frases-resumo). */
  label: string;
  unit: string;
  /** Casas decimais na exibição. */
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
  /** Linhas tracejadas extras (limites citados nas diretrizes). */
  marks: { value: number; label: string }[];
  /** De onde veio a faixa (aparece na legenda). */
  source: string;
}

/**
 * Cinza-azulado neutro, sem semântica de semáforo.
 *
 * Estes são apenas o FALLBACK: o valor que vale é o `colors` que os gráficos
 * passam a partir de `useChartPalette()` (tokens `status.*.neutro`), porque o
 * traço precisa de ≥3:1 e o rótulo de ≥4,5:1 em CADA tema — o #64748B anterior
 * dava 3,9:1 sobre o canvas creme, reprovando para o texto de 10px do rótulo.
 */
export const BAND_COLOR = '#768498'; /* mark neutro — 3,1:1 */
/** Texto dos rótulos dentro do gráfico. */
export const BAND_TEXT = '#475262'; /* ink neutro — 7,9:1 */

/** Cores da faixa, resolvidas por tema (ver `chart-theme.ts`). */
export interface BandColors {
  /** Traço, hachura e borda da área. */
  band?: string;
  /** Rótulo textual desenhado dentro do gráfico. */
  ink?: string;
}

const NOTE =
  'A faixa é uma referência geral da literatura para orientar a leitura do gráfico — não é diagnóstico nem avaliação do seu resultado. Só seu médico interpreta com o contexto completo.';

/** Explicação fixa que acompanha toda faixa (usada na legenda e nos resumos). */
export const REFERENCE_BAND_NOTE = NOTE;

/**
 * Faixa de referência de cada medida. Retorna `null` quando não existe faixa
 * defensável (escalas subjetivas como humor/energia, ou peso sem altura).
 *
 * Fontes:
 * - Pressão arterial: Diretrizes Brasileiras de Hipertensão Arterial 2020
 *   (SBC/SBH/SBN) — PA ótima < 120/80; normal até 129/84; pré-hipertensão a
 *   partir de 130/85; hipertensão em consultório a partir de 140/90 mmHg.
 *   Limite inferior 90/60 mmHg (hipotensão, mesma diretriz).
 * - Glicemia: consenso internacional de tempo-na-faixa para CGM
 *   (Battelino et al., Diabetes Care 2019; incorporado ao ADA Standards of
 *   Care) — faixa-alvo 70–180 mg/dL.
 * - IMC / peso: classificação da OMS para adultos (18,5–24,9 kg/m²), adotada
 *   pelo SISVAN / Ministério da Saúde. O peso em kg só ganha faixa quando a
 *   altura é conhecida (a faixa é derivada do IMC).
 * - Frequência cardíaca de repouso: 60–100 bpm (American Heart Association).
 */
export function referenceBandFor(
  kind: MeasureKind,
  opts?: { heightCm?: number | null },
): ReferenceBand | null {
  const meta = MEASURE_META[kind];
  const base = { kind, unit: meta.unit, decimals: meta.decimals };

  switch (kind) {
    case 'pressao_sistolica':
      return {
        ...base,
        from: 90,
        to: 130,
        marks: [{ value: 140, label: '140 mmHg' }],
        source: 'Diretrizes Brasileiras de Hipertensão Arterial 2020 (SBC/SBH/SBN)',
      };
    case 'pressao_diastolica':
      return {
        ...base,
        from: 60,
        to: 85,
        marks: [{ value: 90, label: '90 mmHg' }],
        source: 'Diretrizes Brasileiras de Hipertensão Arterial 2020 (SBC/SBH/SBN)',
      };
    case 'glicemia':
      return {
        ...base,
        from: 70,
        to: 180,
        marks: [],
        source: 'Consenso internacional de tempo-na-faixa em CGM (Diabetes Care, 2019)',
      };
    case 'imc':
      return {
        ...base,
        from: 18.5,
        to: 24.9,
        marks: [],
        source: 'Classificação de IMC da OMS para adultos',
      };
    case 'frequencia_cardiaca':
      return {
        ...base,
        from: 60,
        to: 100,
        marks: [],
        source: 'Frequência cardíaca de repouso do adulto (American Heart Association)',
      };
    case 'peso': {
      const h = opts?.heightCm;
      // Sem altura não há faixa possível: peso isolado não tem referência.
      if (!h || h < 80 || h > 250) return null;
      const m = h / 100;
      return {
        ...base,
        from: round1(18.5 * m * m),
        to: round1(24.9 * m * m),
        marks: [],
        source: `Faixa derivada do IMC 18,5–24,9 da OMS para ${round1(h)} cm de altura`,
      };
    }
    // Escalas subjetivas de 1 a 5: não existe "faixa de referência".
    case 'humor':
    case 'energia':
      return null;
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Número em PT-BR (vírgula decimal). Não usa Intl — mesma regra do mobile. */
export function fmtBandValue(n: number, decimals: number): string {
  const fixed = n.toFixed(decimals);
  return decimals > 0 ? fixed.replace('.', ',') : fixed;
}

/** "70 a 180 mg/dL" */
export function bandRangeText(band: ReferenceBand): string {
  const unit = band.unit ? ` ${band.unit}` : '';
  return `${fmtBandValue(band.from, band.decimals)} a ${fmtBandValue(band.to, band.decimals)}${unit}`;
}

/** Quantas medições caíram dentro da faixa (contagem factual, sem julgamento). */
export function countInsideBand(values: (number | null | undefined)[], band: ReferenceBand) {
  let inside = 0;
  let total = 0;
  for (const v of values) {
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    total += 1;
    if (v >= band.from && v <= band.to) inside += 1;
  }
  return { inside, total };
}

/**
 * Elementos Recharts da faixa. **Chame como função** (não como componente):
 * o Recharts só entende `ReferenceArea`/`ReferenceLine` como filhos diretos.
 *
 * ```tsx
 * <LineChart>{referenceBandElements(band, uid)}<Line … /></LineChart>
 * ```
 *
 * `uid` precisa ser único por gráfico (use `useId()`), senão dois gráficos na
 * mesma página compartilham o `id` da hachura.
 */
export function referenceBandElements(
  band: ReferenceBand | null,
  uid: string,
  opts?: {
    labelPosition?: 'insideTopLeft' | 'insideBottomLeft';
    labelText?: string;
    /** Cores por tema — venha sempre de `useChartPalette()`. */
    colors?: BandColors;
  },
): ReactElement[] {
  if (!band) return [];
  const id = `faixa-ref-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}-${band.kind}`;
  const unit = band.unit ? ` ${band.unit}` : '';
  const line = opts?.colors?.band ?? BAND_COLOR;
  const ink = opts?.colors?.ink ?? BAND_TEXT;

  const els: ReactElement[] = [
    // Hachura diagonal: a faixa não depende só de cor (WCAG 1.4.1).
    <defs key={`${id}-defs`}>
      <pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={8} height={8} fill={line} fillOpacity={0.1} />
        <line x1={0} y1={0} x2={0} y2={8} stroke={line} strokeWidth={1.5} strokeOpacity={0.3} />
      </pattern>
    </defs>,
    <ReferenceArea
      key={`${id}-area`}
      y1={band.from}
      y2={band.to}
      ifOverflow="extendDomain"
      fill={`url(#${id})`}
      fillOpacity={1}
      stroke={line}
      strokeOpacity={0.6}
      strokeDasharray="4 4"
      label={{
        value:
          opts?.labelText ??
          `faixa de referência ${fmtBandValue(band.from, band.decimals)}–${fmtBandValue(band.to, band.decimals)}${unit}`,
        position: opts?.labelPosition ?? 'insideTopLeft',
        fill: ink,
        fontSize: 11,
      }}
    />,
  ];

  band.marks.forEach((m) => {
    els.push(
      <ReferenceLine
        key={`${id}-mark-${m.value}`}
        y={m.value}
        ifOverflow="extendDomain"
        stroke={line}
        strokeOpacity={0.85}
        strokeDasharray="2 4"
        label={{ value: m.label, position: 'insideBottomLeft', fill: ink, fontSize: 11 }}
      />,
    );
  });

  return els;
}

/**
 * Legenda textual da faixa — fora do `<figure role="img">`, para que leitores
 * de tela leiam a explicação (o SVG em si não é lido).
 */
export function ReferenceBandLegend({
  bands,
  className = '',
}: {
  bands: (ReferenceBand | null)[];
  className?: string;
}) {
  const shown = bands.filter((b): b is ReferenceBand => b != null);
  if (shown.length === 0) return null;

  // Uma linha por faixa distinta (pressão tem sistólica e diastólica).
  const unique = shown.filter((b, i) => shown.findIndex((x) => x.kind === b.kind) === i);

  return (
    <div className={`mt-2 space-y-1 ${className}`}>
      {unique.map((band) => (
        <p key={band.kind} className="flex items-start gap-2 text-caption text-muted">
          {/* Amostra em HTML (não SVG): aqui a CSS var funciona e o tema troca
              sem JS. 11px foi para 13px — 11 é inutilizável para nosso público. */}
          <span
            aria-hidden="true"
            className="mt-[3px] h-3 w-6 shrink-0 rounded-[3px] border border-dashed"
            style={{
              borderColor: 'var(--chart-band, #768498)',
              backgroundImage:
                'repeating-linear-gradient(45deg, color-mix(in srgb, var(--chart-band, #768498) 28%, transparent) 0 2px, transparent 2px 6px)',
            }}
          />
          <span>
            <span className="font-medium text-fg-soft">
              Faixa de referência ({MEASURE_META[band.kind].label.toLowerCase()}): {bandRangeText(band)}.
            </span>{' '}
            {NOTE} <span className="text-hint">Fonte: {band.source}.</span>
          </span>
        </p>
      ))}
    </div>
  );
}
