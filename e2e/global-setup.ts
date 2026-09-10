/**
 * Runs once before the whole Playwright run (all projects/workers), not once
 * per worker — the login endpoint's 5-requests-per-minute throttle
 * (requirements.md §1.1) can't absorb every project independently re-logging
 * in for the same credentials. Pre-warms fetchAccessToken's on-disk cache
 * (e2e/.auth/, gitignored) for every credential pair loginViaCookie is known
 * to use, so no spec ever needs its own real /auth/login round trip for
 * session-seeding — only loginViaUI's form-driven tests (auth.spec.ts) still
 * hit the endpoint for real, by design.
 */
import { request } from '@playwright/test';
import { fetchAccessToken } from './helpers/auth';

/**
 * Every entry is a real `/auth/login` when the run starts, and the login route
 * allows five a minute per IP. The sixth does not just fail: `@nestjs/throttler`
 * 6 then blocks *every* login from that IP for the next 60 s, and all of CI is
 * one IP. So this list is a budget, not a convenience. F9.7 added a third
 * account here, which left auth.spec's uncached form logins over the limit and
 * turned the second project's valid-login test into a 429 that never left
 * /login. Two accounts cover every spec; keep it at two.
 */
const KNOWN_CREDENTIALS: [email: string, password: string][] = [
  // loginViaCookie's default across most specs.
  ['camila.rojas@flyworkflow.io', 'FlyWorkFlow2026!'],
  // An admin of an org that holds data. create-incident.spec.ts needs a
  // project to file against; a11y.spec.ts and performance.spec.ts need admin
  // rights plus real rows (see AUDIT_USER there).
  ['isabela.nieto@constructoradelvalle.com', 'FlyWorkFlow2026!'],
];

export default async function globalSetup() {
  const context = await request.newContext();
  try {
    for (const [email, password] of KNOWN_CREDENTIALS) {
      await fetchAccessToken(context, email, password);
    }
  } finally {
    await context.dispose();
  }
}
