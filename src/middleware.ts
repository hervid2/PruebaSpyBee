/**
 * Edge auth gate. Runs before every matched request and redirects
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes through.
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return redirectToLogin(request, pathname);
  }

  try {
    await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
    return NextResponse.next();
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
