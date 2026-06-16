'use client';
import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useIssuesStore } from '@/store/useIssuesStore';
import CalendarActivity from './CalendarActivity';
import styles from './HeatmapSection.module.scss';

export default function HeatmapSection() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const metrics = useDashboardMetrics();
  const incidents = useIssuesStore((s) => s.incidents);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-74.072, 4.711],
      zoom: 9,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));

    map.on('load', () => {
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: metrics.heatmapPoints.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { weight: p.weight },
        })),
      };

      map.addSource('incidents-heat', { type: 'geojson', data: geojson });

      map.addLayer({
        id: 'incidents-heat-layer',
        type: 'heatmap',
        source: 'incidents-heat',
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(33,102,172,0)',
            0.2,
            'rgba(103,169,207,0.6)',
            0.4,
            'rgba(209,229,240,0.8)',
            0.6,
            'rgba(253,219,199,0.9)',
            0.8,
            'rgba(239,138,98,1)',
            1,
            'rgba(178,24,43,1)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
          'heatmap-opacity': 0.85,
        },
      });
    });

    mapRef.current = map;

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={styles.heatmap} aria-labelledby="heatmap-title">
      <h2 id="heatmap-title" className={styles.heatmap__title}>
        Mapa de incidencias — Distribución geográfica y temporal
      </h2>
      <div className={styles.heatmap__body}>
        <div
          ref={containerRef}
          className={styles.heatmap__map}
          role="img"
          aria-label="Mapa de calor de incidencias por ubicación"
        />
        <aside className={styles.heatmap__calendar} aria-label="Actividad por día">
          <h3 className={styles.heatmap__calendar_title}>Actividad diaria</h3>
          <CalendarActivity activity={metrics.calendarActivity} incidents={incidents} />
        </aside>
      </div>
    </section>
  );
}
