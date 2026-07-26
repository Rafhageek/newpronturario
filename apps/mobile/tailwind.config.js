/** @type {import('tailwindcss').Config} */
// Tokens espelham o tema CLARO da web (apps/web globals.css) — off-white acolhedor,
// ideal para idosos/crônicos. RN não importa tokens TS, então ficam aqui e em src/theme.ts.
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class', // alternado em runtime via nativewind colorScheme.set()
  theme: {
    extend: {
      colors: {
        // Semânticos: variáveis CSS (claro/escuro em global.css). Mesmos nomes da web.
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--color-surface-2) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        fg: 'rgb(var(--color-fg) / <alpha-value>)',
        'fg-soft': 'rgb(var(--color-fg-soft) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        faint: 'rgb(var(--color-faint) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        brand: '#0442bf', // azul royal p/ destaques/gradientes (estático)

        // Escalas de apoio — estáticas (iguais à web; só os semânticos trocam).
        trust: { 50: '#eef2ff', 100: '#d9e1ff', 600: '#0442bf', 700: '#0537a0', 800: '#052c80' },
        electric: '#0511f2',
        coral: { 400: '#f56b78', 500: '#f24b59', 600: '#d93546' },
        health: { 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669' },
        // Status clínico — `ink` do sistema de 3 papéis (ui-tokens/status).
        // Os valores anteriores reprovavam WCAG: #10b981 = 2,41:1 · #f59e0b =
        // 2,04:1 · #ef4444 = 3,57:1. Estes passam AA sobre o canvas creme.
        semaphore: { ok: '#007149', attention: '#895b00', alert: '#c1262c' },
        // `mark` — traço/borda/ícone decorativo (mínimo 3:1, não serve p/ texto).
        'semaphore-mark': { ok: '#009460', attention: '#b17700', alert: '#ea4746' },
        // `tint` — fundo de chip (o texto vai em `semaphore-*`).
        'semaphore-tint': { ok: '#e4fbee', attention: '#fff2e2', alert: '#fff1ef' },
        'surface-3': '#eae7e0',
        'line-strong': '#87837c',
        hint: '#6c675e',
      },
      borderRadius: { '4xl': '28px', xs: '8px' },
    },
  },
  plugins: [],
};
