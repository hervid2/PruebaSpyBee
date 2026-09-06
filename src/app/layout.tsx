/**
 * Root layout for the whole app. Defines the `<html>`/`<body>` shell, loads the
 * Inter font as a CSS variable and pulls in global styles — wraps every route.
 */
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import IntlProvider from '@/components/providers/IntlProvider';
import {
  NOINDEX,
  OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  TITLE_TEMPLATE,
} from '@/lib/site';
import './globals.scss';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  // Resolves every relative URL below (and in child routes) against the real
  // deployment origin — without it Next emits relative OG/canonical URLs,
  // which crawlers can't follow.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Gestión de Incidencias`,
    // Child routes set a bare page name; the brand suffix is appended here
    // instead of being repeated in every page's `metadata`.
    template: TITLE_TEMPLATE,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'gestión de incidencias',
    'construcción',
    'seguimiento de obra',
    'mapa de incidencias',
    'control de calidad',
  ],
  // The app is private: default to noindex, and let the one public route
  // (`/login`) opt back in. Safer than the inverse, which would need every
  // future authenticated page to remember to opt out.
  robots: NOINDEX,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Gestión de Incidencias`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'es_ES',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Gestión de Incidencias`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  // Stops iOS Safari from linkifying incident IDs and coordinates as phone
  // numbers, which mangles the dark UI with blue system-styled links.
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: '#1a1a1a',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <IntlProvider>{children}</IntlProvider>
      </body>
    </html>
  );
}
