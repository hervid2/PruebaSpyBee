/**
 * Dashboard route (server component). Fetches incidents at request time and
 * seeds the issues store so the client dashboard renders metrics without an
 * extra round-trip; also mounts the shared incident-detail modal.
 */
import { getIncidents } from '@/services/incidents.service';
import { IssuesStoreProvider } from '@/store/useIssuesStore';
import DashboardView from '@/components/dashboard/DashboardView';
import IncidentDetailModal from '@/components/modals/incident-detail/IncidentDetailModal';

// Dashboard consumes live incident data — never statically prerender.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard de Incidencias — Spybee',
};

export default async function DashboardPage() {
  const incidents = await getIncidents();

  return (
    <IssuesStoreProvider initialIncidents={incidents}>
      <DashboardView />
      <IncidentDetailModal />
    </IssuesStoreProvider>
  );
}
