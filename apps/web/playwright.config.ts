import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E do web. O webServer sobe `next dev` com credenciais placeholder —
 * suficiente para validar render, navegação e o redirect de proteção.
 * Para testar login REAL, defina E2E_EMAIL/E2E_PASSWORD e credenciais
 * Supabase válidas no ambiente.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // No CI também gera o relatório HTML em playwright-report/, que é o diretório
  // que o job `e2e-web` sobe como artefato. Sem ele o upload não achava nada e o
  // trace de uma falha (trace: 'on-first-retry') ficava inacessível.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    },
  },
});
