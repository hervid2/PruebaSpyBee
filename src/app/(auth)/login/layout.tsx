/**
 * Metadata carrier for `/login`. The page itself is a client component and so
 * can't export `metadata`; this layout adds nothing to the DOM and exists only
 * to opt the single public route back into indexing (the root layout defaults
 * the whole app to `noindex`) and to give it a canonical URL, its own OG copy
 * and `SoftwareApplication` structured data.
 */
import type { Metadata } from 'next';
import {
  INDEXABLE,
  OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from '@/lib/site';

const LOGIN_TITLE = `${SITE_NAME} — Gestión de Incidencias en Obra`;

export const metadata: Metadata = {
  title: { absolute: LOGIN_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/login' },
  robots: INDEXABLE,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: LOGIN_TITLE,
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/login'),
    locale: 'es_ES',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: LOGIN_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: ['es', 'en'],
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        // Serialized from a local constant, never from user input — there is
        // no untrusted data path into this string.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {children}
    </>
  );
}
