import type { Page } from '@playwright/test';

// Builds the exact cookie value that useAuthStore.persist writes via its custom cookieStorage.
// The cookie value is the URL-encoded JSON of { state: {...}, version: 0 }.
function buildAuthCookieValue() {
  const payload = {
    state: {
      user: {
        id: 'spybee_u1',
        name: 'Julian Lozano',
        email: 'julian.lozano@spybee.io',
        avatarUrl: 'https://i.pravatar.cc/150?u=julian.lozano',
        role: 'Superadmin',
        company: 'SPYBEE',
      },
      token: 'e2e-test-token-abc123',
      isAuthenticated: true,
    },
    version: 0,
  };
  return encodeURIComponent(JSON.stringify(payload));
}

/**
 * Bypass the login page by injecting auth cookies directly.
 * Faster than loginViaUI and avoids coupling tests to the login form.
 * Call BEFORE the first page.goto() so the middleware sees the session cookie.
 */
export async function loginViaCookie(page: Page) {
  await page.context().addCookies([
    {
      name: 'spybee-session',
      value: '1',
      url: 'http://localhost:3000',
      path: '/',
      sameSite: 'Lax',
    },
    {
      name: 'spybee-auth',
      value: buildAuthCookieValue(),
      url: 'http://localhost:3000',
      path: '/',
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Full UI login flow — use only in auth.spec.ts where the login form itself is under test.
 */
export async function loginViaUI(
  page: Page,
  email = 'julian.lozano@spybee.io',
  password = 'spybee123',
) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}
