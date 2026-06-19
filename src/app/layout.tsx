/**
 * Root layout for the whole app. Defines the `<html>`/`<body>` shell, loads the
 * Inter font as a CSS variable and pulls in global styles — wraps every route.
 */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.scss';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Spybee — Gestión de Incidencias',
  description: 'Módulo de gestión de incidencias para proyectos de construcción.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
