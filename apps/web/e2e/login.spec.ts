import { test, expect } from '@playwright/test';

test.describe('Autenticação', () => {
  test('rota privada redireciona para /login quando deslogado', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('a tela de login renderiza o formulário', async ({ page }) => {
    await page.goto('/login');
    // O título do cartão de login é "Bem-vindo de volta" desde o commit inicial —
    // o teste procurava um heading "Entrar", que nunca existiu nesta tela (só o
    // botão de submit se chama "Entrar"). Continua sendo uma asserção real: se o
    // heading sumir, mudar de nível ou perder o texto, o teste quebra.
    await expect(page.getByRole('heading', { level: 1, name: 'Bem-vindo de volta' })).toBeVisible();
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  });

  test('valida e-mail inválido no cliente', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('nao-e-um-email');
    await page.getByLabel('Senha').fill('alguma-coisa');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('E-mail inválido.')).toBeVisible();
  });

  // Login REAL: só roda quando há credenciais de teste no ambiente.
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test('login com credenciais reais carrega o dashboard', async ({ page }) => {
    test.skip(!email || !password, 'Defina E2E_EMAIL/E2E_PASSWORD para o teste de login real.');
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email as string);
    await page.getByLabel('Senha').fill(password as string);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText('Aqui está seu resumo')).toBeVisible();
  });
});
