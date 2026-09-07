/**
 * Builds the per-request Content-Security-Policy for the Next.js app (F9.4,
 * `best-practices.md §Security`). The headers that never vary live in
 * `next.config.mjs` — that file is loaded by Node before any TypeScript is
 * compiled, so it cannot import this one; the CSP is here because it carries
 * a nonce and can only be built per request, in `middleware.ts`.
 */

/** Where the browser is allowed to reach: our own API, and Mapbox's tile/style/telemetry endpoints. */
function connectSources(): string[] {
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  return ["'self'", api, 'https://api.mapbox.com', 'https://events.mapbox.com'];
}

/**
 * Builds the per-request Content-Security-Policy.
 *
 * `'strict-dynamic'` with a nonce is the policy shape that actually holds up:
 * a host allowlist can be walked around through any JSONP-ish endpoint on an
 * allowed origin, whereas here only the scripts Next itself stamps with this
 * request's nonce run, plus whatever those load in turn. `'self'` stays for
 * browsers that don't know `'strict-dynamic'` and would otherwise fall back
 * to nothing.
 *
 * `style-src` keeps `'unsafe-inline'`: Next injects inline `<style>` blocks
 * for CSS modules and the font loader, and there is no nonce path for them in
 * the App Router. Inline *styles* are a far narrower problem than inline
 * scripts, and this is the standard trade-off rather than an oversight.
 *
 * `'unsafe-eval'` is development-only — React Fast Refresh needs it and the
 * production bundle does not.
 */
export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    // `data:`/`blob:` are Mapbox's own tile and sprite pipeline; `https:`
    // covers the S3 media bucket and the avatar hosts in `next.config.mjs`
    // without pinning a bucket name that changes per deployment.
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': connectSources(),
    // Mapbox GL runs its renderer in a worker built from a blob URL; without
    // these two the map silently fails to initialize.
    'worker-src': ["'self'", 'blob:'],
    'child-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    // Where a form may post: keeps an injected form from exfiltrating a
    // submitted password to somebody else's host.
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    ...(isDev ? {} : { 'upgrade-insecure-requests': [] }),
  };

  return Object.entries(directives)
    .map(([directive, values]) => (values.length ? `${directive} ${values.join(' ')}` : directive))
    .join('; ');
}
