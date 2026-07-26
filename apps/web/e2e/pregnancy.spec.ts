import { test, expect } from '@playwright/test';

/**
 * E2E da Jornada Gestante.
 *
 * O teste de proteção de rota roda sempre. O fluxo autenticado só roda com
 * credenciais reais em E2E_EMAIL/E2E_PASSWORD (perfil feminino em idade fértil).
 *
 * A gestação é iniciada pela MESMA RPC do app (`start_pregnancy`) — o input
 * nativo de data é notoriamente instável em automação, e o onboarding por UI
 * já é validado manualmente. O foco aqui é garantir que iniciar uma gestação
 * popula a timeline com os marcos curados do Ministério da Saúde.
 */
test.describe('Gestação', () => {
  test('/gestacao redireciona para /login quando deslogado', async ({ page }) => {
    await page.goto('/gestacao');
    await expect(page).toHaveURL(/\/login/);
  });

  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  test('iniciar gestação popula a timeline com marcos do MS', async ({ page, request }) => {
    test.skip(!email || !password, 'Defina E2E_EMAIL/E2E_PASSWORD (perfil feminino, idade fértil).');
    test.skip(supaUrl.includes('placeholder'), 'Requer credenciais Supabase reais.');

    // Login pela UI (valida o fluxo de autenticação).
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail' }).fill(email as string);
    await page.locator('input[type="password"]').fill(password as string);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Garante uma gestação ativa via a mesma RPC do app (estável).
    const tokenResp = await request.post(`${supaUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      data: { email, password },
    });
    const token = (await tokenResp.json()).access_token as string;
    const authHeaders = { apikey: anon, Authorization: `Bearer ${token}` };

    const existing = await request.get(
      `${supaUrl}/rest/v1/pregnancy_journeys?status=eq.active&select=id`,
      { headers: authHeaders },
    );
    if (((await existing.json()) as unknown[]).length === 0) {
      const dpp = new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const rpc = await request.post(`${supaUrl}/rest/v1/rpc/start_pregnancy`, {
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        data: { p_due_date: dpp },
      });
      expect(rpc.ok()).toBeTruthy();
    }

    // A UI deve renderizar a timeline com marcos curados do MS + disclaimer permanente.
    await page.goto('/gestacao');
    await expect(page.getByText('Primeira consulta de pré-natal').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Ultrassom morfológico do 2º trimestre')).toBeVisible();
    await expect(page.getByText('Pesquisa de estreptococo B (GBS)')).toBeVisible();
    await expect(page.getByText(/Apenas o profissional que acompanha sua gestação/)).toBeVisible();
  });
});
