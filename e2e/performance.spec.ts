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
 * clock, and this suite runs on whatever a CI runner has left: asserting the
 * 2.5 s "good" threshold would mean a red pipeline on a busy runner rather
 * than a slow page, and a check that flakes is a check people learn to
 * re-run. The number is attached to the report on every run, so the trend is
 * visible even when the assertion is quiet — that, rather than the threshold,
 * is what this is for.
 */
import { test, expect } from '@playwright/test';
import { loginViaCookie } from './helpers/auth';

const PHASE_8_PAGES = ['/historial', '/papelera', '/galeria', '/documentos', '/calendario'];

/** Web Vitals' own boundaries: <=0.1 CLS is "good", >4 s LCP is "poor". */
const CLS_BUDGET = 0.1;
const LCP_POOR_MS = 4_000;

declare global {
  interface Window {
    __webVitals?: { cls: number; lcp: number };
  }
}

test.describe('Core Web Vitals — páginas de la Fase 8', () => {
  for (const path of PHASE_8_PAGES) {
    test(`${path} se mantiene dentro del presupuesto de CLS`, async ({ page }, testInfo) => {
      await loginViaCookie(page);

      await page.addInitScript(() => {
        const vitals = { cls: 0, lcp: 0 };
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
          vitals.lcp = entries[entries.length - 1].startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });

      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

      // Late-arriving images are exactly the shifts worth catching, so give
      // the page a moment past first paint before reading the counters.
      await page.waitForTimeout(1_500);

      const vitals = await page.evaluate(() => window.__webVitals ?? { cls: 0, lcp: 0 });

      await testInfo.attach(`web-vitals${path.replace(/\//g, '-')}`, {
        body: JSON.stringify(vitals, null, 2),
        contentType: 'application/json',
      });

      expect(vitals.cls, `CLS en ${path}: ${vitals.cls.toFixed(4)}`).toBeLessThanOrEqual(
        CLS_BUDGET,
      );
      expect(vitals.lcp, `LCP en ${path}: ${Math.round(vitals.lcp)} ms`).toBeLessThan(LCP_POOR_MS);
    });
  }
});
