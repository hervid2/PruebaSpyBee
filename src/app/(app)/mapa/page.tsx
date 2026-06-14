import { getIncidents } from '@/services/incidents.service';
import { IssuesStoreProvider } from '@/store/useIssuesStore';
import MapaView from '@/components/map/MapaView';

export const metadata = {
  title: 'Mapa de Incidencias — Spybee',
};

export default async function MapaPage() {
  const incidents = await getIncidents();

  return (
    <IssuesStoreProvider initialIncidents={incidents}>
      <MapaView />
    </IssuesStoreProvider>
  );
}
