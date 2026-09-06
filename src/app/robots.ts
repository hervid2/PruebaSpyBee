/**
 * Generates `/robots.txt` through the Next.js Metadata API.
 *
 * The product is private behind login, so the default is `Disallow: /` and
 * only the genuinely public surface is opted back in. Blanket-allowing the app
 * would leak dashboard/map/history URLs into search results — a privacy
 * problem before it is an SEO one (`best-practices.md §SEO`).
 */
import type { MetadataRoute } from 'next';
import { PUBLIC_ASSETS, PUBLIC_ROUTES, SITE_URL, absoluteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // Assets are allowed so link-preview crawlers can still fetch the OG
      // image and icon for a shared /login URL.
      allow: [...PUBLIC_ROUTES, ...PUBLIC_ASSETS],
      disallow: '/',
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  };
}
