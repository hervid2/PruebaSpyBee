/**
 * Trash route (server component). Fetches a page of the org's soft-deleted
 * incidents server-side, same server-paginated pattern as `/historial`.
 * `GET /incidents/trash` is admin+ only; a 403 renders an access-restricted
 * state instead of the table.
 */
import { getTrash } from '@/services/trash.service';
import { ApiError } from '@/lib/api-client';
import TrashView from '@/components/trash/TrashView';
import TrashForbidden from '@/components/trash/TrashForbidden';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Papelera',
};

interface TrashPageProps {
  searchParams: { page?: string };
}

export default async function TrashPage({ searchParams }: TrashPageProps) {
  const parsedPage = Number(searchParams.page);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  try {
    const trash = await getTrash(page);
    return (
      <TrashView
        incidents={trash.items}
        total={trash.total}
        page={trash.page}
        pageSize={trash.pageSize}
      />
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return <TrashForbidden />;
    }
    throw err;
  }
}
