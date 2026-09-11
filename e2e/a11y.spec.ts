/**
 * Accessibility audit (F9.7, `best-practices.md §Accessibility`): axe-core
 * over every page Phase 8 added, in both the desktop and mobile projects.
 *
 * Scoped to the WCAG 2.1 A/AA tags rather than axe's full rule set. Axe's
 * defaults also carry `best-practice` rules, which are opinions worth having
 * but not the bar the project committed to — mixing them in would mean a
 * failure here no longer tells you the app is out of conformance.
 *
 * The account these run as matters as much as the rule set -- see AUDIT_USER
 * below. Two of these pages are role-gated, and every one of them has an empty
 * state that would sail through an audit while showing none of the markup the
 * audit exists to check.
 *
 * What axe cannot see still needs a human: it catches roughly a third to a
 * half of WCAG issues, and nothing here proves the keyboard order is sane or
 * that a screen reader announces something meaningful. It is a floor.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { loginViaCookie } from './helpers/auth';

/**
 * Admin of `Constructora del Valle`, deliberately not the `superadmin`.
 *
 * The obvious pick is the superadmin, and it is the wrong one: the seed puts
 * that account in `FlyWorkFlow`, the platform vendor's own organization, which
 * has no project and therefore no incidents, no media and nothing in the
 * trash. Auditing as that user renders the empty state of every page here --
 * which passes, cheaply and meaninglessly, because there is almost no DOM to
 * examine. It took reading the LCP element (`p.GalleryView__empty`) to notice.
 *
 * This account is an admin, so `/historial` and `/papelera` still resolve
 * rather than rendering the access-restricted panel, and its org holds 87
 * live incidents, 12 more in the trash, 36 documents and 238 audit log
 * entries -- enough that every table below has rows (see `rows`).
 */
const AUDIT_USER = 'isabela.nieto@constructoradelvalle.com';

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * A data cell in the three table views. Each one carries `data-label` (the
 * mobile card layout prints it as the field name); the empty-state cell does
 * not.
 */
const DATA_CELL = 'tbody td[data-label]';

/**
 * `rows` is the proof a page rendered data rather than its empty state, and it
 * is asserted before axe runs. Until the seed gained documents and an audit
 * trail, `/historial` and `/documentos` could only ever be audited empty -- in
 * every environment -- and this suite was green anyway. That is the failure
 * F9.7 already met once with the superadmin, reached a second way: a pass rate
 * cannot say which DOM it was measured against, so the spec has to.
 */
const PHASE_8_PAGES: { path: string; roadmap: string; rows?: string }[] = [
  { path: '/historial', roadmap: '8.1', rows: DATA_CELL },
  { path: '/papelera', roadmap: '8.2', rows: DATA_CELL },
  { path: '/galeria', roadmap: '8.4' },
  { path: '/documentos', roadmap: '8.5', rows: DATA_CELL },
  { path: '/calendario', roadmap: '8.6' },
  { path: '/ajustes', roadmap: '8.8' },
];

/**
 * axe's raw violation objects are deeply nested, so an `toEqual([])` failure
 * prints an unreadable wall of JSON. This turns one into the two things
 * needed to act on it: which rule, and which element.
 */
const NO_VIOLATIONS = 'sin violaciones';

function describeViolations(violations: Result[]): string {
  if (violations.length === 0) return NO_VIOLATIONS;
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
      await loginViaCookie(page, AUDIT_USER);
      await page.goto(path);

      // Every Phase 8 view renders its title as the page's only h1; waiting on
      // it means axe analyses the loaded page rather than a skeleton, which
      // would quietly pass by having almost no DOM to look at.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();

      // Asserted as the formatted string, not `toEqual([])` on the raw
      // objects: axe's violation shape is deeply nested, and the failure
      // diff for it buries the rule id and the selector under hundreds of
      // lines of JSON. Comparing the summary puts them in the first line.
      expect(describeViolations(violations), path).toBe(NO_VIOLATIONS);
    });
  }
});
