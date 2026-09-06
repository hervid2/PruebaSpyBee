import type { Metadata } from 'next';
import AppLayout from '@/components/layout/AppLayout';
import AuthBootstrap from '@/components/providers/AuthBootstrap';
import { NOINDEX_AUTHENTICATED } from '@/lib/site';

/**
 * Every route in this group is behind login and shows tenant data, so the
 * whole group is explicitly `noindex, nofollow` (`best-practices.md §SEO`).
 * The root layout already defaults to that; stating it at the authenticated
 * boundary keeps it true even if the root default is ever relaxed for a
 * future public landing page.
 */
export const metadata: Metadata = {
  robots: NOINDEX_AUTHENTICATED,
};

/**
 * Layout for the authenticated `(app)` route group. Wraps the protected pages
 * (dashboard, map) in the shared chrome (sidebar + top bar) via {@link AppLayout}.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthBootstrap />
      <AppLayout>{children}</AppLayout>
    </>
  );
}
