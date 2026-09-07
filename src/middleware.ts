/**
 * Edge auth gate, and the place the per-request CSP is issued (F9.4).
 * Runs before every matched request and redirects
 * unauthenticated users to `/login`. Verifies the mirrored access-token
 * cookie's signature and expiration with `jose` (Edge-compatible) against
 * `JWT_ACCESS_SECRET` — the same secret the backend signs with, set as a
 * plain (non-`NEXT_PUBLIC_`) server env var here so it never reaches the
 * browser bundle. Real authorization is still enforced by the backend on
 * every API call; this only gates page navigation.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth-cookie';
import { buildContentSecurityPolicy } from '@/lib/security-headers';

// Routes reachable without a session.
const PUBLIC_PATHS = ['/login', '/invitar'];

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * Continues the request with this render's CSP attached (F9.4). The policy
 * goes on the *request* headers as well as the response because that is how
 * Next finds the nonce: it parses `script-src` out of the incoming header and
 * stamps the matching `nonce` onto every script tag it emits. Only those
 * scripts — and, via `'strict-dynamic'`, the chunks they load — then run.
 *
 * `x-nonce` is the same value under a name our own code can read, for the one
 * inline script this app writes itself (the JSON-LD block in the login
 * layout).
 *
 * The `.set()` on the request headers is load-bearing beyond just adding the
 * policy: it *replaces* any `Content-Security-Policy` the client sent, so the
 * value Next derives a nonce from is always this function's own, never
 * attacker text. That began as the documented workaround for CVE-2026-44581
 * (a malformed inbound CSP request header reflected into the rendered HTML,
 * unpatched on next@14 — see roadmap.md F9.4). F9.5's upgrade to next@16 fixes
 * that at the source, so this is no longer the only thing standing in front of
 * it — but it stays, because "the policy this app serves is the one this
 * function wrote" is the property worth holding regardless of which framework
 * version is underneath. Do not narrow it to only setting the header when
 * absent; the e2e case in security-headers.spec.ts exists to catch that.
 */
function allowWithCsp(request: NextRequest): NextResponse {
  const nonce = crypto.randomUUID();
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === 'development');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes through.
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return allowWithCsp(request);
  }

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return redirectToLogin(request, pathname);
  }

  try {
    await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
    return allowWithCsp(request);
  } catch {
    // Expired, tampered, or signed with a different secret.
    return redirectToLogin(request, pathname);
  }
}

// Match everything except Next.js internals, static assets, the generated
// icon/OG-image routes (favicon.ico, icon.svg, opengraph-image) and the SEO
// files — a crawler fetching robots.txt or sitemap.xml has no session, and
// redirecting it to /login would make both unreadable.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|robots.txt|sitemap.xml|public/).*)',
  ],
};
