/**
 * Regression tests for the four server-paginated pages.
 *
 * The bug: `searchParams` became a promise in next@16, and all four pages
 * still read it synchronously. Because each declared its own hand-written
 * `{ page?: string }` prop type, nothing failed to compile — `searchParams.page`
 * was simply `undefined`, so every page silently served page 1 and pagination
 * was dead in all four. `/historial` lost its project and user filters the
 * same way. Exactly the failure F9.5 fixed on the invitation page, and the
 * reason these now take Next's generated `PageProps<'/route'>` instead.
 *
 * The pages are invoked as plain async functions rather than rendered: what's
 * under test is the params -> service-call plumbing, not the markup, and this
 * keeps the assertion on the argument the backend would actually receive.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/gallery.service', () => ({ getGalleryMedia: vi.fn() }));
vi.mock('@/services/documents.service', () => ({ getDocumentsMedia: vi.fn() }));
vi.mock('@/services/audit-log.service', () => ({ getAuditLog: vi.fn() }));
vi.mock('@/services/trash.service', () => ({ getTrash: vi.fn() }));

import GaleriaPage from '@/app/(app)/galeria/page';
import DocumentosPage from '@/app/(app)/documentos/page';
import HistorialPage from '@/app/(app)/historial/page';
import TrashPage from '@/app/(app)/papelera/page';
import { getGalleryMedia } from '@/services/gallery.service';
import { getDocumentsMedia } from '@/services/documents.service';
import { getAuditLog } from '@/services/audit-log.service';
import { getTrash } from '@/services/trash.service';

const emptyPage = { items: [], total: 0, page: 1, pageSize: 20 };

beforeEach(() => {
  vi.mocked(getGalleryMedia).mockResolvedValue(emptyPage);
  vi.mocked(getDocumentsMedia).mockResolvedValue(emptyPage);
  vi.mocked(getAuditLog).mockResolvedValue(emptyPage);
  vi.mocked(getTrash).mockResolvedValue(emptyPage);
});

describe('pages that paginate through ?page=', () => {
  const cases = [
    ['/galeria', GaleriaPage, getGalleryMedia],
    ['/documentos', DocumentosPage, getDocumentsMedia],
    ['/papelera', TrashPage, getTrash],
  ] as const;

  it.each(cases)('%s forwards the requested page to its service', async (_route, Page, service) => {
    await Page({ searchParams: Promise.resolve({ page: '3' }), params: Promise.resolve({}) });
    expect(service).toHaveBeenCalledWith(3);
  });

  it.each(cases)('%s falls back to page 1 on a junk page param', async (_route, Page, service) => {
    await Page({ searchParams: Promise.resolve({ page: 'abc' }), params: Promise.resolve({}) });
    expect(service).toHaveBeenCalledWith(1);
  });

  it('/historial forwards the requested page to the audit log', async () => {
    await HistorialPage({
      searchParams: Promise.resolve({ page: '3' }),
      params: Promise.resolve({}),
    });
    expect(getAuditLog).toHaveBeenCalledWith({
      page: 3,
      projectId: undefined,
      userId: undefined,
    });
  });
});

describe('/historial filters', () => {
  it('forwards the project and user filters', async () => {
    await HistorialPage({
      searchParams: Promise.resolve({ projectId: 'proj-1', userId: 'user-7' }),
      params: Promise.resolve({}),
    });
    expect(getAuditLog).toHaveBeenCalledWith({
      page: 1,
      projectId: 'proj-1',
      userId: 'user-7',
    });
  });

  it('omits a filter given as an empty string rather than querying for ""', async () => {
    await HistorialPage({
      searchParams: Promise.resolve({ projectId: '', userId: 'user-7' }),
      params: Promise.resolve({}),
    });
    expect(getAuditLog).toHaveBeenCalledWith({
      page: 1,
      projectId: undefined,
      userId: 'user-7',
    });
  });
});
