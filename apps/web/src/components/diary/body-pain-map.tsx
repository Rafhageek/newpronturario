'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BODY_REGIONS,
  painIntensityColor,
  type BodyRegion,
  type BodyView,
} from '@hubpatients/core';

/**
 * Mapa corporal de dor — SVG de silhueta humana desenhada do zero (flat,
 * gênero-neutro). Cada região é um shape clicável/focável com aria-label
 * em pt-BR, navegação por teclado (Enter/Espaço) e estados idle/hover/selected.
 *
 * É REGISTRO, nunca diagnóstico — nenhum texto interpretativo.
 */

export interface BodyPainMapPoint {
  bodyRegion: string;
  intensity: number;
  side?: string;
}

/**
 * Geometria de cada região por código. As coordenadas casam com `code` do
 * BODY_REGIONS. viewBox 0 0 220 460. Shapes simples formam a silhueta.
 */
type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'path'; d: string };

const REGION_SHAPES: Record<string, Shape> = {
  // ── FRENTE ────────────────────────────────────────────────────────────────
  head_front: { kind: 'ellipse', cx: 110, cy: 34, rx: 24, ry: 28 },
  neck: { kind: 'rect', x: 99, y: 58, w: 22, h: 18, rx: 6 },
  chest: { kind: 'rect', x: 78, y: 78, w: 64, h: 46, rx: 14 },
  abdomen_upper: { kind: 'rect', x: 82, y: 126, w: 56, h: 30, rx: 10 },
  abdomen_lower: { kind: 'rect', x: 82, y: 158, w: 56, h: 34, rx: 12 },
  shoulder_left: { kind: 'ellipse', cx: 70, cy: 88, rx: 14, ry: 13 },
  shoulder_right: { kind: 'ellipse', cx: 150, cy: 88, rx: 14, ry: 13 },
  upper_arm_left: { kind: 'rect', x: 50, y: 98, w: 20, h: 52, rx: 10 },
  upper_arm_right: { kind: 'rect', x: 150, y: 98, w: 20, h: 52, rx: 10 },
  forearm_left: { kind: 'rect', x: 44, y: 152, w: 18, h: 48, rx: 9 },
  forearm_right: { kind: 'rect', x: 158, y: 152, w: 18, h: 48, rx: 9 },
  hand_left: { kind: 'ellipse', cx: 51, cy: 214, rx: 12, ry: 14 },
  hand_right: { kind: 'ellipse', cx: 169, cy: 214, rx: 12, ry: 14 },
  hip_left: { kind: 'rect', x: 82, y: 194, w: 27, h: 26, rx: 10 },
  hip_right: { kind: 'rect', x: 111, y: 194, w: 27, h: 26, rx: 10 },
  thigh_left: { kind: 'rect', x: 84, y: 222, w: 24, h: 70, rx: 11 },
  thigh_right: { kind: 'rect', x: 112, y: 222, w: 24, h: 70, rx: 11 },
  knee_left: { kind: 'ellipse', cx: 96, cy: 304, rx: 13, ry: 13 },
  knee_right: { kind: 'ellipse', cx: 124, cy: 304, rx: 13, ry: 13 },
  shin_left: { kind: 'rect', x: 86, y: 318, w: 20, h: 78, rx: 9 },
  shin_right: { kind: 'rect', x: 114, y: 318, w: 20, h: 78, rx: 9 },
  foot_left: { kind: 'ellipse', cx: 95, cy: 412, rx: 14, ry: 16 },
  foot_right: { kind: 'ellipse', cx: 125, cy: 412, rx: 14, ry: 16 },

  // ── COSTAS ──────────────────────────────────────────────────────────────
  head_back: { kind: 'ellipse', cx: 110, cy: 34, rx: 24, ry: 28 },
  nape: { kind: 'rect', x: 99, y: 58, w: 22, h: 18, rx: 6 },
  upper_back: { kind: 'rect', x: 78, y: 78, w: 64, h: 44, rx: 14 },
  mid_back: { kind: 'rect', x: 82, y: 124, w: 56, h: 36, rx: 10 },
  lower_back: { kind: 'rect', x: 84, y: 162, w: 52, h: 32, rx: 12 },
  buttock_left: { kind: 'rect', x: 82, y: 196, w: 27, h: 30, rx: 12 },
  buttock_right: { kind: 'rect', x: 111, y: 196, w: 27, h: 30, rx: 12 },
};

/**
 * Contorno decorativo da silhueta (não interativo) — dá forma reconhecível de
 * corpo. Cobre cabeça, tronco, braços e pernas. Igual o suficiente para frente
 * e costas; trocamos só as regiões interativas.
 */
const SILHOUETTE_D =
  'M110 4 ' +
  'C124 4 134 16 134 32 C134 44 128 54 119 58 ' +
  'L121 74 C150 78 164 90 164 104 ' + // ombro/braço direito (visual)
  'L176 200 L158 204 L150 156 ' +
  'L150 196 C150 210 146 218 140 224 ' +
  'L138 300 L130 396 L112 398 L110 320 ' +
  'L108 398 L90 396 L82 300 L80 224 ' +
  'C74 218 70 210 70 196 L70 156 L62 204 L44 200 L56 104 ' +
  'C56 90 70 78 99 74 L101 58 C92 54 86 44 86 32 C86 16 96 4 110 4 Z';

/** Props de animação/estilo aplicadas ao shape interno (motion). */
interface AnimatedShapeProps {
  id: string;
  animate: { fill: string };
  stroke: string;
  strokeWidth: number;
  interactive: boolean;
  glow?: string;
}

function AnimatedShape({
  shape,
  interactive,
  glow,
  ...rest
}: { shape: Shape } & AnimatedShapeProps) {
  const common = {
    initial: false as const,
    transition: { duration: 0.4, ease: 'easeOut' as const },
    // Cada shape escala em torno do próprio centro (feedback tátil) sem loop.
    style: {
      transformBox: 'fill-box' as const,
      transformOrigin: 'center' as const,
      filter: glow ? `drop-shadow(0 0 5px ${glow})` : undefined,
    },
    ...(interactive ? { whileHover: { scale: 1.06 }, whileTap: { scale: 0.94 } } : {}),
    ...rest,
  };
  if (shape.kind === 'rect') {
    return (
      <motion.rect
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        rx={shape.rx}
        {...common}
      />
    );
  }
  if (shape.kind === 'ellipse') {
    return (
      <motion.ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...common} />
    );
  }
  return <motion.path d={shape.d} {...common} />;
}

const VIEW_LABEL: Record<BodyView, string> = { front: 'Frente', back: 'Costas' };

export function BodyPainMap({
  points,
  onPickRegion,
  readOnly = false,
}: {
  points: BodyPainMapPoint[];
  onPickRegion?: (code: string) => void;
  /** Modo leitura (heatmap): sem cliques, ainda anunciável por leitor de tela. */
  readOnly?: boolean;
}) {
  const [view, setView] = useState<BodyView>('front');

  const pointByRegion = useMemo(() => {
    const map = new Map<string, BodyPainMapPoint>();
    for (const p of points) map.set(p.bodyRegion, p);
    return map;
  }, [points]);

  const regions = useMemo(
    () => BODY_REGIONS.filter((r) => r.view === view),
    [view],
  );

  function handleActivate(code: string) {
    if (readOnly || !onPickRegion) return;
    onPickRegion(code);
  }

  return (
    <div className="space-y-4">
      {/* Toggle Frente / Costas */}
      <div
        className="inline-flex rounded-xl border border-line bg-surface p-1"
        role="group"
        aria-label="Alternar vista do corpo"
      >
        {(['front', 'back'] as BodyView[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-medium transition ${
              view === v
                ? 'bg-sky-500/20 text-primary'
                : 'text-muted hover:text-fg'
            }`}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <svg
          viewBox="0 0 220 460"
          className="h-auto w-full max-w-[300px]"
          role="group"
          aria-label={`Mapa corporal de dor — vista ${VIEW_LABEL[view].toLowerCase()}`}
        >
          <defs>
            {/* Profundidade sutil no corpo (flat com leve volume) */}
            <linearGradient id="vl-body-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(148,163,184,0.20)" />
              <stop offset="55%" stopColor="rgba(148,163,184,0.13)" />
              <stop offset="100%" stopColor="rgba(100,116,139,0.18)" />
            </linearGradient>
            <filter id="vl-body-shadow" x="-20%" y="-10%" width="140%" height="120%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.18" />
            </filter>
            {/* brilho interno bem leve no topo */}
            <radialGradient id="vl-region-idle" cx="50%" cy="35%" r="75%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
              <stop offset="100%" stopColor="rgba(148,163,184,0.06)" />
            </radialGradient>
          </defs>

          {/* Silhueta de fundo (decorativa) com gradiente + sombra */}
          <path
            d={SILHOUETTE_D}
            fill="url(#vl-body-grad)"
            className="stroke-line"
            strokeWidth={1.5}
            filter="url(#vl-body-shadow)"
            aria-hidden
          />

          {regions.map((region) => (
            <RegionShape
              key={region.code}
              region={region}
              point={pointByRegion.get(region.code)}
              readOnly={readOnly}
              onActivate={handleActivate}
            />
          ))}
        </svg>
      </div>

      <IntensityLegend />
    </div>
  );
}

function RegionShape({
  region,
  point,
  readOnly,
  onActivate,
}: {
  region: BodyRegion;
  point: BodyPainMapPoint | undefined;
  readOnly: boolean;
  onActivate: (code: string) => void;
}) {
  const shape = REGION_SHAPES[region.code];
  if (!shape) return null;

  const selected = point != null;
  const fill = selected ? painIntensityColor(point.intensity) : undefined;

  const ariaLabel = selected
    ? `${region.label_pt} — selecionado, intensidade ${point.intensity} de 10`
    : region.label_pt;

  function onKeyDown(e: React.KeyboardEvent<SVGGElement>) {
    if (readOnly) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      onActivate(region.code);
    }
  }

  // Em modo leitura, o shape continua anunciável mas não é foco de ação.
  const interactive = !readOnly;

  return (
    <motion.g
      data-region-code={region.code}
      role={interactive ? 'button' : 'img'}
      tabIndex={interactive ? 0 : -1}
      aria-label={ariaLabel}
      aria-pressed={interactive ? selected : undefined}
      onClick={interactive ? () => onActivate(region.code) : undefined}
      onKeyDown={onKeyDown}
      className={`outline-none ${
        interactive ? 'cursor-pointer' : ''
      } [&:focus-visible>*]:!stroke-sky-400 [&:focus-visible>*]:!stroke-2 ${
        interactive ? '[&:hover>*]:!stroke-sky-400' : ''
      }`}
    >
      <AnimatedShape
        shape={shape}
        id={region.code}
        interactive={interactive}
        glow={selected ? fill : undefined}
        // idle: gradiente suave; selected: cor da intensidade + halo
        animate={{ fill: fill ?? 'url(#vl-region-idle)' }}
        stroke={selected ? 'rgba(15,23,42,0.55)' : 'rgba(100,116,139,0.55)'}
        strokeWidth={selected ? 1.5 : 1.25}
      />
    </motion.g>
  );
}

const LEGEND_STOPS = [0, 2, 4, 6, 8, 10];

function IntensityLegend() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Sem dor</span>
        <span>Dor intensa</span>
      </div>
      <div
        className="flex h-3 overflow-hidden rounded-full border border-line"
        role="img"
        aria-label="Escala de intensidade da dor, de 0 (sem dor) a 10 (dor intensa), do claro ao escuro"
      >
        {LEGEND_STOPS.map((i) => (
          <span
            key={i}
            className="flex-1"
            style={{ backgroundColor: painIntensityColor(i) }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-faint" aria-hidden>
        {LEGEND_STOPS.map((i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
    </div>
  );
}
