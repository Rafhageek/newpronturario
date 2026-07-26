/**
 * Design tokens compartilhados entre web (Tailwind/shadcn) e mobile (NativeWind).
 * Fonte única de verdade para cores, espaçamentos e tipografia do HubPatients.
 *
 * Paleta-base (HubPatients):
 *  - Royal Blue (#0442BF) — confiança, ações primárias; elétrico #0511F2 p/ realce
 *  - Coral      (#F24B59) — acento da marca (o "+" do logo)
 *  - Verde/âmbar/vermelho — mantidos SÓ p/ status clínico (semáforo), convenção médica
 */

export * from './motion';

/**
 * ============================================================================
 * REDESIGN "Papel Clínico Quente + Expressivo" (2026-07-25)
 * Detalhe e fontes: docs/REDESIGN-2026-07.md
 *
 * Os tokens abaixo CORRIGEM violações reais de WCAG que estavam em produção:
 *   --faint #847e74 = 3,82:1 · semáforo verde 2,41 · âmbar 2,04 · vermelho 3,57
 *   branco sobre coral #f24b59 = 3,54 · royal #0442bf no escuro = 2,3
 * Contrastes calculados em OKLCH contra o PIOR fundo de cada tema.
 * ============================================================================
 */

/** Superfícies do tema claro — canvas creme quente, não branco puro (catarata). */
export const surfaceLight = {
  bg: '#faf9f6',
  surface: '#ffffff',
  surface2: '#f3f1ec',
  surface3: '#eae7e0',
  line: '#e6e3dc', // decorativa
  lineStrong: '#87837c', // borda de campo — 3,05:1 (SC 1.4.11)
} as const;

/** Superfícies do escuro — hierarquia por DEGRAU TONAL (sombra não funciona). */
export const surfaceDark = {
  bg: '#0d0d0d',
  surface: '#171717',
  surface2: '#212121',
  surface3: '#2b2b2b',
  line: 'rgba(255,255,255,0.10)',
  lineStrong: '#727578', // 3,06:1 no pior fundo
} as const;

/** Texto — contrastes verificados contra o pior fundo do tema. */
export const inkLight = {
  fg: '#1b1a18', // 14,08:1 AAA
  fgSoft: '#413c36', // 8,84:1 AAA
  muted: '#555149', // 6,39:1 AAA
  hint: '#6c675e', // 4,55:1 AA — SUBSTITUI o --faint quebrado (3,82)
  primary: '#0442bf', // 6,70:1 AAA
  primaryHover: '#0537a0',
  accent: '#c4293c', // 4,56:1 — substitui #d12f3e (4,76, falhava em surface-3)
} as const;

export const inkDark = {
  fg: '#e8eaf0',
  fgSoft: '#cfd4dd',
  muted: '#a7acb2',
  hint: '#909398', // 4,59:1 — substitui #7d7d7d
  primary: '#8ba9ff', // 6,21:1 — royal clareado (o #0442bf dava 2,3 no escuro)
  primaryHover: '#a8bdff',
  accent: '#fd8a8b',
} as const;

/**
 * Status com TRÊS papéis. Um âmbar vivo nunca chega a 4,5:1 sobre off-white —
 * por isso separamos: `ink` (texto/ícone com significado), `mark` (traço/borda,
 * mínimo 3:1) e `tint` (fundo de chip).
 *
 * REGRA CLÍNICA: vermelho e âmbar pertencem ao SISTEMA (remédio atrasado, erro
 * de upload), NUNCA ao corpo do paciente. Valor de exame fora da faixa usa
 * `neutro` + seta + "acima do intervalo informado pelo laboratório" — nós não
 * interpretamos resultado.
 */
export const status = {
  light: {
    info: { ink: '#0442bf', mark: '#427df5', tint: '#eff5ff' },
    ok: { ink: '#007149', mark: '#009460', tint: '#e4fbee' },
    attention: { ink: '#895b00', mark: '#b17700', tint: '#fff2e2' },
    alert: { ink: '#c1262c', mark: '#ea4746', tint: '#fff1ef' },
    neutro: { ink: '#475262', mark: '#768498', tint: '#f0f5fb' },
  },
  dark: {
    info: { ink: '#7caaff', mark: '#7caaff', tint: '#18253d' },
    ok: { ink: '#49c089', mark: '#49c089', tint: '#0e2c1e' },
    attention: { ink: '#e09c29', mark: '#e09c29', tint: '#332105' },
    alert: { ink: '#ff8a82', mark: '#ff8a82', tint: '#3a1b19' },
    neutro: { ink: '#a3acb8', mark: '#a3acb8', tint: '#21262c' },
  },
} as const;

/**
 * Cor nunca sozinha (SC 1.4.1). O componente de status EXIGE ink+tint+ícone+
 * rótulo. Se não dá para passar rótulo, não é status — é decoração.
 */
export const statusMeta = {
  ok: { glyph: '✓', label: 'Dentro do intervalo do laboratório', dash: undefined },
  attention: { glyph: '↑', label: 'Acima do intervalo do laboratório', dash: [6, 3] },
  alert: { glyph: '↓', label: 'Abaixo do intervalo do laboratório', dash: [2, 3] },
  neutro: { glyph: '•', label: 'Sem intervalo de referência', dash: [1, 4] },
  info: { glyph: 'i', label: 'Informação', dash: undefined },
} as const;

/**
 * Séries de gráfico — paleta NEUTRA-CLÍNICA, sem verde nem vermelho (semáforo
 * em dado clínico é diagnóstico disfarçado).
 *
 * LIMITE MATEMÁTICO honesto: nenhuma paleta de 4 séries consegue 3:1 entre si
 * E 3:1 contra o fundo em sRGB. Por isso: máx. 4 séries, rótulo direto na ponta
 * da linha, traço distinto por série (`dash`), faixa de referência em banda cinza.
 */
export const chart = {
  light: ['#1043a8', '#0d9298', '#4c0f6d', '#bd8047'],
  dark: ['#73a3fc', '#85e3e8', '#a474c7', '#ffe2c5'],
  sequential: ['#f0f5ff', '#dae5f9', '#b4cfff', '#87b1fd', '#6991dc', '#4c73ba', '#31559a', '#17397b'],
  dash: [undefined, [6, 3], [2, 3], [1, 4]],
} as const;

/** Elevação no escuro: degrau tonal + hairline. Sombra não se lê sobre preto. */
export const elevationDark = {
  flat: { backgroundColor: '#171717', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  card: { backgroundColor: '#212121', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  raised: {
    backgroundColor: '#2b2b2b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

export const colors = {
  // Marca — azul royal (ações) + coral (acento)
  trustBlue: {
    50: '#EEF2FF',
    100: '#D9E1FF',
    200: '#B3C3FF',
    300: '#849BFF',
    400: '#4E70FA', // primária no tema escuro (clara o bastante sobre preto)
    500: '#1E4FE0',
    600: '#0442BF', // primária (ações) — AAA sobre branco
    700: '#0537A0',
    800: '#052C80',
    900: '#071F5C',
  },
  electric: '#0511F2', // azul elétrico — foco/realces pontuais
  coral: {
    50: '#FFF0F1',
    100: '#FFE1E4',
    200: '#FFC5CB',
    300: '#FB9AA3',
    400: '#F56B78',
    500: '#F24B59', // coral da marca (o "+" do logo)
    600: '#D93546', // coral AA (texto/ícone sobre fundo claro)
    700: '#B82838',
  },
  healthGreen: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981', // Health Green
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },
  // Estados / semáforo (usado em exames — Fase 3)
  semaphore: {
    ok: '#10B981',
    attention: '#F59E0B',
    alert: '#EF4444',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#0D0D0D', // near-black — base do tema escuro
  },
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#0442BF',
} as const;

/** Cores semânticas de alto nível (mapeiam para a paleta acima). */
export const semanticColors = {
  primary: colors.trustBlue[600],
  primaryForeground: colors.neutral[0],
  accent: colors.coral[500],
  background: colors.neutral[0],
  foreground: colors.neutral[900],
  muted: colors.neutral[100],
  mutedForeground: colors.neutral[500],
  border: colors.neutral[200],
} as const;

/** Escala de espaçamento (rem-friendly, base 4px). */
export const spacing = {
  px: '1px',
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

export const radius = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;

export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const;

/* ────────────────────────── Acessibilidade / Modo Sênior ──────────────────────────
 * Nosso público é majoritariamente idoso/crônico + cuidadores. Evidência que
 * embasa os números abaixo:
 *  - NN/g: entre 25 e 60 anos a capacidade de usar sites cai ~0,8% ao ano; letra
 *    pequena e alvos pequenos são a queixa central dos idosos.
 *    https://www.nngroup.com/articles/usability-for-senior-citizens/
 *  - Revisão sistemática de 132 estudos (2014–2025): fontes maiores, alto
 *    contraste, ALVOS DE TOQUE AMPLIADOS, navegação linear e tolerância a erro.
 *    https://pmc.ncbi.nlm.nih.gov/articles/PMC12350549/
 *  - WCAG 2.2 SC 2.5.8 (Target Size, Minimum): 24×24 CSS px. Aqui adotamos 44
 *    como piso de projeto e 56 no Modo Sênior — bem acima do exigido.
 */

/** Tamanhos de alvo de toque, em px (mobile) / CSS px (web). */
export const tapTarget = {
  /** Piso normativo WCAG 2.2 SC 2.5.8 — nunca projetar abaixo disso. */
  wcagMin: 24,
  /** Piso de projeto HubPatients (padrão iOS/Android). */
  min: 44,
  /** Modo Sênior — alvo ampliado. */
  senior: 56,
  /** Folga mínima entre dois alvos adjacentes. */
  gap: 8,
} as const;

/** Razões de contraste exigidas (WCAG 2.x). */
export const contrastRatios = {
  /** Texto normal — AA. */
  normalText: 4.5,
  /** Texto grande (≥24px, ou ≥18,66px em negrito) — AA. */
  largeText: 3,
  /** Ícones, bordas de campo, estados de foco — AA (SC 1.4.11). */
  nonText: 3,
  /** AAA — alvo do Modo Sênior para texto de corpo. */
  enhanced: 7,
} as const;

/** A partir de quantos px o texto conta como "grande" para o limiar de 3:1. */
export const largeTextPx = { regular: 24, bold: 18.66 } as const;

/** Fator da escala tipográfica do Modo Sênior. */
export const SENIOR_FONT_FACTOR = 1.3;

/**
 * Limites do fator de fonte EFETIVO (preferência do sistema × Modo Sênior).
 * O clamp existe para não estourar o layout: abaixo de 1 nunca encolhemos,
 * acima de 2 o texto deixa de caber em cards/listas.
 */
export const fontScaleClamp = { min: 1, max: 2 } as const;

function scaleRem(value: string, factor: number): string {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return `${Math.round(n * factor * 1000) / 1000}rem`;
}

export type FontSizeKey = keyof typeof typography.fontSize;

const seniorFontSize = (Object.keys(typography.fontSize) as FontSizeKey[]).reduce<
  Record<FontSizeKey, string>
>(
  (acc, key) => {
    acc[key] = scaleRem(typography.fontSize[key], SENIOR_FONT_FACTOR);
    return acc;
  },
  {} as Record<FontSizeKey, string>,
);

/**
 * Escala tipográfica do Modo Sênior: `typography.fontSize` × 1.3, com
 * entrelinha mais folgada (corpo ≥1.6 — a linha curta e alta é o que reduz o
 * "perder a linha" na leitura de baixa visão).
 */
export const seniorTypography = {
  factor: SENIOR_FONT_FACTOR,
  fontSize: seniorFontSize,
  lineHeight: { tight: '1.35', normal: '1.6', relaxed: '1.8' },
} as const;

/** Agregado de acessibilidade — ponto único de import para web e mobile. */
export const a11y = {
  tapTarget,
  contrastRatios,
  largeTextPx,
  seniorFontFactor: SENIOR_FONT_FACTOR,
  fontScaleClamp,
  seniorTypography,
} as const;

export const tokens = {
  colors,
  semanticColors,
  spacing,
  radius,
  typography,
  a11y,
} as const;

export type Tokens = typeof tokens;
export default tokens;
