import { test, expect } from '@playwright/test';
import { loginViaCookie } from './helpers/auth';

test.describe('Dashboard — Filtros de período', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaCookie(page);
    await page.goto('/dashboard');
    // Ensure KPI section is rendered
    await expect(page.getByRole('region', { name: 'Indicadores clave' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('cambiar período de 30d a 7d actualiza "Creadas en el período"', async ({ page }) => {
    // Go to 30d
    await page.getByRole('button', { name: 'Últimos 30 días' }).click();
    const card30 = page
      .getByRole('region', { name: 'Indicadores clave' })
      .locator('article')
      .filter({ hasText: 'Creadas en el período' });
    const value30 = Number(await card30.locator('p').last().textContent());

    // Switch to 7d
    await page.getByRole('button', { name: 'Últimos 7 días' }).click();
    const card7 = page
      .getByRole('region', { name: 'Indicadores clave' })
      .locator('article')
      .filter({ hasText: 'Creadas en el período' });
    const value7 = Number(await card7.locator('p').last().textContent());

    // 30-day window always contains at least as many incidents as the 7-day window
    expect(value30).toBeGreaterThanOrEqual(value7);
  });

  test('cambiar período actualiza el botón activo (aria-pressed)', async ({ page }) => {
    const btn7 = page.getByRole('button', { name: 'Últimos 7 días' });
    const btn30 = page.getByRole('button', { name: 'Últimos 30 días' });
    const btn90 = page.getByRole('button', { name: 'Últimos 90 días' });

    await btn7.click();
    await expect(btn7).toHaveAttribute('aria-pressed', 'true');
    await expect(btn30).toHaveAttribute('aria-pressed', 'false');

    await btn90.click();
    await expect(btn90).toHaveAttribute('aria-pressed', 'true');
    await expect(btn7).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Dashboard — Modal de filtros avanzados', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaCookie(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('region', { name: 'Indicadores clave' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('abre y cierra el modal de filtros con el botón X', async ({ page }) => {
    await page.getByRole('button', { name: 'Abrir filtros avanzados' }).click();
    const filterDialog = page.getByRole('dialog', { name: 'Filtros del dashboard' });
    await expect(filterDialog).toBeVisible();

    await filterDialog.getByRole('button', { name: 'Cerrar filtros' }).click();
    await expect(filterDialog).not.toBeVisible();
  });

  test('aplicar filtro de prioridad Alta → tabla muestra solo incidencias Alta', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Abrir filtros avanzados' }).click();
    // Click the "Alta" chip inside the Prioridad fieldset
    await page
      .getByRole('group', { name: 'Prioridad' })
      .getByRole('button', { name: 'Alta' })
      .click();
    await page.getByRole('button', { name: 'Aplicar' }).click();

    // All rows in the table should have Alta priority
    await expect(page.locator('table')).toBeVisible();
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    if (rowCount > 0) {
      // Each row's priority cell should contain "Alta" (not empty/other)
      const priorityCells = page.locator('tbody tr td:nth-child(3)');
      const allTexts = await priorityCells.allTextContents();
      allTexts.forEach((text) => expect(text.trim()).toBe('Alta'));
    }
  });

  test('limpiar filtros restaura la tabla con todos los datos', async ({ page }) => {
    // Apply a restrictive filter first
    await page.getByRole('button', { name: 'Abrir filtros avanzados' }).click();
    await page
      .getByRole('group', { name: 'Estado' })
      .getByRole('button', { name: 'Cerrada' })
      .click();
    await page.getByRole('button', { name: 'Aplicar' }).click();

    // Get row count with filter applied
    const filteredCount = await page.locator('tbody tr').count();

    // Open modal again and clear
    await page.getByRole('button', { name: 'Abrir filtros avanzados' }).click();
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();

    // Row count with no filter must be >= filtered count
    const allCount = await page.locator('tbody tr').count();
    expect(allCount).toBeGreaterThanOrEqual(filteredCount);
  });
});

test.describe('Dashboard — Indicadores de riesgo', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaCookie(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('region', { name: 'Indicadores de riesgo' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('chip "Alta prioridad abiertas" filtra la tabla', async ({ page }) => {
    const chip = page.getByRole('button', { name: /Alta prioridad abiertas/i });
    await expect(chip).toBeVisible();

    // Activate risk filter
    await chip.click();
    await expect(page.getByText('(filtrado por riesgo)')).toBeVisible();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  test('hacer click dos veces en un chip desactiva el filtro', async ({ page }) => {
    const chip = page.getByRole('button', { name: /Alta prioridad abiertas/i });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');

    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('(filtrado por riesgo)')).not.toBeVisible();
  });

  test('todos los chips de riesgo muestran un contador numérico', async ({ page }) => {
    const chips = page.getByRole('region', { name: 'Indicadores de riesgo' }).getByRole('button');
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(4);
    // Each chip should contain a number (the count badge)
    for (let i = 0; i < count; i++) {
      const text = await chips.nth(i).textContent();
      expect(text).toMatch(/\d+/);
    }
  });
});

test.describe('Dashboard — Paginación de la tabla', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaCookie(page);
    await page.goto('/dashboard');
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
  });

  test('navegación a la siguiente página actualiza las filas', async ({ page }) => {
    const nextBtn = page.getByRole('button', { name: 'Página siguiente' });
    const isDisabled = await nextBtn.isDisabled();
    if (isDisabled) {
      // Not enough incidents to paginate — test passes vacuously
      return;
    }

    // Get first row ID before pagination
    const firstIdBefore = await page.locator('tbody tr td:first-child').first().textContent();
    await nextBtn.click();
    const firstIdAfter = await page.locator('tbody tr td:first-child').first().textContent();

    expect(firstIdAfter).not.toBe(firstIdBefore);
  });
});

// ── Responsive smoke ────────────────────────────────────────────────────────
test.describe('Dashboard — mobile (375×812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('dashboard carga correctamente en móvil y muestra KPIs', async ({ page }) => {
    await loginViaCookie(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('region', { name: 'Indicadores clave' })).toBeVisible({
      timeout: 10_000,
    });
    // SidebarNav should collapse (not visible as a vertical sidebar)
    // just verify KPIs are reachable on a narrow screen
    const kpis = page.locator('article');
    const kpiCount = await kpis.count();
    expect(kpiCount).toBeGreaterThanOrEqual(6);
  });
});
