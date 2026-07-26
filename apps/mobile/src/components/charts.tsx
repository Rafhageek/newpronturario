import { useEffect, useId, useRef, useState } from 'react';
import { View, Text, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Rect,
  Path,
  Circle,
  G,
  Line as SvgLine,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { motion } from '@hubpatients/ui-tokens';
import { useColors, fonts } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Curva assinatura do produto (a mesma de .vl-rise na web). */
const EASE_SIGNATURE = Easing.bezier(...motion.easing.signature);

export type ChartSeries = { points: { x: number; y: number }[]; color?: string };
/**
 * Faixa horizontal de referência. `label` é opcional e, quando presente, a faixa
 * ganha contorno tracejado + rótulo em texto — para não depender só de cor
 * (WCAG 1.4.1). Ver `chart-summary.tsx` (`bandToZone`) para faixas prontas.
 */
export type ChartZone = { from: number; to: number; color: string; label?: string };

type Pt = { x: number; y: number };

function polyD(pts: Pt[]) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
}

function pathLen(pts: Pt[]) {
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (!a || !b) continue;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return Math.max(1, len);
}

/** Traço que se "desenha" na entrada (strokeDashoffset animado). */
function SeriesLine({ pts, color, progress }: { pts: Pt[]; color: string; progress: SharedValue<number> }) {
  const length = pathLen(pts);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));
  return (
    <AnimatedPath
      d={polyD(pts)}
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeDasharray={length}
      animatedProps={animatedProps}
    />
  );
}

/**
 * Gráfico de linha responsivo em react-native-svg (substitui o recharts da web).
 * Múltiplas séries + zonas de referência (faixas horizontais) + grade de fundo,
 * preenchimento em gradiente sob a 1ª série e animação de entrada do traço.
 *
 * ACESSIBILIDADE: o SVG nunca é lido por leitor de tela, então ele é marcado
 * como escondido (`accessibilityElementsHidden` / `importantForAccessibility`)
 * e quem carrega a informação é a prop `summary` (ou um `<ChartSummary>` ao
 * lado). Assim o TalkBack/VoiceOver lê uma frase útil em vez de nada.
 */
export function LineChart({
  series,
  zones = [],
  height = 180,
  yMin,
  yMax,
  formatY = (n) => String(Math.round(n)),
  summary,
  showZoneLabels = true,
}: {
  series: ChartSeries[];
  zones?: ChartZone[];
  height?: number;
  yMin?: number;
  yMax?: number;
  formatY?: (n: number) => string;
  /**
   * Resumo acessível do gráfico (use `buildSummaryText` de `chart-summary.tsx`).
   * Aparece como legenda em texto abaixo do gráfico — visível para todos — e é
   * o que o leitor de tela anuncia no lugar do SVG.
   */
  summary?: string;
  /** Desenha contorno tracejado + rótulo das `zones` que tiverem `label`. */
  showZoneLabels?: boolean;
}) {
  const colors = useColors();
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const reduce = useReducedMotion();
  const progress = useSharedValue(0);
  const gid = useId().replace(/:/g, ''); // id único e válido p/ o gradiente (evita colisão entre gráficos)
  const drawn = useRef(false);
  const hasPoints = series.some((s) => s.points.length > 0);

  /**
   * O traço se desenha UMA única vez — no primeiro render em que já existe
   * largura medida e pelo menos um ponto. Refetch, troca de filtro de período,
   * rotação da tela ou mudança do nº de séries NÃO redesenham: dado clínico que
   * se remexe enquanto está sendo lido é dado em que não se confia (P2), e o
   * redesenho a cada atualização também violava o teto de movimento periférico.
   */
  useEffect(() => {
    if (w <= 0 || !hasPoints || drawn.current) return;
    drawn.current = true;
    progress.value = reduce
      ? 1
      : withTiming(1, { duration: motion.duration.draw, easing: EASE_SIGNATURE });
  }, [w, hasPoints, reduce, progress]);

  /*
   * BLINDAGEM CONTRA NaN/Infinity — não é paranoia, é crash nativo.
   *
   * Uma única coordenada não-finita chegando ao react-native-svg derruba o app
   * no Android, e o `ErrorBoundary` NÃO pega (o erro é do lado nativo, não do
   * render), então a pessoa só vê o app fechar. E é fácil de acontecer sem
   * ninguém notar: um `Math.max(160, ...valores)` com um valor `undefined` já
   * devolve NaN, e esse NaN vira `yMax` -> vira `sy(y)` -> vira `d` do <Path>.
   * Aqui o gráfico prefere ignorar o ponto ruim a levar o app com ele.
   */
  const cleanSeries = series.map((s) => ({
    ...s,
    points: s.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  }));
  const cleanZones = zones.filter((z) => Number.isFinite(z.from) && Number.isFinite(z.to));
  const yMinProp = Number.isFinite(yMin) ? yMin : undefined;
  const yMaxProp = Number.isFinite(yMax) ? yMax : undefined;

  const ys = cleanSeries.flatMap((s) => s.points.map((p) => p.y));
  const xs = cleanSeries.flatMap((s) => s.points.map((p) => p.x));
  if (ys.length === 0 || xs.length === 0) {
    return (
      <View>
        <View style={{ height }} />
        {summary ? <AccessibleCaption text={summary} /> : null}
      </View>
    );
  }

  const rawMinY = yMinProp ?? Math.min(...ys, ...cleanZones.map((z) => z.from)) * 0.95;
  const rawMaxY = yMaxProp ?? Math.max(...ys, ...cleanZones.map((z) => z.to)) * 1.05;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  // Último anteparo: se ainda assim o domínio não for finito, cai num intervalo
  // neutro em vez de mandar NaN para o SVG.
  const minY = Number.isFinite(rawMinY) ? rawMinY : 0;
  const maxY = Number.isFinite(rawMaxY) && rawMaxY > minY ? rawMaxY : minY + 1;

  const padL = 32;
  const padR = 8;
  const padT = 10;
  const padB = 8;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = height - padT - padB;
  const baseline = padT + innerH;

  const sx = (x: number) => padL + (maxX === minX ? 0.5 : (x - minX) / (maxX - minX)) * innerW;
  const sy = (y: number) => padT + (1 - (maxY === minY ? 0.5 : (y - minY) / (maxY - minY))) * innerH;
  const clampY = (y: number) => Math.min(padT + innerH, Math.max(padT, y));
  const insideDomain = (y: number) => y >= minY && y <= maxY;

  // Pontos em coordenadas de tela, por série.
  const screenSeries = cleanSeries.map((s) => ({
    color: s.color ?? colors.primary,
    pts: s.points.map((p) => ({ x: sx(p.x), y: sy(p.y) })),
  }));

  // Área sob a 1ª série (preenchimento em gradiente que desbota até o eixo).
  const first = screenSeries[0];
  let areaD = '';
  let areaColor: string = colors.primary;
  if (first && first.pts.length >= 2) {
    const fp = first.pts[0];
    const lp = first.pts[first.pts.length - 1];
    if (fp && lp) {
      areaD = `${polyD(first.pts)} L ${lp.x},${baseline} L ${fp.x},${baseline} Z`;
      areaColor = first.color;
    }
  }

  const yLabels = [maxY, (maxY + minY) / 2, minY];

  return (
    <View>
      {/* O SVG nunca é lido por leitor de tela: escondemos e informamos por texto. */}
      <View
        onLayout={onLayout}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {w > 0 ? (
          <Svg width={w} height={height}>
            <Defs>
              <SvgLinearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={areaColor} stopOpacity={0.18} />
                <Stop offset="1" stopColor={areaColor} stopOpacity={0} />
              </SvgLinearGradient>
            </Defs>

            {/* Zonas de referência */}
            {cleanZones.map((z, i) => (
              <Rect
                key={`z${i}`}
                x={padL}
                y={clampY(sy(z.to))}
                width={innerW}
                height={Math.max(0, clampY(sy(z.from)) - clampY(sy(z.to)))}
                fill={z.color}
                opacity={0.12}
              />
            ))}

            {/* Faixa rotulada: contorno tracejado + texto, para a faixa não ser
                comunicada só por cor (WCAG 1.4.1). */}
            {showZoneLabels
              ? cleanZones.map((z, i) =>
                  z.label ? (
                    <G key={`zl${i}`}>
                      {insideDomain(z.to) ? (
                        <SvgLine
                          x1={padL}
                          y1={clampY(sy(z.to))}
                          x2={padL + innerW}
                          y2={clampY(sy(z.to))}
                          stroke={z.color}
                          strokeWidth={1}
                          strokeDasharray="4 4"
                          opacity={0.9}
                        />
                      ) : null}
                      {insideDomain(z.from) ? (
                        <SvgLine
                          x1={padL}
                          y1={clampY(sy(z.from))}
                          x2={padL + innerW}
                          y2={clampY(sy(z.from))}
                          stroke={z.color}
                          strokeWidth={1}
                          strokeDasharray="4 4"
                          opacity={0.9}
                        />
                      ) : null}
                      <SvgText
                        x={padL + innerW - 2}
                        y={Math.min(baseline - 3, clampY(sy(z.to)) + 10)}
                        fontSize={9}
                        fill={colors.muted}
                        textAnchor="end"
                      >
                        {z.label}
                      </SvgText>
                    </G>
                  ) : null,
                )
              : null}

            {/* Grade horizontal (topo + meio) — orienta a leitura sem poluir */}
            {[yLabels[0], yLabels[1]].map((v, i) =>
              v == null ? null : (
                <SvgLine
                  key={`g${i}`}
                  x1={padL}
                  y1={sy(v)}
                  x2={padL + innerW}
                  y2={sy(v)}
                  stroke={colors.line}
                  strokeWidth={1}
                  opacity={0.7}
                />
              ),
            )}

            {/* Área sob a 1ª série */}
            {areaD ? <Path d={areaD} fill={`url(#area-${gid})`} /> : null}

            {/* Eixo Y (3 rótulos) */}
            {yLabels.map((v, i) =>
              v == null ? null : (
                <SvgText key={`y${i}`} x={padL - 5} y={sy(v) + 3} fontSize={9} fill={colors.muted} textAnchor="end">
                  {formatY(v)}
                </SvgText>
              ),
            )}
            <SvgLine x1={padL} y1={baseline} x2={padL + innerW} y2={baseline} stroke={colors.line} strokeWidth={1} />

            {/* Linhas (com animação de entrada) */}
            {screenSeries.map((s, si) => (
              <SeriesLine key={`l${si}`} pts={s.pts} color={s.color} progress={progress} />
            ))}

            {/* Pontos */}
            {screenSeries.flatMap((s, si) =>
              s.pts.map((p, pi) => <Circle key={`c${si}-${pi}`} cx={p.x} cy={p.y} r={3} fill={s.color} />),
            )}
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>

      {/* Resumo textual: o que o leitor de tela anuncia no lugar do gráfico —
          e uma legenda útil para quem enxerga. */}
      {summary ? <AccessibleCaption text={summary} /> : null}
    </View>
  );
}

/** Legenda em texto lida de uma vez pelo leitor de tela. */
function AccessibleCaption({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={text} style={{ marginTop: 6 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.fgSoft }}>{text}</Text>
    </View>
  );
}
