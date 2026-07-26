import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Path, Rect, Ellipse, G } from 'react-native-svg';
import { BODY_REGIONS, bodyRegionLabel, type BodyView } from '@hubpatients/core';
import { fonts, useColors } from '@/theme';

/**
 * Mapa corporal de dor (mobile) — silhueta humana portada do componente web
 * `apps/web/src/components/diary/body-pain-map.tsx` para react-native-svg.
 *
 * Dois modos:
 * - Leitura (sem `onPickRegion`): heatmap — cada região é colorida pela
 *   intensidade registrada (verde → amarelo → vermelho). Comportamento
 *   original; nada toca/seleciona.
 * - Interativo (com `onPickRegion`): cada região vira tocável (Path/Rect/
 *   Ellipse com onPress) e a região selecionada ganha destaque. Usado na
 *   tela do diário para marcar pontos de dor.
 *
 * É REGISTRO, nunca diagnóstico — nenhum texto interpretativo aqui.
 */

export interface BodyPainMapPoint {
  bodyRegion: string;
  intensity: number;
}

/** Geometria de cada região por código (viewBox 0 0 220 460) — igual à web. */
type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

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

/** Contorno decorativo da silhueta (não interativo) — idêntico ao da web. */
const SILHOUETTE_D =
  'M110 4 ' +
  'C124 4 134 16 134 32 C134 44 128 54 119 58 ' +
  'L121 74 C150 78 164 90 164 104 ' +
  'L176 200 L158 204 L150 156 ' +
  'L150 196 C150 210 146 218 140 224 ' +
  'L138 300 L130 396 L112 398 L110 320 ' +
  'L108 398 L90 396 L82 300 L80 224 ' +
  'C74 218 70 210 70 196 L70 156 L62 204 L44 200 L56 104 ' +
  'C56 90 70 78 99 74 L101 58 C92 54 86 44 86 32 C86 16 96 4 110 4 Z';

/**
 * Cor do heatmap por intensidade (0–10): verde → amarelo → vermelho.
 * 0 (ou sem dados) usa um cinza neutro de corpo.
 */
export function painHeatColor(intensity: number): string {
  const i = Math.max(0, Math.min(10, intensity));
  if (i <= 0) return '#e5e7eb'; // sem dor
  if (i <= 2) return '#86efac'; // verde
  if (i <= 4) return '#fde047'; // amarelo
  if (i <= 6) return '#fb923c'; // laranja
  if (i <= 8) return '#ef4444'; // vermelho
  return '#b91c1c'; // vermelho intenso
}

const BODY_FILL = 'rgba(148,163,184,0.16)';
const REGION_IDLE = 'rgba(148,163,184,0.10)';

const VIEW_LABEL: Record<BodyView, string> = { front: 'Frente', back: 'Costas' };

function ShapeNode({
  shape,
  fill,
  stroke,
  strokeWidth = 1.25,
  onPress,
  accessibilityLabel,
}: {
  shape: Shape;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  /** Quando definido, o shape vira tocável (modo interativo). */
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const a11y = onPress
    ? {
        onPress,
        accessibilityRole: 'button' as const,
        accessibilityLabel,
      }
    : {};
  if (shape.kind === 'rect') {
    return (
      <Rect
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        rx={shape.rx}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        {...a11y}
      />
    );
  }
  return (
    <Ellipse
      cx={shape.cx}
      cy={shape.cy}
      rx={shape.rx}
      ry={shape.ry}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      {...a11y}
    />
  );
}

const LEGEND_STOPS = [0, 2, 4, 6, 8, 10];

export function BodyPainMap({
  points,
  onPickRegion,
  selectedRegion,
}: {
  points: BodyPainMapPoint[];
  /**
   * Quando definido, ativa o modo interativo: as regiões viram tocáveis e
   * `onPickRegion(code)` é chamado ao tocar numa delas. Sem ele, o mapa é
   * 100% somente-leitura (heatmap), como antes.
   */
  onPickRegion?: (regionId: string) => void;
  /** Região atualmente em foco (realça mesmo sem ponto salvo ainda). */
  selectedRegion?: string | null;
}) {
  const colors = useColors();
  const [view, setView] = useState<BodyView>('front');

  const intensityByRegion = new Map<string, number>();
  for (const p of points) intensityByRegion.set(p.bodyRegion, p.intensity);

  const regions = BODY_REGIONS.filter((r) => r.view === view);

  return (
    <View className="gap-4">
      {/* Toggle Frente / Costas */}
      <View
        style={{ borderCurve: 'continuous' }}
        className="flex-row gap-1 self-start rounded-2xl border border-line bg-surface-2 p-1"
      >
        {(['front', 'back'] as BodyView[]).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={{ borderCurve: 'continuous' }}
            className={`rounded-xl px-4 py-2 ${view === v ? 'bg-trust-100' : ''}`}
          >
            <Text
              style={{ fontFamily: fonts.semibold }}
              className={`text-[12px] ${view === v ? 'text-primary' : 'text-muted'}`}
            >
              {VIEW_LABEL[v]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Silhueta */}
      <View className="items-center">
        <Svg width={220} height={460} viewBox="0 0 220 460">
          {/* Corpo de fundo (decorativo) */}
          <Path d={SILHOUETTE_D} fill={BODY_FILL} stroke={colors.line} strokeWidth={1.5} />

          {regions.map((region) => {
            const shape = REGION_SHAPES[region.code];
            if (!shape) return null;
            const intensity = intensityByRegion.get(region.code);
            const active = intensity != null && intensity > 0;
            const isSelected = selectedRegion === region.code;
            const fill = active ? painHeatColor(intensity) : REGION_IDLE;
            const stroke = isSelected
              ? colors.primary
              : active
                ? 'rgba(15,23,42,0.45)'
                : 'rgba(100,116,139,0.45)';
            const strokeWidth = isSelected ? 2.5 : 1.25;
            const label = active
              ? `${bodyRegionLabel(region.code)}, intensidade ${intensity} de 10`
              : bodyRegionLabel(region.code);
            return (
              <G key={region.code}>
                <ShapeNode
                  shape={shape}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  onPress={onPickRegion ? () => onPickRegion(region.code) : undefined}
                  accessibilityLabel={label}
                />
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Legenda de intensidade */}
      <View className="gap-1.5">
        <View className="flex-row justify-between">
          <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
            Sem dor
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
            Dor intensa
          </Text>
        </View>
        <View
          style={{ borderCurve: 'continuous' }}
          className="h-3 flex-row overflow-hidden rounded-full border border-line"
        >
          {LEGEND_STOPS.map((i) => (
            <View key={i} style={{ flex: 1, backgroundColor: painHeatColor(i) }} />
          ))}
        </View>
        <View className="flex-row justify-between">
          {LEGEND_STOPS.map((i) => (
            <Text key={i} style={{ fontFamily: fonts.regular }} className="text-[10px] text-faint">
              {i}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}
