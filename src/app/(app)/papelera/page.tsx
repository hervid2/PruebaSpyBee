/**
 * Trash route (server component). Fetches a page of the org's soft-deleted
 * incidents server-side, same server-paginated pattern as `/historial`.
 * `GET /incidents/trash` is admin+ only; a 403 renders an access-restricted
 * state instead of the table.
 */
import { getTrash } from '@/services/trash.service';
import { nullIfForbidden } from '@/lib/api-client';
import { parsePageParam } from '@/lib/search-params';
import TrashView from '@/components/trash/TrashView';
import TrashForbidden from '@/components/trash/TrashForbidden';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Papelera',
};

export default async function TrashPage({ searchParams }: PageProps<'/papelera'>) {
  const page = parsePageParam((await searchParams).page);

  const trash = await nullIfForbidden(getTrash(page));
  if (!trash) return <TrashForbidden />;

  return (
    <TrashView
      incidents={trash.items}
      total={trash.total}
      page={trash.page}
      pageSize={trash.pageSize}
    />
  );
}
