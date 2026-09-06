/**
 * Public site identity and indexing policy, shared by every SEO surface: the
 * root `metadataBase`, each route group's `robots` directives, `robots.txt`
 * and `sitemap.xml`. Kept in one pure module (no React, no Next runtime) so
 * the policy is unit-testable and a canonical URL, a sitemap entry and an
 * `Allow:` rule can never drift apart.
 *
 * FlyWorkFlow is a private application behind login: the policy is deny by
 * default, and `PUBLIC_ROUTES` is the complete opt-in list.
 */
import type { Metadata } from 'next';

/**
 * Absolute origin of the deployed frontend. Reuses `NEXT_PUBLIC_APP_URL` (the
 * same var `middleware.ts` documents for absolute redirects) instead of
 * introducing a second, silently-divergent URL var. Inlined at build time, so
 * the Vercel project env var is what ends up in the generated robots/sitemap.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const SITE_NAME = 'FlyWorkFlow';

export const SITE_DESCRIPTION =
  'Plataforma de gestión de incidencias para proyectos de construcción: mapa georreferenciado, dashboard de métricas, flujo de aprobación y trazabilidad completa.';

/**
 * Brand suffix appended to each page's bare title by the root layout — pages
 * set `title: 'Papelera'`, never `'Papelera — FlyWorkFlow'`, or the brand
 * would appear twice.
 */
export const TITLE_TEMPLATE = `%s — ${SITE_NAME}`;

/**
 * The only routes that are reachable — and meaningful — without a session.
 * `/invitar/[token]` is public too, but it is deliberately excluded: the token
 * in the URL is a credential, so those pages must never reach a sitemap or a
 * search index.
 */
export const PUBLIC_ROUTES = ['/login'] as const;

/** Static assets crawlers need to render a rich link preview of `/login`. */
export const PUBLIC_ASSETS = ['/icon.svg', '/opengraph-image'] as const;

/**
 * The generated OG card (`src/app/opengraph-image.tsx`), declared explicitly.
 * Next.js attaches a file-convention image to its own segment, and a nested
 * `openGraph` block *replaces* the inherited images rather than merging with
 * them — so every route that declares `openGraph` has to restate this, or its
 * link previews silently lose the image.
 */
export const OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — Gestión de Incidencias`,
} as const;

/** Default for the app: private, so nothing is indexed unless it opts in. */
export const NOINDEX: Metadata['robots'] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

/** Authenticated routes — also `nocache`, so no snippet of tenant data survives. */
export const NOINDEX_AUTHENTICATED: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false, noimageindex: true },
};

/** Token-bearing URLs — additionally `noarchive`: an archived copy is a leaked invite. */
export const NOINDEX_TOKEN_BEARING: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  noarchive: true,
  googleBot: { index: false, follow: false },
};

/** The opt-in, used only by routes listed in {@link PUBLIC_ROUTES}. */
export const INDEXABLE: Metadata['robots'] = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true },
};

/** Builds an absolute URL from an app-relative path (`/login` → `https://…/login`). */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
