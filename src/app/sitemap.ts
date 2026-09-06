/**
 * Generates `/sitemap.xml` through the Next.js Metadata API.
 *
 * Only real public routes belong here (`best-practices.md §SEO`): listing an
 * authenticated route would advertise a URL that every crawler gets redirected
 * away from, and listing `/invitar/[token]` would publish invitation tokens.
 */
import type { MetadataRoute } from 'next';
import { PUBLIC_ROUTES, absoluteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 1,
  }));
}
