'use client';
/**
 * Composition root of the map page: stacks the filter bar, the Mapbox canvas and
 * the floating toolbar, and mounts the create-incident modal. Pure layout — all
 * state lives in the child components and stores.
 */
import MapboxViewer from './MapboxViewer';
import MapFilterBar from './MapFilterBar';
import MapToolbar from './MapToolbar';
import CreateIssueModal from '@/components/modals/create-issue/CreateIssueModal';
import styles from './MapaView.module.scss';

export default function MapaView() {
  return (
    <div className={styles['mapa-view']}>
      <MapFilterBar />
      <MapboxViewer />
      <MapToolbar />
      <CreateIssueModal />
    </div>
  );
}
