/**
 * ════════════════════════════════════════════════════════════════════════════
 * PAINEL — camada visual de 2026-08 (web + mobile, uma fonte só)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O que é: a casca clara e fria do painel novo (lateral recolhível, topo com
 * busca, cabeçalho de página com saudação, fileira de cartões de métrica com
 * chip de ícone pastel, estados vazios ilustrados).
 *
 * O que NÃO é: um sistema novo. É a camada de SUPERFÍCIE por cima do que já
 * existia e funciona:
 *   · acessibilidade  — `a11y` (alvo 44/56, clamp de fonte, Modo Sênior) intacta
 *   · movimento       — `motion` (teto de 400 ms, sem loop infinito) intacto
 *   · status          — `status` ink/mark/tint (cor do SISTEMA) intacto
 *   · gráficos        — `chart` (paleta neutra-clínica) intacto
 *   · tipografia      — Atkinson Hyperlegible (texto) + Mono (número clínico)
 *
 * De onde vieram os valores: das cores que a web já usava em `.hp-clinical-shell`
 * (globals.css) — o "conceito central clínica pessoal". Elas nunca existiram no
 * mobile, então as duas plataformas divergiam; agora saem daqui.
 *
 * DUAS CORREÇÕES DE WCAG entram junto (valores medidos, não estimados — ver
 * `packages/core/src/utils/contraste-painel.test.ts`):
 *   · hint        #67748a → #616e83   (4,40:1 → 4,55:1 sobre `surface3`)
 *   · lineStrong  #8994a7 → #7a8597   (2,70:1 → 3,29:1 sobre `surface3`)
 * O #67748a é o erro clássico deste estilo visual: cinza-claro bonito que
 * reprova por pouco. Estava em produção.
 */

/* ═══════════════════════════ Métrica (px) ═══════════════════════════ */

/**
 * Ritmo de espaçamento 4/8pt — FONTE ÚNICA em px.
 *
 * A web deriva rem daqui (`spacing`, em index.ts) e o mobile consome direto
 * (`space`, em apps/mobile/src/theme.ts). Antes eram duas tabelas escritas à
 * mão; batiam por sorte.
 */
export const spacePx = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

/**
 * Raios em px — FONTE ÚNICA.
 *
 * ⚠️ Não confundir com o `radius` legado (em rem) exportado por index.ts: lá
 * `md` vale 8px, aqui vale 16px. O legado continua existindo porque há código
 * web usando; em código NOVO use `radiusPx` (ou os `--painel-radius-*` na web).
 *
 * O mockup pede cartão ~16px (`card`), chip de ícone 12px (`sm`) e botão de
 * ação totalmente arredondado (`full`).
 */
export const radiusPx = {
  xs: 8,
  sm: 12,
  /** Cartão do painel — o raio mais usado do sistema. */
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  full: 999,
} as const;

/** Alias legível: o raio de cartão do Painel. */
export const CARD_RADIUS = radiusPx.md;

/**
 * Medidas da casca. Todo alvo tocável dentro delas continua obedecendo
 * `a11y.tapTarget` (44 px, 56 no Modo Sênior) — estas são medidas de LAYOUT,
 * não substituem o piso de toque.
 */
export const layout = {
  /** Lateral aberta (mockup: rótulo + ícone + grupo colapsável). */
  sidebarWidth: 264,
  /** Lateral recolhida pelo botão «: só ícone, ainda ≥44 de alvo. */
  sidebarCollapsedWidth: 76,
  /** Barra do topo (busca, tema, sino, avatar), alinhada ao mockup desktop. */
  topbarHeight: 88,
  /** Largura máxima da área de conteúdo no painel amplo. */
  contentMaxWidth: 1440,
  /** Respiro lateral do conteúdo: telefone / tablet / desktop. */
  gutter: { sm: spacePx[4], md: spacePx[6], lg: spacePx[8] },
  /** Coluna principal ÷ coluna lateral do corpo em duas colunas (≈2/3 + 1/3). */
  bodyColumns: '2fr 1fr',
} as const;

/* ═══════════════════════════ Superfícies e tinta ═══════════════════════════ */

export interface PainelSurface {
  /** Canvas da área de trabalho. */
  bg: string;
  /** Cartão, lateral, topo. */
  surface: string;
  /** Degrau intermediário: campo de busca, linha zebrada. */
  surface2: string;
  /** 3º degrau: chip neutro, cabeçalho de tabela. É o PIOR fundo do tema claro. */
  surface3: string;
  /** Linha DECORATIVA (separador). Nunca como borda de campo. */
  line: string;
  /** Borda de campo/controle — ≥3:1 sobre o pior fundo (SC 1.4.11). */
  lineStrong: string;
}

export interface PainelInk {
  fg: string;
  fgSoft: string;
  muted: string;
  /** Texto terciário — piso de 4,5:1 sobre o PIOR fundo do tema. */
  hint: string;
  primary: string;
  primaryHover: string;
  /** Tinta sobre superfície preenchida com `primary`. */
  onPrimary: string;
}

/**
 * Claro — canvas azul-neutro (não creme). É o clima do mockup: leitura de
 * prontuário organizado, superfícies brancas bem separadas do fundo.
 */
export const painelSurfaceLight: PainelSurface = {
  bg: '#f5f7fb',
  surface: '#ffffff',
  surface2: '#f7f8fc',
  surface3: '#edf1f7',
  line: '#e2e7f0',
  lineStrong: '#7a8597', // 3,29:1 sobre surface3 (o #8994a7 anterior dava 2,70)
};

export const painelInkLight: PainelInk = {
  fg: '#151b2b', // 16,00:1 sobre bg
  fgSoft: '#354056', // 9,69:1
  muted: '#58657a', // 5,50:1
  hint: '#616e83', // 4,55:1 sobre surface3 (o #67748a anterior dava 4,17)
  primary: '#0442bf', // 7,71:1 sobre bg · 8,27:1 sobre branco
  primaryHover: '#0537a0',
  onPrimary: '#ffffff',
};

/**
 * Escuro — é EXATAMENTE a base já auditada (`surfaceDark`/`inkDark` de
 * index.ts). No escuro a hierarquia é por DEGRAU TONAL + hairline; sombra não
 * se lê sobre preto, então o Painel não tem o que mudar aqui.
 *
 * Os valores estão repetidos, e não importados, porque `index.ts` reexporta
 * este arquivo: importar de volta criaria um ciclo ESM e o `const` cairia em
 * TDZ na primeira execução. A cópia não pode divergir da origem — há teste
 * comparando os dois campo a campo (`contraste-painel.test.ts`).
 */
export const painelSurfaceDark: PainelSurface = {
  bg: '#0d0d0d',
  surface: '#171717',
  surface2: '#212121',
  surface3: '#2b2b2b',
  line: 'rgba(255,255,255,0.10)',
  lineStrong: '#727578',
};

export const painelInkDark: PainelInk = {
  fg: '#e8eaf0',
  fgSoft: '#cfd4dd',
  muted: '#a7acb2',
  hint: '#909398',
  primary: '#8ba9ff',
  primaryHover: '#a8bdff',
  onPrimary: '#0d1220',
};

/* ═══════════════════════════ Chip de ícone pastel ═══════════════════════════ */

/**
 * Os chips pastel do mockup — a cor identifica a CATEGORIA do cartão
 * (medicamento, consulta, exame…), nunca a gravidade do que está dentro dele.
 *
 * Por isso a paleta inteira vive na faixa de matiz 165°–320° (turquesa → azul →
 * índigo → violeta → ameixa): não existe verde, âmbar nem vermelho aqui, então
 * um cartão não consegue nascer "grave" por acidente de escolha de cor. Há
 * teste travando o matiz (`isCategoryHue` + `contraste-painel.test.ts`).
 *
 * Cada tom tem `tint` (fundo do chip) e `ink` (ícone e, se houver, o texto
 * dentro do chip). Todos os pares medidos ≥5,18:1 — acima de AA para texto,
 * bem acima dos 3:1 que um ícone exigiria.
 */
export type ChipTone = 'azul' | 'indigo' | 'violeta' | 'ameixa' | 'turquesa' | 'ardosia';

export const CHIP_TONES: readonly ChipTone[] = [
  'azul',
  'indigo',
  'violeta',
  'ameixa',
  'turquesa',
  'ardosia',
] as const;

export interface ChipColor {
  tint: string;
  ink: string;
}

export const chipPastel: Record<'light' | 'dark', Record<ChipTone, ChipColor>> = {
  light: {
    azul: { tint: '#e4ecfd', ink: '#0442bf' }, // 6,98:1
    indigo: { tint: '#eae8fb', ink: '#4634ad' }, // 7,40:1
    violeta: { tint: '#f1e9fa', ink: '#6b2f9e' }, // 7,03:1
    ameixa: { tint: '#f6e6f4', ink: '#8d2170' }, // 6,78:1
    turquesa: { tint: '#dff2f3', ink: '#0d6e74' }, // 5,18:1
    ardosia: { tint: '#e8edf4', ink: '#3d4a5f' }, // 7,61:1
  },
  dark: {
    azul: { tint: '#16243d', ink: '#93b2ff' }, // 7,42:1
    indigo: { tint: '#1e1b3a', ink: '#b0a6ff' }, // 7,65:1
    violeta: { tint: '#261a35', ink: '#cba3f0' }, // 7,83:1
    ameixa: { tint: '#2f1428', ink: '#e7a2dd' }, // 8,47:1
    turquesa: { tint: '#0f2a2c', ink: '#7fd6dc' }, // 9,04:1
    ardosia: { tint: '#1d222b', ink: '#a9b6c9' }, // 7,76:1
  },
};

/**
 * Tom estável a partir de uma chave de texto (rota, id de módulo). Serve para as
 * 96 telas não terem que escolher cor à mão — e para a mesma seção manter a
 * mesma cor em web e mobile sem tabela duplicada.
 */
export function chipToneFor(chave: string): ChipTone {
  let h = 0;
  for (let i = 0; i < chave.length; i += 1) {
    h = (h * 31 + chave.charCodeAt(i)) >>> 0;
  }
  return CHIP_TONES[h % CHIP_TONES.length] as ChipTone;
}

/* ═══════════════════════════ Elevação ═══════════════════════════ */

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** RGB da TINTA fria do painel (#233554), nunca preto neutro. */
  rgb: string;
  alpha: number;
}

/**
 * Sombra tingida com a tinta fria (#233554) em vez de preto puro. Sobre um
 * canvas azulado o preto neutro faz uma borda cinza-suja; é a mesma decisão do
 * "Papel Clínico", só com a tinta deste canvas.
 */
export const shadowPainel = {
  /** Cartão em repouso — a elevação mais usada. */
  card: [
    { x: 0, y: 1, blur: 2, spread: 0, rgb: '35 53 84', alpha: 0.05 },
    { x: 0, y: 8, blur: 24, spread: 0, rgb: '35 53 84', alpha: 0.08 },
  ] as ShadowLayer[],
  /** Cartão em foco/hover e popovers. */
  raised: [
    { x: 0, y: 2, blur: 7, spread: 0, rgb: '35 53 84', alpha: 0.06 },
    { x: 0, y: 18, blur: 42, spread: -12, rgb: '35 53 84', alpha: 0.18 },
  ] as ShadowLayer[],
  /** Hairline de repouso — quase invisível; usa-se com borda `line`. */
  hairline: [{ x: 0, y: 1, blur: 2, spread: 0, rgb: '35 53 84', alpha: 0.04 }] as ShadowLayer[],
} as const;

/** `box-shadow` CSS a partir dos degraus. */
export function shadowToCss(layers: readonly ShadowLayer[]): string {
  return layers
    .map((l) => `${l.x}px ${l.y}px ${l.blur}px ${l.spread}px rgb(${l.rgb} / ${l.alpha})`)
    .join(', ');
}

/**
 * Equivalente React Native (iOS shadow* + Android elevation). O RN só aceita UM
 * degrau: usamos o mais largo, que é o que o olho lê.
 *
 * ⚠️ No tema ESCURO NÃO use isto — use `elevationDark` (degrau tonal +
 * hairline). Sombra não se lê sobre preto.
 */
export function shadowToRn(layers: readonly ShadowLayer[]): {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
} {
  const dominante = layers.reduce((a, b) => (b.blur > a.blur ? b : a), layers[0] as ShadowLayer);
  const [r, g, b] = dominante.rgb.split(' ').map(Number);
  const hex = (v: number) => Math.max(0, Math.min(255, v ?? 0)).toString(16).padStart(2, '0');
  return {
    shadowColor: `#${hex(r as number)}${hex(g as number)}${hex(b as number)}`,
    shadowOpacity: dominante.alpha,
    shadowRadius: dominante.blur,
    shadowOffset: { width: dominante.x, height: dominante.y },
    elevation: Math.round(dominante.blur / 3),
  };
}

/* ═══════════════════════════ Decoração ═══════════════════════════ */

/**
 * A mancha de gradiente do canto superior direito do cabeçalho.
 *
 * DECORATIVA: `aria-hidden`, sem informação, e não se move (a versão animada
 * seria movimento periférico ao lado de texto — P5 do sistema de movimento).
 */
export const painelBlob = {
  light: 'radial-gradient(60% 80% at 100% 0%, rgb(4 66 191 / 0.10), transparent 70%)',
  dark: 'radial-gradient(60% 80% at 100% 0%, rgb(139 169 255 / 0.10), transparent 70%)',
} as const;

/** Pílula do item ativo da lateral: fundo azul-claro + texto azul (6,98:1). */
export const navActive = {
  light: { tint: chipPastel.light.azul.tint, ink: painelInkLight.primary },
  dark: { tint: chipPastel.dark.azul.tint, ink: painelInkDark.primary },
} as const;

export const painel = {
  spacePx,
  radiusPx,
  layout,
  surface: { light: painelSurfaceLight, dark: painelSurfaceDark },
  ink: { light: painelInkLight, dark: painelInkDark },
  chipPastel,
  shadow: shadowPainel,
  blob: painelBlob,
  navActive,
} as const;
