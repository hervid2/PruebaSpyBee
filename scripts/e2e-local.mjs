/**
 * Runs the full Playwright suite locally, against the same stack CI builds
 * (F9.5): a real `postgres:16`, a real backend, a real frontend.
 *
 * Before this, `npm run test:e2e` alone could not work outside CI — the specs
 * log in against a live API and `e2e/global-setup.ts` pre-warms real tokens,
 * so with no backend the whole run dies in setup. The pieces existed only as
 * steps inside ci.yml, which meant checking a spec locally involved
 * reconstructing them by hand.
 *
 * This script owns the two things Playwright cannot: the database container,
 * and getting the schema and seed data into it. Starting the backend and the
 * frontend is left to Playwright's own `webServer` (see playwright.config.ts),
 * which already knows how to wait for a URL and how to kill what it started —
 * `E2E_LOCAL=1` is what switches the backend entry on, so CI, which starts its
 * own, is unaffected.
 *
 *   node scripts/e2e-local.mjs              the whole suite
 *   node scripts/e2e-local.mjs --ui         Playwright's UI mode
 *   node scripts/e2e-local.mjs e2e/auth.spec.ts
 *
 * Any argument is forwarded to `playwright test` untouched.
 */
import { spawnSync } from 'node:child_process';

const DB_PORT = process.env.E2E_DB_PORT ?? '5433';
const DATABASE_URL = `postgresql://flyworkflow:flyworkflow@localhost:${DB_PORT}/flyworkflow?schema=public`;

/** Same value ci.yml uses for both halves. Never a real secret — the frontend middleware verifies against it too. */
const JWT_ACCESS_SECRET = 'ci-test-only-secret-do-not-use-in-prod';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function step(label, command, args, options) {
  console.log(`\n── ${label} ──`);
  const code = run(command, args, options);
  if (code !== 0) {
    console.error(`\n"${label}" failed (exit ${code}).`);
    process.exit(code);
  }
}

// `--wait` blocks until the healthcheck passes, so nothing below races the
// database coming up — this is the compose equivalent of ci.yml's
// `--health-cmd pg_isready` service options.
step('starting postgres', 'docker', ['compose', 'up', '-d', '--wait', 'db']);

const backendEnv = { ...process.env, DATABASE_URL };
step('applying migrations', 'npx', ['prisma', 'migrate', 'deploy'], {
  cwd: 'backend',
  env: backendEnv,
});
step('seeding', 'npx', ['prisma', 'db', 'seed'], {
  cwd: 'backend',
  env: backendEnv,
});
// Playwright starts `node dist/main.js`, not `nest start`, so the build has to
// have happened first — same order as ci.yml.
step('building backend', 'npm', ['run', 'build'], {
  cwd: 'backend',
  env: backendEnv,
});

console.log('\n── running playwright ──');
const testCode = run('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  env: {
    ...process.env,
    E2E_LOCAL: '1',
    DATABASE_URL,
    JWT_ACCESS_SECRET,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  },
});

console.log(
  `\nDone. The database is still up — \`npm run e2e:db:down\` removes it and its volume.`,
);
process.exit(testCode);
