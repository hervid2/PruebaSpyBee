/**
 * E2E coverage of the authentication flow: valid/invalid credentials, inline
 * email validation, middleware route protection (redirect to /login), and a
 * mobile-viewport smoke check. Exercises the real login form via the UI.
 */
import { test, expect } from '@playwright/test';
import { loginViaUI } from './helpers/auth';

test.describe('Autenticación', () => {
  test('credenciales válidas redirigen a /mapa', async ({ page, isMobile }) => {
    await loginViaUI(page);
    await expect(page).toHaveURL(/\/mapa/, { timeout: 10_000 });
    // TopBar shows the logged-in user's name on desktop; on mobile only the avatar is shown
    if (!isMobile) {
      await expect(page.getByText('Julian Lozano')).toBeVisible();
    }
  });

  test('credenciales inválidas muestran error y permanecen en /login', async ({ page }) => {
    await loginViaUI(page, 'julian.lozano@spybee.io', 'wrongpassword');
    // Server error alert should appear
    await expect(
      page
        .getByRole('alert', { name: /credenciales inválidas/i })
        .or(page.locator('[aria-live="assertive"]').filter({ hasText: 'Credenciales inválidas' })),
    ).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('email con formato inválido muestra error inline sin llamar al servidor', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill('no-es-un-email');
    await page.getByLabel('Contraseña', { exact: true }).fill('spybee123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText('Introduce un email válido')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('acceso directo a /dashboard sin sesión redirige a /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('acceso directo a /mapa sin sesión redirige a /login', async ({ page }) => {
    await page.goto('/mapa');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Responsive smoke: auth flow in mobile viewport ─────────────────────────
test.describe('Autenticación — mobile (375×812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('login funciona en viewport móvil', async ({ page }) => {
    await loginViaUI(page);
    await expect(page).toHaveURL(/\/mapa/, { timeout: 10_000 });
  });
});
