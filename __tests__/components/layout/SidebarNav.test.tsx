/**
 * The sidebar is the one navigation surface on every authenticated page, and
 * for most of the project it linked to two routes that never existed:
 * `/informacion`, drawn in the original UI spec but never defined as a page,
 * and `/compartir`, an action that was already a dialog on the map toolbar.
 * Nothing failed. A `<Link>` to a missing route renders like any other and
 * only 404s once someone follows it (or once Next prefetches it).
 *
 * So the check here is against the filesystem rather than a hand-kept list:
 * a list would have to be updated by whoever added the bad link, which is
 * exactly the person who did not notice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import SidebarNav from '@/components/layout/SidebarNav';
import { useModalStore } from '@/store/useModalStore';

vi.mock('next/navigation', () => ({ usePathname: () => '/mapa' }));

const APP_DIR = path.resolve(__dirname, '..', '..', '..', 'src', 'app');

/** Every URL a `page.tsx` under `src/app` serves, with route groups like `(app)` dropped. */
function appRoutes(dir = APP_DIR, segments: string[] = []): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      const isRouteGroup = /^\(.+\)$/.test(entry);
      return appRoutes(full, isRouteGroup ? segments : [...segments, entry]);
    }
    return entry === 'page.tsx' ? [`/${segments.join('/')}`] : [];
  });
}

describe('SidebarNav', () => {
  beforeEach(() => {
    useModalStore.setState({ activeModal: null });
  });

  it('finds the app routes it checks against', () => {
    // Guards the guard: a path mistake above would make every href "missing"
    // or, worse, an empty set would make the next test vacuous.
    expect(appRoutes()).toEqual(expect.arrayContaining(['/', '/mapa', '/dashboard']));
  });

  it('links only to routes that have a page', () => {
    render(<SidebarNav />);
    const routes = new Set(appRoutes());

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.length).toBeGreaterThan(5);

    const missing = hrefs.filter((href) => !routes.has(href));
    expect(missing, `Sidebar links with no page.tsx behind them: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('opens the invite dialog from "Compartir" instead of navigating', () => {
    render(<SidebarNav />);

    expect(screen.queryByRole('link', { name: 'Compartir' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    expect(useModalStore.getState().activeModal).toBe('invite-collaborators');
  });
});
