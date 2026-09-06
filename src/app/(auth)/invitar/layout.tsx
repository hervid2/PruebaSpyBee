/**
 * Metadata carrier for the public invitation routes. Unlike `/login`, these
 * URLs stay `noindex` on purpose: the `[token]` segment is a credential, so an
 * indexed or archived copy of the URL would hand out an org invitation. Also
 * kept out of `sitemap.xml` for the same reason (see `@/lib/site`).
 */
import type { Metadata } from 'next';
import { NOINDEX_TOKEN_BEARING } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Aceptar invitación',
  robots: NOINDEX_TOKEN_BEARING,
};

export default function InvitarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
