/** @type {import('tailwindcss').Config} */
// Cores espelham @vidalog/ui-tokens (RN não importa tokens TS no config do Tailwind).
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#0284C7', // Trust Blue
        accent: '#10B981', // Health Green
        trust: { 50: '#F0F9FF', 100: '#E0F2FE', 600: '#0284C7', 700: '#0369A1' },
        health: { 500: '#10B981', 600: '#059669' },
        semaphore: { ok: '#10B981', attention: '#F59E0B', alert: '#EF4444' },
      },
    },
  },
  plugins: [],
};
