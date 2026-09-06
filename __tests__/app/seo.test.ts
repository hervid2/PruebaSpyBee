/**
 * Unit tests for the F9.2 SEO pass (docs/roadmap.md). What these guard is a
 * privacy rule as much as an SEO one (`best-practices.md §SEO`): FlyWorkFlow
 * is private behind login, so `/login` is the only route that may ever be
 * crawled, indexed or listed in the sitemap.
 *
 * The layouts are deliberately not imported here — they pull `next/font` and
 * global SCSS. The policy they apply lives in `@/lib/site`, which is pure, so
 * that is what gets asserted.
 */
import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import {
  INDEXABLE,
  NOINDEX,
  OG_IMAGE,
  NOINDEX_AUTHENTICATED,
  NOINDEX_TOKEN_BEARING,
  PUBLIC_ROUTES,
  SITE_URL,
  TITLE_TEMPLATE,
  absoluteUrl,
} from '@/lib/site';

// Every authenticated route, plus the token-bearing invitation route.
const PRIVATE_PATHS = [
  '/dashboard',
  '/mapa',
  '/historial',
  '/papelera',
  '/galeria',
  '/documentos',
  '/calendario',
  '/ajustes',
  '/invitar/some-token',
];

describe('robots.txt', () => {
  const rules = robots().rules as { userAgent: string; allow: string[]; disallow: string };

  it('disallows the whole app by default', () => {
    expect(rules.userAgent).toBe('*');
    expect(rules.disallow).toBe('/');
  });

  it('allows exactly the public routes back in', () => {
    for (const route of PUBLIC_ROUTES) {
      expect(rules.allow).toContain(route);
    }
  });

  it('never allows an authenticated or token-bearing path', () => {
    for (const path of PRIVATE_PATHS) {
      expect(rules.allow).not.toContain(path);
    }
  });

  it('points crawlers at an absolute sitemap URL', () => {
    expect(robots().sitemap).toBe(absoluteUrl('/sitemap.xml'));
  });
});

describe('sitemap.xml', () => {
  const entries = sitemap();

  it('lists only the public routes, as absolute URLs', () => {
    expect(entries.map((e) => e.url)).toEqual(PUBLIC_ROUTES.map((r) => absoluteUrl(r)));
  });

  it('leaks no authenticated or token-bearing URL', () => {
    const urls = entries.map((e) => e.url).join(' ');
    for (const path of PRIVATE_PATHS) {
      expect(urls).not.toContain(path);
    }
  });
});

describe('indexing policy', () => {
  it('defaults to noindex, so a new route is private unless it opts in', () => {
    expect(NOINDEX).toMatchObject({ index: false, follow: false });
  });

  it('keeps authenticated routes out of caches as well as indexes', () => {
    expect(NOINDEX_AUTHENTICATED).toMatchObject({ index: false, follow: false, nocache: true });
  });

  it('additionally unarchives token-bearing routes — an archived invite is a leaked one', () => {
    expect(NOINDEX_TOKEN_BEARING).toMatchObject({
      index: false,
      follow: false,
      noarchive: true,
    });
  });

  it('opts public routes back in', () => {
    expect(INDEXABLE).toMatchObject({ index: true, follow: true });
  });
});

describe('site URLs and titles', () => {
  it('builds absolute URLs against the configured origin', () => {
    expect(absoluteUrl('/login')).toBe(`${new URL(SITE_URL).origin}/login`);
  });

  it('appends the brand exactly once', () => {
    expect(TITLE_TEMPLATE.replace('%s', 'Papelera')).toBe('Papelera — FlyWorkFlow');
  });

  // Every route that declares `openGraph` must restate this image: a nested
  // block replaces the inherited images instead of merging, so dropping it
  // silently costs /login its link preview.
  it('points the OG card at the generated route at the size social crawlers expect', () => {
    expect(OG_IMAGE.url).toBe('/opengraph-image');
    expect([OG_IMAGE.width, OG_IMAGE.height]).toEqual([1200, 630]);
  });
});
