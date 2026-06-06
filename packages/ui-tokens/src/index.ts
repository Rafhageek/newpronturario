/**
 * Design tokens compartilhados entre web (Tailwind/shadcn) e mobile (NativeWind).
 * Fonte única de verdade para cores, espaçamentos e tipografia do VidaLog.
 *
 * Paleta-base:
 *  - Trust Blue  (#0284C7) — confiança, ações primárias
 *  - Health Green (#10B981) — saúde, sucesso, sinais "ok"
 */

export const colors = {
  // Marca
  trustBlue: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9',
    600: '#0284C7', // Trust Blue (primária)
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
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
  },
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#0284C7',
} as const;

/** Cores semânticas de alto nível (mapeiam para a paleta acima). */
export const semanticColors = {
  primary: colors.trustBlue[600],
  primaryForeground: colors.neutral[0],
  accent: colors.healthGreen[500],
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

export const tokens = {
  colors,
  semanticColors,
  spacing,
  radius,
  typography,
} as const;

export type Tokens = typeof tokens;
export default tokens;
