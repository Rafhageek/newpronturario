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

        // ⚠️ Estes três eram HEX ESTÁTICO do tema claro, embora `global.css` já
        // declarasse `--color-surface-3`, `--color-line-strong` e `--color-hint`
        // nos DOIS temas (a web sempre foi correta). Resultado: no tema escuro,
        // `bg-surface-3` pintava creme claro e `text-hint` ficava cinza-claro
        // sobre preto. Agora seguem o tema, como na web.
        'surface-3': 'rgb(var(--color-surface-3) / <alpha-value>)',
        'line-strong': 'rgb(var(--color-line-strong) / <alpha-value>)',
        hint: 'rgb(var(--color-hint) / <alpha-value>)',

        // ── Camada "Painel": chips pastel de CATEGORIA (nunca de gravidade).
        // Mesmos nomes da web (`bg-chip-azul-tint`, `text-chip-azul-ink`, …).
        chip: {
          'azul-tint': 'rgb(var(--color-chip-azul-tint) / <alpha-value>)',
          'azul-ink': 'rgb(var(--color-chip-azul-ink) / <alpha-value>)',
          'indigo-tint': 'rgb(var(--color-chip-indigo-tint) / <alpha-value>)',
          'indigo-ink': 'rgb(var(--color-chip-indigo-ink) / <alpha-value>)',
          'violeta-tint': 'rgb(var(--color-chip-violeta-tint) / <alpha-value>)',
          'violeta-ink': 'rgb(var(--color-chip-violeta-ink) / <alpha-value>)',
          'ameixa-tint': 'rgb(var(--color-chip-ameixa-tint) / <alpha-value>)',
          'ameixa-ink': 'rgb(var(--color-chip-ameixa-ink) / <alpha-value>)',
          'turquesa-tint': 'rgb(var(--color-chip-turquesa-tint) / <alpha-value>)',
          'turquesa-ink': 'rgb(var(--color-chip-turquesa-ink) / <alpha-value>)',
          'ardosia-tint': 'rgb(var(--color-chip-ardosia-tint) / <alpha-value>)',
          'ardosia-ink': 'rgb(var(--color-chip-ardosia-ink) / <alpha-value>)',
        },
      },
      // `card` = 16px, o raio de cartão do Painel (radiusPx.md em ui-tokens).
      borderRadius: { '4xl': '28px', xs: '8px', card: '16px', chip: '12px' },
    },
  },
  plugins: [],
};
