import { test, expect } from '@playwright/test';

/**
 * E2E da Caderneta da Criança.
 *
 * Proteção de rota roda sempre. O fluxo autenticado (login → criança + medida →
 * gráfico) só roda com E2E_EMAIL/E2E_PASSWORD e Supabase real. A criança e a
 * medida são semeadas via REST (estável); a asserção valida que a UI renderiza
 * a criança e sua medida no detalhe.
 */
test.describe('Crianças', () => {
  test('/criancas redireciona para /login quando deslogado', async ({ page }) => {
    await page.goto('/criancas');
    await expect(page).toHaveURL(/\/login/);
  });

  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  test('adicionar criança → registrar medida → ver no detalhe', async ({ page, request }) => {
    test.skip(!email || !password, 'Defina E2E_EMAIL/E2E_PASSWORD.');
    test.skip(supaUrl.includes('placeholder'), 'Requer credenciais Supabase reais.');

    // Login pela UI.
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'E-mail' }).fill(email as string);
    await page.locator('input[type="password"]').fill(password as string);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Semeia criança + medida via REST (estável).
    const tokenResp = await request.post(`${supaUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      data: { email, password },
    });
    const token = (await tokenResp.json()).access_token as string;
    const userResp = await request.get(`${supaUrl}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    const parentId = (await userResp.json()).id as string;
    const authHeaders = {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    const childResp = await request.post(`${supaUrl}/rest/v1/children`, {
      headers: authHeaders,
      data: {
        parent_profile_id: parentId,
        full_name: 'Bebê Teste E2E',
        birth_date: '2025-01-10',
        sex: 'female',
      },
    });
    expect(childResp.ok()).toBeTruthy();
    const childId = (await childResp.json())[0].id as string;

    const measResp = await request.post(`${supaUrl}/rest/v1/child_growth_measurements`, {
      headers: authHeaders,
      data: {
        child_id: childId,
        age_months_at_measurement: 12,
        measured_at: '2026-01-10',
        weight_kg: 9.5,
        length_or_height_cm: 74,
      },
    });
    expect(measResp.ok()).toBeTruthy();

    // A lista mostra a criança.
    await page.goto('/criancas');
    await expect(page.getByText('Bebê Teste E2E').first()).toBeVisible({ timeout: 15_000 });

    // O detalhe mostra a medida (peso) e o disclaimer permanente.
    await page.goto(`/criancas/${childId}`);
    await expect(page.getByText('9,5').first().or(page.getByText('9.5').first())).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Cada criança tem seu ritmo/)).toBeVisible();
  });
});
