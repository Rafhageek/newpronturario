import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, useWindowDimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useColorScheme } from 'nativewind';
import {
  colors as sharedColors,
  a11y as sharedA11y,
  surfaceLight,
  surfaceDark,
  inkLight,
  inkDark,
  status as sharedStatus,
  statusMeta as sharedStatusMeta,
  chart as sharedChart,
  elevationDark as sharedElevationDark,
  spacePx,
  radiusPx,
  chipPastel as sharedChipPastel,
  painelSurfaceLight,
  painelSurfaceDark,
  painelInkLight,
  painelInkDark,
  shadowPainel,
  shadowToRn,
  type ChipTone,
} from '@hubpatients/ui-tokens';

/**
 * Redesign "Papel Clínico Quente + Expressivo" (2026-07-25).
 * Fundação e contrastes calculados: docs/REDESIGN-2026-07.md.
 *
 * Reexportamos os tokens compartilhados para que as telas do mobile tenham um
 * ponto único de import (`@/theme`) — não duplicamos valores aqui.
 */
export {
  /** Status com 3 papéis (ink / mark / tint) por tema. Cor NUNCA sozinha. */
  sharedStatus as status,
  /** Glifo + rótulo de cada status (SC 1.4.1 — cor nunca sozinha). */
  sharedStatusMeta as statusMeta,
  /** Paleta neutra-clínica de séries de gráfico (sem verde/vermelho). */
  sharedChart as chart,
  /**
   * Elevação no tema ESCURO: degrau tonal + hairline (sombra não se lê sobre
   * preto). Use no lugar de `cardShadow`/`shadowRaised` em superfícies escuras.
   */
  sharedElevationDark as elevationDark,
};

// Cores em JS (espelham tailwind.config.js / global.css) — para props que não
// aceitam className: cor de ícones lucide, react-native-svg, tintColor, etc.
//
// Há duas paletas (clara/escura). Em COMPONENTES, use `useColors()` p/ reagir ao
// tema. O export estático `colors` = paleta CLARA (compatibilidade; telas ainda
// não migradas continuam claras). Valores espelham apps/web (consistência).
export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  /** 3º degrau tonal — hierarquia sem sombra (essencial no tema escuro). */
  surface3: string;
  /** Linha DECORATIVA (separador). Não serve como borda de campo. */
  line: string;
  /** Borda de campo/controle — ≥3:1 (WCAG SC 1.4.11). */
  lineStrong: string;
  fg: string;
  fgSoft: string;
  muted: string;
  /** Texto terciário legível (≥4,5:1). Nome canônico — `faint` é o alias antigo. */
  hint: string;
  /**
   * COMPATIBILIDADE: ~40 telas usam `colors.faint`. O NOME fica; o VALOR passou a
   * ser o `hint` novo (claro #6c675e = 4,55:1 · escuro #909398 = 4,59:1), então
   * todas elas cumprem WCAG AA sem nenhuma edição. Em código novo, prefira `hint`.
   */
  faint: string;
  primary: string;
  accent: string;
  brand: string;
  /** Tinta de status (texto/ícone). Vinha do semáforo antigo, que reprovava. */
  ok: string;
  attention: string;
  alert: string;
  white: string;
};

export const lightColors: Palette = {
  bg: surfaceLight.bg,
  surface: surfaceLight.surface,
  surface2: surfaceLight.surface2,
  surface3: surfaceLight.surface3,
  line: surfaceLight.line,
  lineStrong: surfaceLight.lineStrong,
  fg: inkLight.fg,
  fgSoft: inkLight.fgSoft,
  muted: inkLight.muted,
  hint: inkLight.hint,
  faint: inkLight.hint, // alias do antigo #847e74 (3,82:1 — reprovava)
  primary: inkLight.primary,
  accent: inkLight.accent, // #c4293c (4,56:1) no lugar de #d12f3e
  brand: sharedColors.trustBlue[600],
  ok: sharedStatus.light.ok.ink, // #007149 no lugar de #10b981 (2,41:1)
  attention: sharedStatus.light.attention.ink, // #895b00 no lugar de #f59e0b (2,04:1)
  alert: sharedStatus.light.alert.ink, // #c1262c no lugar de #ef4444 (3,57:1)
  white: sharedColors.neutral[0],
};

// Tema escuro (espelha apps/web/globals.css) — near-black HubPatients.
export const darkColors: Palette = {
  bg: surfaceDark.bg,
  surface: surfaceDark.surface,
  surface2: surfaceDark.surface2,
  surface3: surfaceDark.surface3,
  line: surfaceDark.line,
  lineStrong: surfaceDark.lineStrong,
  fg: inkDark.fg,
  fgSoft: inkDark.fgSoft,
  muted: inkDark.muted,
  hint: inkDark.hint,
  faint: inkDark.hint, // alias do antigo #7d7d7d
  primary: inkDark.primary, // #8ba9ff (6,21:1) — o royal dava 2,3:1 no escuro
  accent: inkDark.accent,
  brand: inkDark.primary,
  ok: sharedStatus.dark.ok.ink,
  attention: sharedStatus.dark.attention.ink,
  alert: sharedStatus.dark.alert.ink,
  white: '#ffffff',
};

export const colors = lightColors;

/** Paleta reativa ao tema atual (claro/escuro). Use em componentes. */
export function useColors(): Palette {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? darkColors : lightColors;
}

// Famílias de fonte carregadas em app/_layout.tsx (Bricolage display + Inter).
// Aplicadas via style={{ fontFamily }} para o peso ficar exato (peso vem do arquivo).
//
// ⚠️ FONTE É ASSET NATIVO — só entra em APK NOVO, nunca por OTA.
//
// ✅ LIGADO NO APK 0.4.0: Atkinson Hyperlegible Next (texto) + Atkinson
// Hyperlegible Mono (todo número clínico). A Atkinson foi desenhada pelo Braille
// Institute para baixa visão e distingue explicitamente 1/I/l e 0/O — no
// Bricolage o `1` e o `I` são quase idênticos, e dose de medicamento lida errado
// é risco real. Os pesos são carregados em app/_layout.tsx.
//
// Inter continua carregada nesta versão como rede de segurança (se sobrou algum
// `fontFamily: 'Inter_...'` hardcoded fora daqui, não vira quadrado preto).
export const fonts = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  medium: 'AtkinsonHyperlegibleNext_500Medium',
  semibold: 'AtkinsonHyperlegibleNext_600SemiBold',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
  display: 'BricolageGrotesque_700Bold',
  displayX: 'BricolageGrotesque_800ExtraBold',
  /** Números clínicos — largura fixa por DESENHO, não por feature OpenType. */
  num: 'AtkinsonHyperlegibleMono_500Medium',
  numBold: 'AtkinsonHyperlegibleMono_700Bold',
} as const;

// Gradientes (expo-linear-gradient) — sky→cyan da web + verde saúde.
export const gradients = {
  brand: ['#0442bf', '#0511f2'] as const, // royal → elétrico
  brandDeep: ['#052c80', '#0442bf'] as const,
  accent: ['#d12f3e', '#f24b59'] as const, // coral (decorativo)
  /**
   * Coral para BOTÃO com texto branco. O `accent` acima termina em #f24b59, e
   * branco sobre ele dá 3,54:1 — reprova AA. Este par fecha ≥4,5:1 no ponto mais
   * claro. Use quando houver texto/ícone branco por cima.
   */
  accentDeep: ['#a81f30', '#c4293c'] as const,
  hero: ['#0442bf', '#0511f2', '#0455bf'] as const,
};

// Sombra suave dos cards (iOS shadow* + Android elevation) + canto contínuo.
// Sombra TINGIDA com a tinta quente do texto (#1b1a18), nunca preto puro — é a
// assinatura do "Papel Clínico Quente" (ref.: Headspace/Italic Studio).
export const cardShadow = {
  shadowColor: '#1b1a18',
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

// Elevação mais marcada (hero, sheets, tab bar) — profundidade intencional.
export const shadowRaised = {
  shadowColor: '#1b1a18',
  shadowOpacity: 0.12,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
} as const;

// ─────────────────────────── Tokens de fundação ───────────────────────────
// Escala tipográfica com lineHeight embutido. Aplicar via style={type.X}; o peso
// vem do fontFamily. Substitui os text-[..px] soltos por uma escala única.
//
// Redesign 2026-07: TODOS os nomes antigos continuam existindo (nada some), só os
// VALORES subiram — a tela não precisa de edição para ficar legível:
//  · body 15 → 17px (default do iOS HIG) com entrelinha 26 (1,53 — SC 1.4.8 pede ≥1,5)
//  · label 13 → 15 · caption 12 → 13 · heading 17 → 20 · title 20 → 24 · display 28 → 30
//  · `tiny` deixou de ser 11px e virou ALIAS de caption (13px): 11px é inutilizável
//    para um público com presbiopia/catarata.
// Quem realmente precisa do corpo antigo (linha densa, chip) usa `bodySm` (15px).
export const type = {
  display: { fontFamily: fonts.displayX, fontSize: 30, lineHeight: 36 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 31 },
  heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 27 },
  /** Subtítulo / título de cartão em sans (não display) — degrau abaixo de heading. */
  subtitle: { fontFamily: fonts.medium, fontSize: 19, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 26 },
  bodySemibold: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 26 },
  /** Corpo compacto (o antigo 15px) — listas densas, chips, legendas longas. */
  bodySm: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  /** ALIAS de `caption` (mantido só por compatibilidade — era 11px). */
  tiny: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },

  /* ── Dado clínico ───────────────────────────────────────────────────────────
   * Um número-herói por tela (~5× o rótulo), unidade menor ao lado pela baseline.
   * ✅ APK 0.4.0: usam Atkinson Hyperlegible Mono — largura fixa por DESENHO,
   * não por feature OpenType opcional. Isso resolve de uma vez o alinhamento de
   * coluna em tabela de exames e a confusão 1/l/I e 0/O em dose e lote. */
  dataXl: { fontFamily: fonts.numBold, fontSize: 40, lineHeight: 46 },
  dataLg: { fontFamily: fonts.numBold, fontSize: 28, lineHeight: 34 },
  data: { fontFamily: fonts.num, fontSize: 17, lineHeight: 24 },
  dataSm: { fontFamily: fonts.num, fontSize: 15, lineHeight: 21 },
  dataUnit: { fontFamily: fonts.num, fontSize: 13, lineHeight: 18 },
} as const;

// Ritmo de espaçamento 4/8pt — usar no lugar de números soltos.
// 7/12/16/20 (28/48/64/80) cobrem o respiro vertical entre SEÇÕES, que o redesign
// pede generoso (Whoop): antes só existia até 40 e viravam números soltos.
//
// Vem de `spacePx` (@hubpatients/ui-tokens): a MESMA tabela de onde a web deriva
// os rem. Antes eram duas listas escritas à mão em arquivos diferentes — batiam
// por sorte, e sorte não é fonte única.
export const space = spacePx;

// Raios padronizados (cantos contínuos) — fim do 16/20/26/28/30 espalhado.
// `xs` (8) é o canto de chip/input: em elemento pequeno, 12 já lê como pílula.
// `md` (16) é o cartão do Painel. Fonte: `radiusPx` de @hubpatients/ui-tokens.
export const radius = radiusPx;

/* ══════════════════════════════ Camada "Painel" ══════════════════════════════
 * Superfícies frias, chips pastel e elevação da casca nova (2026-08). Os
 * valores saem de @hubpatients/ui-tokens — não escreva hex aqui.
 * Detalhe e regras de uso: docs/DESIGN.md
 * ========================================================================== */

/** Chips pastel por tema. Cor de CATEGORIA, jamais de gravidade. */
export const chipPastel = sharedChipPastel;
export type { ChipTone };

/** Paleta de chips reativa ao tema. */
export function useChipPastel(): Record<ChipTone, { tint: string; ink: string }> {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? sharedChipPastel.dark : sharedChipPastel.light;
}

/** Superfícies + tinta do Painel (claro e escuro). */
export const painel = {
  light: { ...painelSurfaceLight, ...painelInkLight },
  dark: { ...painelSurfaceDark, ...painelInkDark },
} as const;

/**
 * Sombra do cartão do Painel — tinta fria (#233554), não preto puro.
 *
 * ⚠️ SÓ no tema claro. No escuro use `elevationDark` (degrau tonal + hairline):
 * sombra não se lê sobre preto.
 */
export const painelCardShadow = shadowToRn(shadowPainel.card);
export const painelRaisedShadow = shadowToRn(shadowPainel.raised);

/** Elevação certa para o tema atual, sem a tela ter que lembrar da regra. */
export function usePainelShadow(level: 'card' | 'raised' = 'card') {
  const { colorScheme } = useColorScheme();
  if (colorScheme === 'dark') {
    return level === 'raised' ? sharedElevationDark.raised : sharedElevationDark.card;
  }
  return level === 'raised' ? painelRaisedShadow : painelCardShadow;
}

/* ══════════════════════════ Modo Sênior (acessibilidade) ══════════════════════════
 * Público majoritariamente idoso/crônico + cuidadores. Base de evidência:
 *  - NN/g — capacidade de uso cai ~0,8%/ano entre 25 e 60 anos; letra pequena e
 *    alvo pequeno são a queixa nº 1: https://www.nngroup.com/articles/usability-for-senior-citizens/
 *  - Revisão de 132 estudos (2014–2025): fonte maior, alto contraste, ALVO DE
 *    TOQUE AMPLIADO, navegação linear, tolerância a erro:
 *    https://pmc.ncbi.nlm.nih.gov/articles/PMC12350549/
 *  - WCAG 2.2 SC 2.5.8: alvo mínimo 24×24 px — aqui vamos a 56 px.
 *
 * NADA acima foi alterado: tudo abaixo é aditivo. `type`, `space`, `colors`…
 * continuam com os mesmos valores de projeto; o Modo Sênior é aplicado por quem
 * consome `useType()` / `useTapTarget()`.
 */

/** Alvos de toque (px). 44 é o piso de projeto; 56 é o Modo Sênior. */
export const tapTarget = sharedA11y.tapTarget;

/** Fator da escala tipográfica sênior (1.3) e limites do fator efetivo (1.0–2.0). */
export const SENIOR_FONT_FACTOR = sharedA11y.seniorFontFactor;
export const FONT_SCALE_CLAMP = sharedA11y.fontScaleClamp;

/* ── Preferência persistida (SecureStore, mesmo mecanismo do tema) ── */

const SENIOR_KEY = 'hubpatients.senior-mode';

let seniorEnabled = false;
let seniorLoaded = false;
let seniorLoading: Promise<void> | null = null;
const seniorListeners = new Set<() => void>();

function emitSenior(): void {
  for (const listener of seniorListeners) listener();
}

/**
 * Lê a preferência do disco uma única vez (idempotente). É disparada sozinha no
 * primeiro `useSeniorMode()` montado, então não exige mudança no _layout.
 */
export function loadSeniorMode(): Promise<void> {
  if (seniorLoaded) return Promise.resolve();
  if (seniorLoading) return seniorLoading;
  seniorLoading = (async () => {
    try {
      seniorEnabled = (await SecureStore.getItemAsync(SENIOR_KEY)) === '1';
    } catch {
      seniorEnabled = false; // preferência não-crítica
    }
    seniorLoaded = true;
    seniorLoading = null;
    emitSenior();
  })();
  return seniorLoading;
}

/** Valor atual (síncrono) — para uso fora de componentes. */
export function getSeniorMode(): boolean {
  return seniorEnabled;
}

/** Liga/desliga o Modo Sênior e persiste. Notifica todas as telas montadas. */
export async function saveSeniorMode(enabled: boolean): Promise<void> {
  seniorEnabled = enabled;
  seniorLoaded = true;
  emitSenior();
  try {
    await SecureStore.setItemAsync(SENIOR_KEY, enabled ? '1' : '0');
  } catch {
    // preferência não-crítica; ignora falha de escrita
  }
}

function subscribeSenior(listener: () => void): () => void {
  seniorListeners.add(listener);
  void loadSeniorMode();
  return () => {
    seniorListeners.delete(listener);
  };
}

/**
 * Modo Sênior ("Modo simples" na UI): texto 1,3× maior e alvos de toque de 56 px.
 * `enabled` é reativo em todas as telas — a troca vale no app inteiro na hora.
 */
export function useSeniorMode(): {
  enabled: boolean;
  setEnabled: (value: boolean) => Promise<void>;
} {
  const enabled = useSyncExternalStore(subscribeSenior, getSeniorMode, getSeniorMode);
  return { enabled, setEnabled: saveSeniorMode };
}

/* ══════════════════ Bloqueio de captura de tela (opcional) ══════════════════
 * Vinha ligado sempre e impedia print legítimo (mandar exame ao médico, relatar
 * um problema). Virou opção, DESLIGADA por padrão. Ver `screen-guard.tsx`.
 * ========================================================================== */

const BLOCK_CAPTURE_KEY = 'hubpatients.block-screen-capture';

let blockCapture = false;
let blockCaptureLoaded = false;
let blockCaptureLoading: Promise<void> | null = null;
const blockCaptureListeners = new Set<() => void>();

function emitBlockCapture(): void {
  for (const listener of blockCaptureListeners) listener();
}

export function loadBlockScreenCapture(): Promise<void> {
  if (blockCaptureLoaded) return Promise.resolve();
  if (blockCaptureLoading) return blockCaptureLoading;
  blockCaptureLoading = (async () => {
    try {
      blockCapture = (await SecureStore.getItemAsync(BLOCK_CAPTURE_KEY)) === '1';
    } catch {
      blockCapture = false;
    }
    blockCaptureLoaded = true;
    blockCaptureLoading = null;
    emitBlockCapture();
  })();
  return blockCaptureLoading;
}

export function getBlockScreenCapture(): boolean {
  return blockCapture;
}

export async function saveBlockScreenCapture(value: boolean): Promise<void> {
  blockCapture = value;
  blockCaptureLoaded = true;
  emitBlockCapture();
  try {
    await SecureStore.setItemAsync(BLOCK_CAPTURE_KEY, value ? '1' : '0');
  } catch {
    // preferência não-crítica; ignora falha de escrita
  }
}

function subscribeBlockCapture(listener: () => void): () => void {
  blockCaptureListeners.add(listener);
  void loadBlockScreenCapture();
  return () => {
    blockCaptureListeners.delete(listener);
  };
}

/** Bloquear print/gravação nas telas com dado de saúde? Padrão: não. */
export function useBlockScreenCapture(): {
  blocked: boolean;
  setBlocked: (value: boolean) => Promise<void>;
} {
  const blocked = useSyncExternalStore(
    subscribeBlockCapture,
    getBlockScreenCapture,
    getBlockScreenCapture,
  );
  return { blocked, setBlocked: saveBlockScreenCapture };
}

/* ── Escala de fonte: preferência do sistema × Modo Sênior, com clamp ── */

export type FontScaleInfo = {
  /** `fontScale` do aparelho (Ajustes → Tela/Acessibilidade). */
  system: number;
  /** Fator TOTAL desejado sobre o tamanho de projeto, já com clamp 1.0–2.0. */
  effective: number;
  /**
   * Fator a aplicar em `fontSize`/`lineHeight` nos estilos. Já desconta o que o
   * React Native multiplica sozinho (`allowFontScaling`), evitando escala dupla
   * e garantindo o teto de 2× mesmo com a fonte do sistema no máximo.
   */
  style: number;
};

/** clamp(sistema × sênior, 1.0, 2.0) — nunca encolhe, nunca estoura o layout. */
export function clampFontScale(systemFontScale: number, senior: boolean): number {
  const system = Number.isFinite(systemFontScale) && systemFontScale > 0 ? systemFontScale : 1;
  const raw = system * (senior ? SENIOR_FONT_FACTOR : 1);
  return Math.min(Math.max(raw, FONT_SCALE_CLAMP.min), FONT_SCALE_CLAMP.max);
}

export function useFontScale(): FontScaleInfo {
  const { fontScale } = useWindowDimensions();
  const { enabled } = useSeniorMode();
  const system = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const effective = clampFontScale(system, enabled);
  return { system, effective, style: effective / system };
}

/* ── Escala tipográfica derivada de `type` ── */

export type TypeToken = { fontFamily: string; fontSize: number; lineHeight: number };
export type TypeName = keyof typeof type;
export type TypeScale = Record<TypeName, TypeToken>;

const typeScaleCache = new Map<number, TypeScale>();

/** `type` multiplicado por um fator (memoizado por fator). Fator 1 → o original. */
export function scaledType(factor: number): TypeScale {
  const key = Math.round(factor * 100) / 100;
  const cached = typeScaleCache.get(key);
  if (cached) return cached;
  const entries = Object.entries(type) as [TypeName, TypeToken][];
  const out = {} as TypeScale;
  for (const [name, token] of entries) {
    out[name] = {
      fontFamily: token.fontFamily,
      fontSize: Math.round(token.fontSize * key),
      lineHeight: Math.round(token.lineHeight * key),
    };
  }
  typeScaleCache.set(key, out);
  return out;
}

/**
 * Escala tipográfica já ajustada ao Modo Sênior + fonte do sistema (com clamp).
 * Use no lugar de `type` em telas novas: `const t = useType(); <Text style={t.body}>`.
 * Mantenha `allowFontScaling` no padrão — o clamp já está embutido no fator.
 */
export function useType(): TypeScale {
  const { style } = useFontScale();
  return useMemo(() => scaledType(style), [style]);
}

/**
 * Escala um tamanho de projeto (px) que ainda NÃO tem token equivalente em
 * `type`. A escala cobre bem os tamanhos, mas não todas as combinações
 * PESO×TAMANHO que os componentes usam de fato — 15px semibold (rótulo de
 * lista, botão), 12px medium (rótulo de métrica) e 26px displayX (título do
 * cabeçalho) não são tokens. Trocar esses valores pelo token mais próximo
 * mudaria o desenho de todas as telas de uma vez, o que não é o objetivo aqui.
 *
 * NÃO é uma escala nova: é o MESMO fator que `useType()` aplica (Modo Sênior ×
 * fonte do sistema, já com o clamp 1.0–2.0), só que sobre o valor de projeto.
 * Com o Modo Sênior desligado e a fonte do sistema no padrão o fator é 1 e o
 * resultado é idêntico ao de hoje — por isso é seguro adotar em massa.
 *
 * Uso: `const fs = useFontScaler(); <Text style={[{ fontFamily: fonts.semibold }, fs(15, 20)]}>`
 */
export function useFontScaler(): (fontSize: number, lineHeight?: number) => {
  fontSize: number;
  lineHeight?: number;
} {
  const { style } = useFontScale();
  return useMemo(
    () => (fontSize: number, lineHeight?: number) => ({
      fontSize: Math.round(fontSize * style),
      ...(lineHeight === undefined ? null : { lineHeight: Math.round(lineHeight * style) }),
    }),
    [style],
  );
}

/** Altura/largura mínima de qualquer alvo tocável: 44 px, ou 56 px no Modo Sênior. */
export function useTapTarget(): number {
  const { enabled } = useSeniorMode();
  return enabled ? tapTarget.senior : tapTarget.min;
}

/* ── Redução de movimento (SO) ── */

/**
 * `true` quando o usuário pediu menos animação no aparelho. Toda animação nova
 * deve checar isto e cair para uma transição instantânea.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduce(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
