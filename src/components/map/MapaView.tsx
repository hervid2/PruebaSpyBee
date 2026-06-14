'use client';
import MapboxViewer from './MapboxViewer';
import MapFilterBar from './MapFilterBar';
import MapToolbar from './MapToolbar';
import styles from './MapaView.module.scss';

export default function MapaView() {
  return (
    <div className={styles['mapa-view']}>
      <MapFilterBar />
      <MapboxViewer />
      <MapToolbar />
    </div>
  );
}
