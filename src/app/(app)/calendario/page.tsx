/**
 * Calendar route (server component). Mirrors the dashboard/map pages: fetches
 * incidents server-side, seeds the issues store for the client calendar view,
 * and mounts the shared incident-detail modal so day-detail items can open it.
 */
import { getIncidents } from '@/services/incidents.service';
import { IssuesStoreProvider } from '@/store/useIssuesStore';
import CalendarioView from '@/components/calendario/CalendarioView';
import IncidentDetailModal from '@/components/modals/incident-detail/IncidentDetailModal';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Calendario',
};

export default async function CalendarioPage() {
  const incidents = await getIncidents();

  return (
    <IssuesStoreProvider initialIncidents={incidents}>
      <CalendarioView />
      <IncidentDetailModal />
    </IssuesStoreProvider>
  );
}
