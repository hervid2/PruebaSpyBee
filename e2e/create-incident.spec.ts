import { test, expect } from '@playwright/test';
import { loginViaCookie } from './helpers/auth';

// Next date string 7 days from today (always a valid future due date)
function futureDateStr(daysAhead = 7) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

test.describe('Crear Incidencia — Mapa', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaCookie(page);
    await page.goto('/mapa');
  });

  test('botón + abre el modal "Crear Incidencia"', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear nueva incidencia' }).click();
    const dialog = page.getByRole('dialog', { name: 'Crear Incidencia' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Crear Incidencia')).toBeVisible();
  });

  test('Escape cierra el modal sin enviar el formulario', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear nueva incidencia' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  test('botón Cancelar cierra el modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear nueva incidencia' }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  });

  test('enviar formulario vacío muestra errores de validación y mantiene el modal abierto', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Crear nueva incidencia' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Crear', exact: true }).click();
    // At least one inline error alert must appear
    await expect(page.getByRole('alert').first()).toBeVisible();
    // Modal stays open
    await expect(dialog).toBeVisible();
  });

  test('flujo completo: rellenar campos requeridos → Crear → modal se cierra', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear nueva incidencia' }).click();
    const dialog = page.getByRole('dialog');

    // Título
    await dialog.locator('#issue-title').fill('Fisura en columna B2 — E2E');

    // Descripción
    await dialog
      .locator('#issue-description')
      .fill('Se detectó una fisura diagonal en la columna B2 del piso 3. Evaluación urgente.');

    // Fecha de vencimiento
    await dialog.locator('#issue-due-date').fill(futureDateStr(7));

    // Categoría (select first valid option after the placeholder)
    await dialog.locator('#issue-type').selectOption({ index: 1 });

    // Prioridad
    await dialog.locator('#issue-priority').selectOption('high');

    // Enviar
    await dialog.getByRole('button', { name: 'Crear' }).click();

    // Modal should close after successful submission
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });

  test('Gestionar categorías abre sub-modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear nueva incidencia' }).click();
    await page.getByRole('button', { name: 'Gestionar categorías' }).click();
    // CategoryManagerModal opens — check for its unique heading
    await expect(page.getByRole('heading', { name: /Gestionar Categorías/i })).toBeVisible();
  });
});

// ── Dashboard: el modal también se abre desde el header ───────────────────
test.describe('Crear Incidencia — Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaCookie(page);
    await page.goto('/dashboard');
  });

  test('botón "Crear Incidencia" del header abre el modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear nueva incidencia' }).click();
    await expect(page.getByRole('dialog', { name: 'Crear Incidencia' })).toBeVisible();
  });

  test('crear incidencia desde dashboard — modal se cierra correctamente', async ({ page }) => {
    await page.getByRole('button', { name: 'Crear nueva incidencia' }).click();
    const dialog = page.getByRole('dialog');

    await dialog.locator('#issue-title').fill('Humedad en cielo raso piso 2 — E2E');
    await dialog.locator('#issue-description').fill('Mancha húmeda de aprox. 0.4 m² detectada.');
    await dialog.locator('#issue-due-date').fill(futureDateStr(14));
    await dialog.locator('#issue-type').selectOption({ index: 2 });
    await dialog.locator('#issue-priority').selectOption('medium');
    await dialog.getByRole('button', { name: 'Crear' }).click();

    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });
});

// ── Responsive smoke ───────────────────────────────────────────────────────
test.describe('Crear Incidencia — mobile (375×812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('modal ocupa pantalla completa en móvil', async ({ page }) => {
    await loginViaCookie(page);
    await page.goto('/mapa');
    await page.getByRole('button', { name: 'Crear nueva incidencia' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // In mobile the modal should cover the full viewport (width ≥ 95% of screen)
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(350);
  });
});
