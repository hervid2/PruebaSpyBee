/**
 * Core Web Vitals over the Phase 8 pages (F9.7, `best-practices.md
 * §Performance`). A spec rather than a one-off Lighthouse screenshot so a
 * regression is caught by the same pipeline as everything else.
 *
 * Observers are installed through `addInitScript`, i.e. before any document
 * script runs: both metrics accumulate from the very first paint, and reading
 * them afterwards from a plain `page.evaluate` would have missed everything
 * that happened before the evaluate landed.
 *
 * The two metrics are asserted differently on purpose.
 *
 * **CLS is a hard budget** at the 0.1 "good" boundary. For a fixed viewport it
 * is close to deterministic — it measures whether the page reserves space for
 * its own content, which is a property of the CSS, not of how fast the
 * machine is. A regression here is a real one.
 *
 * **LCP is reported, and only failed at the 4 s "poor" boundary.** It is wall
 * clock, so asserting the 2.5 s "good" threshold would mean a red pipeline on
 * a busy runner rather than a slow page, and a check that flakes is a check
 * people learn to re-run. The number is attached and logged every run, so the
 * trend stays visible while the assertion is quiet.
 *
 * Measured once the seed gained documents and an audit trail, so every table
 * here renders rows (desktop project, single worker, cold image cache):
 *
 *   /historial   876 ms   /papelera   468 ms   /galeria  552 ms
 *   /documentos  656 ms   /calendario 636 ms   CLS 0.0000-0.0021 in both projects
 *
 * F9.7's first readings for /historial and /documentos were taken against
 * empty tables. The margin under 4 s is still wide, and the one 5.2 s reading
 * seen while building this came from running both projects in parallel on a
 * loaded laptop, not from the page: `playwright.config.ts` pins `workers: 1`
 * under CI, which is the regime those numbers were taken in and the only one
 * that gates.
 */
import { test, expect } from '@playwright/test';
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
 * entries.
 */
const AUDIT_USER = 'isabela.nieto@constructoradelvalle.com';

const PHASE_8_PAGES = ['/historial', '/papelera', '/galeria', '/documentos', '/calendario'];

/** Web Vitals' own boundaries: <=0.1 CLS is "good", >4 s LCP is "poor". */
const CLS_BUDGET = 0.1;
const LCP_POOR_MS = 4_000;

declare global {
  interface Window {
    __webVitals?: { cls: number; lcp: number; lcpElement: string };
  }
}

test.describe('Core Web Vitals — páginas de la Fase 8', () => {
  for (const path of PHASE_8_PAGES) {
    test(`${path} se mantiene dentro del presupuesto de CLS`, async ({ page }, testInfo) => {
      await loginViaCookie(page, AUDIT_USER);

      await page.addInitScript(() => {
        const vitals = { cls: 0, lcp: 0, lcpElement: '' };
        window.__webVitals = vitals;

        // `buffered: true` replays entries recorded before this observer
        // existed, which is what makes the very first shift and paint count.
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            // Shifts within 500 ms of a real interaction are the user's own
            // doing (opening a menu, expanding a row) and are excluded from
            // CLS by definition.
            if (!entry.hadRecentInput) vitals.cls += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });

        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          // LCP is republished as bigger elements paint; the last one wins.
          const last = entries[entries.length - 1] as PerformanceEntry & { element?: Element };
          vitals.lcp = last.startTime;
          // Recording *which* element it was is the difference between a
          // number you can act on and one you can only watch: the fix for a
          // slow hero image and a slow block of text are not the same fix.
          const el = last.element;
          vitals.lcpElement = el
            ? `${el.tagName.toLowerCase()}.${el.className || '(sin clase)'}`
            : '';
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });

      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

      // Late-arriving images are exactly the shifts worth catching, so give
      // the page a moment past first paint before reading the counters.
      await page.waitForTimeout(1_500);

      const vitals = await page.evaluate(
        () => window.__webVitals ?? { cls: 0, lcp: 0, lcpElement: '' },
      );

      // Printed as well as attached: the attachment lives in the HTML report,
      // and the number is worth seeing in a plain CI log too.
      console.log(
        `[web-vitals] ${path} LCP=${Math.round(vitals.lcp)}ms CLS=${vitals.cls.toFixed(4)} elemento=${vitals.lcpElement}`,
      );
      await testInfo.attach(`web-vitals${path.replace(/\//g, '-')}`, {
        body: JSON.stringify(vitals, null, 2),
        contentType: 'application/json',
      });

      expect(vitals.cls, `CLS en ${path}: ${vitals.cls.toFixed(4)}`).toBeLessThanOrEqual(
        CLS_BUDGET,
      );
      expect(
        vitals.lcp,
        `LCP en ${path}: ${Math.round(vitals.lcp)} ms — elemento: ${vitals.lcpElement}`,
      ).toBeLessThan(LCP_POOR_MS);
    });
  }
});
