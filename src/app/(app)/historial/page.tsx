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
import { firstParam, parsePageParam } from '@/lib/search-params';
import HistorialView from '@/components/historial/HistorialView';
import HistorialForbidden from '@/components/historial/HistorialForbidden';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Historial de Incidencias',
};

export default async function HistorialPage({ searchParams }: PageProps<'/historial'>) {
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const projectId = firstParam(params.projectId);
  const userId = firstParam(params.userId);

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
