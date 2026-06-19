/**
 * Map route (server component). Mirrors the dashboard page: fetches incidents
 * server-side, seeds the issues store for the client map, and mounts the
 * shared incident-detail modal.
 */
import { getIncidents } from '@/services/incidents.service';
import { IssuesStoreProvider } from '@/store/useIssuesStore';
import MapaView from '@/components/map/MapaView';
import IncidentDetailModal from '@/components/modals/incident-detail/IncidentDetailModal';

export const metadata = {
  title: 'Mapa de Incidencias — Spybee',
};

export default async function MapaPage() {
  const incidents = await getIncidents();

  return (
    <IssuesStoreProvider initialIncidents={incidents}>
      <MapaView />
      <IncidentDetailModal />
    </IssuesStoreProvider>
  );
}
