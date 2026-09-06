/**
 * History route (server component). Fetches a page of the org's audit trail
 * server-side — unlike dashboard/mapa, this doesn't preload the full
 * collection into a client store: the audit log can grow indefinitely, so
 * pagination and filters are real query params handled by the backend.
 * `GET /audit-log` is admin+ only; a 403 renders an access-restricted state
 * instead of the table.
 */
import { getAuditLog } from '@/services/audit-log.service';
import { ApiError } from '@/lib/api-client';
import HistorialView from '@/components/historial/HistorialView';
import HistorialForbidden from '@/components/historial/HistorialForbidden';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Historial de Incidencias',
};

interface HistorialPageProps {
  searchParams: { page?: string; projectId?: string; userId?: string };
}

export default async function HistorialPage({ searchParams }: HistorialPageProps) {
  const parsedPage = Number(searchParams.page);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const { projectId, userId } = searchParams;

  try {
    const auditLog = await getAuditLog({ page, projectId, userId });
    return (
      <HistorialView
        entries={auditLog.items}
        total={auditLog.total}
        page={auditLog.page}
        pageSize={auditLog.pageSize}
      />
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return <HistorialForbidden />;
    }
    throw err;
  }
}
