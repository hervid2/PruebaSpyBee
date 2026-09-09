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

const KNOWN_CREDENTIALS: [email: string, password: string][] = [
  // loginViaCookie's default across most specs.
  ['camila.rojas@flyworkflow.io', 'FlyWorkFlow2026!'],
  // create-incident.spec.ts: needs a user whose org actually has a project.
  ['diego.salazar@constructoradelvalle.com', 'FlyWorkFlow2026!'],
  // a11y.spec.ts / performance.spec.ts (F9.7): admin of an org that actually
  // holds data. See AUDIT_USER in those specs for why it cannot be the
  // superadmin.
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
