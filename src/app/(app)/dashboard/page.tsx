import { getIncidents } from '@/services/incidents.service';
import { IssuesStoreProvider } from '@/store/useIssuesStore';
import DashboardView from '@/components/dashboard/DashboardView';

// Dashboard consumes live incident data — never statically prerender
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard de Incidencias — Spybee',
};

export default async function DashboardPage() {
  const incidents = await getIncidents();

  return (
    <IssuesStoreProvider initialIncidents={incidents}>
      <DashboardView />
    </IssuesStoreProvider>
  );
}
