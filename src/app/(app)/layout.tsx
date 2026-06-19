import AppLayout from '@/components/layout/AppLayout';

/**
 * Layout for the authenticated `(app)` route group. Wraps the protected pages
 * (dashboard, map) in the shared chrome (sidebar + top bar) via {@link AppLayout}.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
