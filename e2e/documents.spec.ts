/**
 * Seeded documents link to static PDFs under `public/mocks/documentos/`,
 * served by the frontend rather than the media bucket (see
 * backend/prisma/seed.ts). A relative link renders exactly the same whether or
 * not anything answers behind it, which is how the sidebar's links to routes
 * that never existed went unnoticed for so long — so this one is followed.
 *
 * It also has to get past `middleware.ts`, which matches `/mocks/*` and sends
 * anything without a valid session to `/login`. That redirect answers 200 with
 * an HTML page, which is why the content type and the file signature are
 * checked, not only the status.
 */
import { test, expect } from '@playwright/test';
import { loginViaCookie } from './helpers/auth';

test('un documento sembrado en /documentos abre como PDF', async ({ page }) => {
  // An org with incidents; the superadmin's has none (see a11y.spec.ts).
  await loginViaCookie(page, 'isabela.nieto@constructoradelvalle.com');
  await page.goto('/documentos');

  const link = page.locator('tbody a[href]').first();
  await expect(link).toBeVisible({ timeout: 15_000 });
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();

  // `page.request` shares the browser context's cookies, so this is the same
  // request the click would make, minus the new tab.
  const response = await page.request.get(new URL(href!, page.url()).toString());
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
  expect((await response.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
});
