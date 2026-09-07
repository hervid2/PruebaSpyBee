/**
 * F9.4 — response security headers for the Next.js app. `helmet` has covered
 * the backend since F6.3; the frontend, which is the half that actually
 * renders HTML and holds the session cookie, had none of this and was left to
 * each browser's defaults.
 *
 * These are the headers that never vary, so they are set here rather than in
 * middleware — that also gets them onto the responses middleware is not
 * matched on (`_next/static`, the generated icon/OG routes, robots.txt,
 * sitemap.xml). The request-scoped half of the policy is the CSP, which
 * carries a per-request nonce and therefore lives in `src/middleware.ts`
 * (built by `src/lib/security-headers.ts`).
 *
 * Kept in plain JS, not imported from the TypeScript module next to the CSP
 * builder: this file is loaded directly by Node before any TS is compiled.
 */
const securityHeaders = [
  // Stops a browser from second-guessing a declared Content-Type — the step
  // that turns an uploaded "image" into an executed script.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Clickjacking. `frame-ancestors 'none'` in the CSP is the modern form and
  // takes precedence where both are understood; this is the fallback.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Send the full URL only to ourselves. Cross-origin requests carry the bare
  // origin, so an invitation token in the path (`/invitar/:token`) never
  // leaves in a `Referer` — the same leak F9.2 kept out of the search index
  // and F9.3 kept out of CloudWatch.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here uses any of these, so denying them means a script that does
  // get in cannot either.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Vercel serves HTTPS only, so this costs nothing and closes the one
  // plaintext request a network attacker could still intercept.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['mapbox-gl'],
  sassOptions: {
    includePaths: ['./src/styles'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
