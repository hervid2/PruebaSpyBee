'use client';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapbox } from '@/hooks/useMapbox';
import { useIssuesStore } from '@/store/useIssuesStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import { createMarkerElement } from './IncidentMarker';
import { getPopupHTML } from './IncidentPopup';
import styles from './MapboxViewer.module.scss';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export default function MapboxViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const { mapRef, isLoaded } = useMapbox(containerRef, TOKEN);

  const incidents = useIssuesStore((s) => s.incidents);
  const is3D = useFiltersStore((s) => s.is3D);

  // Sincronizar proyección 2D / 3D
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    mapRef.current.setProjection(is3D ? 'globe' : 'mercator');
  }, [is3D, isLoaded, mapRef]);

  // Renderizar marcadores al cambiar incidencias o cuando el mapa carga
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const geoPoints: [number, number][] = [];

    incidents
      .filter((i) => i.coordinates !== null)
      .forEach((incident) => {
        const el = createMarkerElement(incident);

        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: '280px',
          offset: 20,
        }).setHTML(getPopupHTML(incident));

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([incident.coordinates!.lng, incident.coordinates!.lat])
          .setPopup(popup)
          .addTo(mapRef.current!);

        markersRef.current.push(marker);
        geoPoints.push([incident.coordinates!.lng, incident.coordinates!.lat]);
      });

    // Ajustar la vista para mostrar todos los marcadores
    if (geoPoints.length > 1) {
      const bounds = geoPoints.reduce<mapboxgl.LngLatBounds>(
        (b, coord) => b.extend(coord),
        new mapboxgl.LngLatBounds(geoPoints[0], geoPoints[0]),
      );
      mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 16 });
    } else if (geoPoints.length === 1) {
      mapRef.current.flyTo({ center: geoPoints[0], zoom: 14 });
    }
  }, [incidents, isLoaded, mapRef]);

  return (
    <div className={styles['mapbox-viewer']}>
      <div
        ref={containerRef}
        className={styles['mapbox-viewer__canvas']}
        role="application"
        aria-label="Mapa de incidencias"
      />
      {!isLoaded && (
        <div className={styles['mapbox-viewer__loading']} aria-live="polite">
          <span>Cargando mapa…</span>
        </div>
      )}
    </div>
  );
}
