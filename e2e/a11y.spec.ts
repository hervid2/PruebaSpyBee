/**
 * Accessibility audit (F9.7, `best-practices.md §Accessibility`): axe-core
 * over every page Phase 8 added, in both the desktop and mobile projects.
 *
 * Scoped to the WCAG 2.1 A/AA tags rather than axe's full rule set. Axe's
 * defaults also carry `best-practice` rules, which are opinions worth having
 * but not the bar the project committed to — mixing them in would mean a
 * failure here no longer tells you the app is out of conformance.
 *
 * These pages are audited signed in as a superadmin, because two of them
 * (`/historial`, `/papelera`) render an access-restricted panel to anyone
 * else: auditing those as a plain member would pass while never once looking
 * at the table this is supposed to be checking.
 *
 * What axe cannot see still needs a human: it catches roughly a third to a
 * half of WCAG issues, and nothing here proves the keyboard order is sane or
 * that a screen reader announces something meaningful. It is a floor.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { loginViaCookie } from './helpers/auth';

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const PHASE_8_PAGES = [
  { path: '/historial', roadmap: '8.1' },
  { path: '/papelera', roadmap: '8.2' },
  { path: '/galeria', roadmap: '8.4' },
  { path: '/documentos', roadmap: '8.5' },
  { path: '/calendario', roadmap: '8.6' },
  { path: '/ajustes', roadmap: '8.8' },
];

/**
 * axe's raw violation objects are deeply nested, so an `toEqual([])` failure
 * prints an unreadable wall of JSON. This turns one into the two things
 * needed to act on it: which rule, and which element.
 */
function describeViolations(violations: Result[]): string {
  if (violations.length === 0) return 'sin violaciones';
  return violations
    .map((v) => {
      const nodes = v.nodes.map((n) => `      ${n.target.join(' ')}`).join('\n');
      return `  [${v.impact ?? 'n/a'}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n${nodes}`;
    })
    .join('\n');
}

test.describe('Accesibilidad — páginas de la Fase 8', () => {
  for (const { path, roadmap } of PHASE_8_PAGES) {
    test(`${path} (roadmap ${roadmap}) no tiene violaciones WCAG 2.1 AA`, async ({ page }) => {
      await loginViaCookie(page);
      await page.goto(path);

      // Every Phase 8 view renders its title as the page's only h1; waiting on
      // it means axe analyses the loaded page rather than a skeleton, which
      // would quietly pass by having almost no DOM to look at.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();

      expect(violations, `${path}\n${describeViolations(violations)}`).toEqual([]);
    });
  }
});
