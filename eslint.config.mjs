/**
 * ESLint flat config (F9.5). Replaces `.eslintrc.json`, which stopped being
 * read when this project moved to eslint@9 — a move `next@16` forced, since
 * `eslint-config-next@16` requires it. `next lint` was removed in the same
 * major, so `npm run lint` calls `eslint` directly now.
 *
 * The two extends below are the flat-config equivalent of the old
 * `["next/core-web-vitals", "next/typescript"]`, and both are needed:
 * `core-web-vitals` brings Next's own rules plus the TypeScript *parser*,
 * while the `typescript` subpath is what adds the `typescript-eslint`
 * recommended rule set. Taking only the first would silently drop those.
 */
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    // `next lint` scoped itself to the app's own directories. Plain `eslint`
    // walks everything from the repo root, so what it must not walk is stated
    // here. `backend/` most of all: a separate package with its own eslint
    // config and its own `npm run lint`, and linting it from here would apply
    // React rules to a NestJS codebase.
    ignores: [
      'backend/**',
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default config;
